import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';
import { sendCrmEmail, substituteTplVars } from '../_email';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min timeout for bulk sends

/**
 * POST /api/admin/bulk-email
 * Body: { subject, body, isHtml?, filter: 'all'|'SF'|'EF'|'UF'|'custom', emails?: string[] }
 */
export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const payload = await req.json() as {
    subject?: string;
    body?: string;
    isHtml?: boolean;
    filter?: 'all' | 'SF' | 'EF' | 'UF' | 'custom' | 'list';
    emails?: string[];
    listId?: string;
    fromAccountId?: string;
  };

  if (!payload.subject?.trim()) return NextResponse.json({ message: 'Subject is required.' }, { status: 400 });
  if (!payload.body?.trim())    return NextResponse.json({ message: 'Body is required.' }, { status: 400 });

  // ── Build recipient list ────────────────────────────────────────────────
  let recipientEmails: string[] = [];

  if (payload.filter === 'list' && payload.listId) {
    const listSnap = await db.collection('crm_lists').doc(payload.listId).get();
    if (!listSnap.exists) return NextResponse.json({ message: 'List not found.' }, { status: 404 });
    const listData = listSnap.data() as { contactEmails?: string[] };
    recipientEmails = (listData.contactEmails ?? []).filter(e => e.includes('@'));
  } else if (payload.filter === 'custom' && payload.emails?.length) {
    recipientEmails = payload.emails
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@'));
  } else {
    type ContactDoc = { email?: string; pr?: string; firstName?: string; firstname?: string; lastName?: string; lastname?: string; businessName?: string; company?: string };
    let query = db.collection('crm_contacts') as FirebaseFirestore.Query;
    if (payload.filter && payload.filter !== 'all') {
      query = query.where('pr', '==', payload.filter);
    }
    const snap = await query.limit(1000).get();
    snap.forEach(d => {
      const data = d.data() as ContactDoc;
      const email = data.email ?? d.id;
      if (email?.includes('@')) recipientEmails.push(email.trim().toLowerCase());
    });
  }

  if (recipientEmails.length === 0) {
    return NextResponse.json({ message: 'No recipients found.' }, { status: 400 });
  }

  // ── Send emails ─────────────────────────────────────────────────────────
  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const email of recipientEmails) {
    try {
      const snap = await db.collection('crm_contacts').doc(email).get();
      const cd   = snap.exists ? (snap.data() as Record<string, unknown>) : {};
      const firstName    = String(cd.firstName    ?? cd.firstname    ?? '');
      const lastName     = String(cd.lastName     ?? cd.lastname     ?? '');
      const businessName = String(cd.businessName ?? cd.company      ?? '');
      const name = [firstName, lastName].filter(Boolean).join(' ') || businessName || email;

      const vars: Record<string, string> = { name, firstName, lastName, businessName, email };

      await sendCrmEmail({
        to:            email,
        subject:       payload.subject!,
        body:          payload.body!,
        isHtml:        payload.isHtml,
        vars,
        fromAccountId: payload.fromAccountId,
      });

      // Log to contact's email history (non-fatal)
      try {
        await db.collection('crm_contacts').doc(email).collection('emails').add({
          subject: substituteTplVars(payload.subject!, vars),
          body:    substituteTplVars(payload.body!, vars),
          sentAt:  new Date(),
          from:    'applications@usbusinessgrants.org',
          to:      email,
          bulk:    true,
        });
      } catch { /* non-fatal */ }

      sent++;
    } catch (err) {
      failed++;
      if (errors.length < 20) errors.push(`${email}: ${err instanceof Error ? err.message : 'Error'}`);
    }
  }

  // Save a log entry to bulk_email_logs
  try {
    await db.collection('bulk_email_logs').add({
      subject:      payload.subject,
      bodyPreview:  payload.body!.slice(0, 200),
      isHtml:       payload.isHtml ?? false,
      filter:       payload.filter ?? 'all',
      customEmails: payload.filter === 'custom' ? (payload.emails ?? []) : [],
      recipients:   recipientEmails,   // full list regardless of filter type
      sent, failed, total: recipientEmails.length,
      errors: errors.slice(0, 10),
      sentAt: new Date(),
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, sent, failed, total: recipientEmails.length, errors });
}

/**
 * GET /api/admin/bulk-email
 * - ?filter=...  → recipient count
 * - ?history=1   → last 20 bulk send logs
 */
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const url = new URL(req.url);

  if (url.searchParams.get('history') === '1') {
    const snap = await db.collection('bulk_email_logs')
      .orderBy('sentAt', 'desc').limit(20).get();
    const logs = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const ts = data.sentAt as { toDate?: () => Date } | null;
      return {
        id:           d.id,
        subject:      String(data.subject     ?? ''),
        bodyPreview:  String(data.bodyPreview ?? ''),
        isHtml:       Boolean(data.isHtml),
        filter:       String(data.filter      ?? 'all'),
        sent:         Number(data.sent        ?? 0),
        failed:       Number(data.failed      ?? 0),
        total:        Number(data.total       ?? 0),
        errors:       Array.isArray(data.errors)       ? (data.errors       as string[]) : [],
        customEmails: Array.isArray(data.customEmails) ? (data.customEmails as string[]) : [],
        recipients:   Array.isArray(data.recipients)   ? (data.recipients   as string[]) : [],
        sentAt:       ts && typeof ts === 'object' && 'toDate' in ts && ts.toDate ? ts.toDate().toISOString() : '',
      };
    });
    return NextResponse.json(logs);
  }

  const filter = url.searchParams.get('filter') ?? 'all';
  let query = db.collection('crm_contacts') as FirebaseFirestore.Query;
  if (filter !== 'all') query = query.where('pr', '==', filter);

  const snap = await query.count().get();
  return NextResponse.json({ count: snap.data().count ?? 0 });
}
