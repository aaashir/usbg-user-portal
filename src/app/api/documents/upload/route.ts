import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type AdminLikeDb = {
  doc(path: string): { set(data: unknown, options?: { merge?: boolean }): Promise<void> };
};

type AdminLikeStorage = {
  bucket(name?: string): {
    file(path: string): {
      save(
        data: Buffer,
        options?: { contentType?: string; resumable?: boolean; metadata?: Record<string, string> }
      ): Promise<void>;
      getSignedUrl(options: { action: 'read'; expires: string | number | Date }): Promise<[string]>;
    };
  };
};

function getEnvString(key: string) {
  const v = process.env[key];
  return typeof v === 'string' ? v : '';
}

async function getAdmin(): Promise<{ db: AdminLikeDb; storage: AdminLikeStorage; bucketName: string } | null> {
  const projectId =
    getEnvString('FIREBASE_ADMIN_PROJECT_ID') || getEnvString('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || '';
  const clientEmail = getEnvString('FIREBASE_ADMIN_CLIENT_EMAIL') || '';
  const privateKeyRaw = getEnvString('FIREBASE_ADMIN_PRIVATE_KEY') || '';
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : '';

  if (!projectId || !clientEmail || !privateKey) return null;

  const resolvedBucketName =
    getEnvString('FIREBASE_ADMIN_STORAGE_BUCKET') ||
    getEnvString('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') ||
    `${projectId}.appspot.com`;

  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: resolvedBucketName,
    });
  }

  return {
    db: getFirestore() as unknown as AdminLikeDb,
    storage: getStorage() as unknown as AdminLikeStorage,
    bucketName: resolvedBucketName,
  };
}

function sanitizeKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_/-]+/g, '_')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) {
    const missing = [
      getEnvString('FIREBASE_ADMIN_PROJECT_ID') || getEnvString('NEXT_PUBLIC_FIREBASE_PROJECT_ID') ? null : 'FIREBASE_ADMIN_PROJECT_ID',
      getEnvString('FIREBASE_ADMIN_CLIENT_EMAIL') ? null : 'FIREBASE_ADMIN_CLIENT_EMAIL',
      getEnvString('FIREBASE_ADMIN_PRIVATE_KEY') ? null : 'FIREBASE_ADMIN_PRIVATE_KEY',
    ]
      .filter(Boolean)
      .join(', ');
    return NextResponse.json(
      { message: `Server is not configured for document uploads (${missing || 'missing env'}).` },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: 'Invalid form data.' }, { status: 400 });
  }

  const email = String(form.get('email') ?? '').trim();
  const key = sanitizeKey(String(form.get('key') ?? ''));
  const label = String(form.get('label') ?? '').trim();
  const file = form.get('file');

  if (!email || !key) return NextResponse.json({ message: 'Missing email or key.' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ message: 'Missing file.' }, { status: 400 });

  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ message: 'File is too large (max 25MB).' }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeEmail = encodeURIComponent(email);
  const filename = file.name || 'upload';
  const path = `users/${safeEmail}/documents/${key}/${Date.now()}-${filename}`;

  try {
    const bucket = admin.storage.bucket(admin.bucketName);
    const object = bucket.file(path);

    const token = randomUUID();
    await object.save(bytes, {
      contentType: file.type || 'application/octet-stream',
      resumable: false,
      metadata: {
        firebaseStorageDownloadTokens: token,
      } as unknown as Record<string, string>,
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${admin.bucketName}/o/${encodeURIComponent(
      path
    )}?alt=media&token=${token}`;

    await admin.db.doc(`check_status_app/${email}/documents/${key}`).set(
      {
        key,
        label: label || key,
        filename,
        url: publicUrl,
        uploadedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ url: publicUrl, filename });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error';
    return NextResponse.json({ message: `Upload failed: ${msg}` }, { status: 502 });
  }
}
