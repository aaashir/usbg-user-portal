export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../admin/_shared';

function getEmail(req: Request): string | null {
  const authHeader = req.headers.get('x-user-email') ?? '';
  const email = authHeader.trim().toLowerCase();
  return email.includes('@') ? email : null;
}

/** GET /api/preferences */
export async function GET(req: Request) {
  const email = getEmail(req);
  if (!email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Service unavailable' }, { status: 500 });

  const snap = await db.collection('crm_contacts').doc(email).get();
  const data = snap.data() as Record<string, unknown> | undefined;

  return NextResponse.json({
    unsubscribed:       data?.unsubscribed === true,
    emailNotifications: data?.emailNotifications !== false,
  });
}

/** PATCH /api/preferences */
export async function PATCH(req: Request) {
  const email = getEmail(req);
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
