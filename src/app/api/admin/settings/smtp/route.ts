export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../../_shared';

const DOC = 'settings/crm_email';

type SmtpAccount = {
  id: string;
  label?: string;
  fromName: string;
  user: string;
  pass: string;
  host: string;
  port: number;
  isDefault: boolean;
};

function maskAccounts(accounts: SmtpAccount[]): (Omit<SmtpAccount, 'pass'> & { pass: string })[] {
  return accounts.map(a => ({ ...a, pass: a.pass ? '***' : '' }));
}

export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured' }, { status: 500 });

  const snap = await db.doc(DOC).get();
  if (!snap.exists) {
    // Seed with env-based defaults so the form pre-fills sensibly on first visit
    const envAccount: SmtpAccount = {
      id:        'default',
      fromName:  'US Business Grants',
      user:      process.env.SMTP_APPS_USER ?? '',
      pass:      process.env.SMTP_APPS_PASS ?? '',
      host:      process.env.SMTP_HOST      ?? 'mail.usbusinessgrants.org',
      port:      Number(process.env.SMTP_PORT ?? 587),
      isDefault: true,
    };
    return NextResponse.json({ accounts: maskAccounts([envAccount]), source: 'env' });
  }

  const data = snap.data() as { accounts?: SmtpAccount[]; updatedAt?: unknown; notificationAccountId?: string };
  const accounts: SmtpAccount[] = Array.isArray(data.accounts) ? data.accounts : [];
  return NextResponse.json({ accounts: maskAccounts(accounts), notificationAccountId: data.notificationAccountId ?? null, updatedAt: data.updatedAt ?? null, source: 'firestore' });
}

export async function PUT(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured' }, { status: 500 });

  const body = await req.json() as { accounts?: SmtpAccount[]; notificationAccountId?: string | null };
  if (!Array.isArray(body.accounts)) return NextResponse.json({ message: 'accounts array required' }, { status: 400 });

  const ref = db.doc(DOC);
  const existing = (await ref.get()).data() as { accounts?: SmtpAccount[] } | undefined;
  const existingAccounts: SmtpAccount[] = Array.isArray(existing?.accounts) ? existing.accounts : [];

  // Merge: for each incoming account, preserve existing pass if client sent '***'
  const merged = body.accounts.map(incoming => {
    const prev = existingAccounts.find(e => e.id === incoming.id);
    let resolvedPass = '';
    if (incoming.pass && incoming.pass !== '***') {
      // Admin typed a new password
      resolvedPass = incoming.pass;
    } else if (prev?.pass) {
      // Keep the existing Firestore password
      resolvedPass = prev.pass;
    } else if (incoming.id === 'default') {
      // First save of the env-seeded default account — preserve env var password
      resolvedPass = process.env.SMTP_APPS_PASS ?? '';
    }
    return { ...incoming, pass: resolvedPass };
  });

  // Ensure exactly one isDefault
  const hasDefault = merged.some(a => a.isDefault);
  if (!hasDefault && merged.length > 0) merged[0].isDefault = true;

  const updatePayload: Record<string, unknown> = { accounts: merged, updatedAt: new Date() };
  if (body.notificationAccountId !== undefined) updatePayload.notificationAccountId = body.notificationAccountId;
  await ref.set(updatePayload, { merge: true });
  return NextResponse.json({ ok: true });
}
