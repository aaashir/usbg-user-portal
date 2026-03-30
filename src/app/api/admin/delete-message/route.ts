import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export const runtime = 'nodejs';

export async function DELETE(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const { email, messageId } = (await req.json()) as { email?: string; messageId?: string };
  if (!email || !messageId) return NextResponse.json({ message: 'Missing email or messageId.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  await db
    .collection('check_status_app')
    .doc(email)
    .collection('messages')
    .doc(messageId)
    .delete();

  return NextResponse.json({ ok: true });
}
