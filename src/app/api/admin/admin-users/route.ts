export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkSuperAdmin, getAdminFirebase, verifyAdminToken } from '../_shared';

/** GET /api/admin/admin-users — list all admin users (super_admin only) */
export async function GET(req: Request) {
  if (!await checkSuperAdmin(req)) return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const snap = await db.collection('admin_users').orderBy('createdAt', 'asc').get();
  const users = snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return {
      uid:         d.id,
      email:       String(data.email       ?? ''),
      displayName: String(data.displayName ?? ''),
      role:        String(data.role        ?? 'editor'),
      isActive:    data.isActive !== false,
      createdAt:   (data.createdAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() ?? '',
    };
  });
  return NextResponse.json(users);
}

/** POST /api/admin/admin-users — create a new admin user (super_admin only) */
export async function POST(req: Request) {
  if (!await checkSuperAdmin(req)) return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });

  const body = await req.json() as { email?: string; displayName?: string; password?: string; role?: string };
  if (!body.email?.trim())    return NextResponse.json({ message: 'email is required.' },    { status: 400 });
  if (!body.password?.trim()) return NextResponse.json({ message: 'password is required.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { getAuth }   = await import('firebase-admin/auth');
  const { FieldValue } = await import('firebase-admin/firestore');
  const caller = await verifyAdminToken(req);

  try {
    const userRecord = await getAuth().createUser({
      email:       body.email.trim(),
      password:    body.password,
      displayName: body.displayName?.trim() ?? '',
    });

    await db.collection('admin_users').doc(userRecord.uid).set({
      email:       body.email.trim().toLowerCase(),
      displayName: body.displayName?.trim() ?? '',
      role:        body.role ?? 'admin',
      isActive:    true,
      createdAt:   FieldValue.serverTimestamp(),
      createdBy:   caller?.email ?? 'unknown',
    });

    return NextResponse.json({ ok: true, uid: userRecord.uid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
