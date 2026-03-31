export const runtime = 'nodejs';

/**
 * Customer-facing email preferences API.
 * Uses Firebase ID token (not admin token) to identify the user.
 */

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../admin/_shared';
import { getAuth }          from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

async function verifyUserToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    const projectId     = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
    const clientEmail   = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '';
    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
    const privateKey    = privateKeyRaw.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) return null;

    if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

    const decoded = await getAuth().verifyIdToken(token);
    return decoded.email ?? null;
  } catch { return null; }
}

/** GET /api/preferences — get current email prefs */
export async function GET(req: Request) {
  const email = await verifyUserToken(req);
  if (!email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Service unavailable' }, { status: 500 });

  const snap = await db.collection('crm_contacts').doc(email).get();
  const data = snap.data() as Record<string, unknown> | undefined;

  return NextResponse.json({
    unsubscribed:       data?.unsubscribed === true,
    emailNotifications: data?.emailNotifications !== false, // default on
  });
}

/** PATCH /api/preferences — update email prefs */
export async function PATCH(req: Request) {
  const email = await verifyUserToken(req);
  if (!email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Service unavailable' }, { status: 500 });

  const body = await req.json() as { unsubscribed?: boolean; emailNotifications?: boolean };
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.unsubscribed       !== undefined) update.unsubscribed       = body.unsubscribed;
  if (body.emailNotifications !== undefined) update.emailNotifications = body.emailNotifications;
  if (body.unsubscribed === false)           update.resubscribedAt     = new Date();

  await db.collection('crm_contacts').doc(email).set(update, { merge: true });
  return NextResponse.json({ ok: true });
}
