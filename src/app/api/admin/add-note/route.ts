import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const { email, note } = (await req.json()) as { email?: string; note?: string };
  if (!email || !note?.trim()) return NextResponse.json({ message: 'Missing email or note.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const now = new Date();
  await db
    .collection('crm_contacts')
    .doc(email)
    .collection('notes')
    .doc(now.toISOString())
    .set({ body: note.trim(), createdAt: now });

  return NextResponse.json({ ok: true });
}
