import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';
import { sendNewMessageEmail } from '../_email';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const { email, userName, body } = (await req.json()) as {
    email?: string;
    userName?: string;
    body?: string;
  };

  if (!email) return NextResponse.json({ message: 'Missing email.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const messageBody = body?.trim() || '(no message content)';
  const now = new Date();
  const name = userName?.trim() || 'Applicant';

  // Write message to Firestore
  await db
    .collection('check_status_app')
    .doc(email)
    .collection('messages')
    .doc(now.toISOString())
    .set({
      subject: 'New Secure Message About Your Grant Application',
      body: messageBody,
      sentAt: now,
      read: false,
    });

  // Send SMTP email notification (non-fatal — portal still works without it)
  await sendNewMessageEmail({ to: email, name }).catch(err => {
    console.error('[send-message] email failed:', err);
  });

  return NextResponse.json({ ok: true });
}
