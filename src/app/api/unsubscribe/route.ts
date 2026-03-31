export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../admin/_shared';

/** GET /api/unsubscribe?token=xxx  — marks contact as unsubscribed */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  try {
    const db = await getAdminFirebase();
    if (!db) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });

    // Find contact by token
    const snap = await db.collection('crm_contacts').where('unsubToken', '==', token).limit(1).get();
    if (snap.empty) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

    const doc = snap.docs[0];
    await doc.ref.set({ unsubscribed: true, unsubscribedAt: new Date() }, { merge: true });

    // Redirect to confirmation page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return NextResponse.redirect(`${appUrl}/unsubscribe?success=1`);
  } catch (err) {
    console.error('[unsubscribe]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
