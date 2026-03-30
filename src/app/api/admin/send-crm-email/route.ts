import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';
import { sendCrmEmail, substituteTplVars } from '../_email';

export const runtime = 'nodejs';

/**
 * POST /api/admin/send-crm-email
 * Body: { email, subject, body, firstName?, lastName?, businessName? }
 * Sends from applications@usbusinessgrants.org, logs to crm_contacts/{email}/emails
 */
export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const body = await req.json() as {
    email?: string;
    subject?: string;
    body?: string;
    isHtml?: boolean;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    fromAccountId?: string;
  };

  if (!body.email?.trim())   return NextResponse.json({ message: 'email is required.' }, { status: 400 });
  if (!body.subject?.trim()) return NextResponse.json({ message: 'subject is required.' }, { status: 400 });
  if (!body.body?.trim())    return NextResponse.json({ message: 'body is required.' }, { status: 400 });

  const firstName    = body.firstName    ?? '';
  const lastName     = body.lastName     ?? '';
  const businessName = body.businessName ?? '';
  const name         = [firstName, lastName].filter(Boolean).join(' ') || businessName || body.email;

  const vars: Record<string, string> = {
    name,
    firstName,
    lastName,
    businessName,
    email: body.email,
  };

  const resolvedSubject = substituteTplVars(body.subject, vars);
  const resolvedBody    = substituteTplVars(body.body, vars);

  try {
    await sendCrmEmail({
      to: body.email,
      subject: resolvedSubject,
      body: resolvedBody,
      isHtml: body.isHtml,
      vars,
      fromAccountId: body.fromAccountId,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[send-crm-email] SMTP error:', detail);
    return NextResponse.json({ message: `SMTP error: ${detail}` }, { status: 500 });
  }

  // Log to Firestore
  try {
    await db.collection('crm_contacts').doc(body.email).collection('emails').add({
      subject: resolvedSubject,
      body: resolvedBody,
      sentAt: new Date(),
      from: `applications@usbusinessgrants.org`,
      to: body.email,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/admin/send-crm-email?email=…  — fetch sent email log
 */
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const email = new URL(req.url).searchParams.get('email') ?? '';
  if (!email) return NextResponse.json({ message: 'email param required.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const snap = await db
    .collection('crm_contacts').doc(email)
    .collection('emails')
    .orderBy('sentAt', 'desc')
    .limit(50)
    .get();

  type EmailLog = { id: string; subject: string; body: string; sentAt: string; from: string };
  const emails: EmailLog[] = [];
  snap.forEach(d => {
    const data = d.data() as Record<string, unknown>;
    const ts = data.sentAt as { toDate?: () => Date } | string | null;
    const sentAt = ts && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function'
      ? ts.toDate().toISOString()
      : typeof ts === 'string' ? ts : '';
    emails.push({
      id: d.id,
      subject: String(data.subject ?? ''),
      body: String(data.body ?? ''),
      sentAt,
      from: String(data.from ?? 'applications@usbusinessgrants.org'),
    });
  });

  return NextResponse.json(emails);
}
