export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../_shared';

const SUPER_ADMIN_EMAIL = 'admin-crm@usbusinessgrants.org';
const SETUP_SECRET      = process.env.SETUP_SECRET ?? 'setup-usbg-2026';

export async function POST(req: Request) {
  const body = await req.json() as { secret?: string; password?: string };
  if (body.secret !== SETUP_SECRET) {
    return NextResponse.json({ message: 'Invalid setup secret.' }, { status: 403 });
  }
  if (!body.password) {
    return NextResponse.json({ message: 'password is required.' }, { status: 400 });
  }

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { getAuth }    = await import('firebase-admin/auth');
  const { FieldValue } = await import('firebase-admin/firestore');
  const auth           = getAuth();

  let uid: string;
  try {
    // Try to create the user
    const user = await auth.createUser({
      email:       SUPER_ADMIN_EMAIL,
      password:    body.password,
      displayName: 'Super Admin',
    });
    uid = user.uid;
  } catch (err: unknown) {
    // If already exists, fetch it
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
      uid = existing.uid;
      // Update password
      await auth.updateUser(uid, { password: body.password });
    } else {
      return NextResponse.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }
  }

  // Upsert Firestore role doc
  await db.collection('admin_users').doc(uid).set({
    email:       SUPER_ADMIN_EMAIL,
    displayName: 'Super Admin',
    role:        'super_admin',
    isActive:    true,
    createdAt:   FieldValue.serverTimestamp(),
    createdBy:   'system',
  }, { merge: true });

  return NextResponse.json({ ok: true, uid, email: SUPER_ADMIN_EMAIL });
}
