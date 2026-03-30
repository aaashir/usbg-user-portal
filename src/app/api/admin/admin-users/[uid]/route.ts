export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkSuperAdmin, getAdminFirebase } from '../../_shared';

/** PATCH /api/admin/admin-users/[uid] — update role or displayName */
export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  if (!await checkSuperAdmin(req)) return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });
  const { uid } = await params;

  const body = await req.json() as { role?: string; displayName?: string; isActive?: boolean };
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.role        !== undefined) update.role        = body.role;
  if (body.displayName !== undefined) update.displayName = body.displayName;
  if (body.isActive    !== undefined) update.isActive    = body.isActive;

  await db.collection('admin_users').doc(uid).update(update);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/admin-users/[uid] — delete admin user */
export async function DELETE(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  if (!await checkSuperAdmin(req)) return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });
  const { uid } = await params;

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { getAuth } = await import('firebase-admin/auth');

  try {
    await getAuth().deleteUser(uid);
  } catch { /* user may not exist in Firebase Auth */ }

  await db.collection('admin_users').doc(uid).delete();
  return NextResponse.json({ ok: true });
}
