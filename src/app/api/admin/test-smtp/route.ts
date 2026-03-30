export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

type SmtpAccount = {
  id: string; fromName: string; user: string; pass: string;
  host: string; port: number; isDefault: boolean;
};

/**
 * GET /api/admin/test-smtp
 * Tests every account saved in Firestore settings/crm_email.
 * Falls back to env vars if no Firestore config exists yet.
 */
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  // Load accounts from Firestore
  let accounts: SmtpAccount[] = [];
  try {
    const db = await getAdminFirebase();
    if (db) {
      const snap = await db.doc('settings/crm_email').get();
      if (snap.exists) {
        const data = snap.data() as { accounts?: SmtpAccount[] };
        accounts = Array.isArray(data.accounts) ? data.accounts : [];
      }
    }
  } catch { /* fall through */ }

  // If nothing in Firestore, fall back to env vars
  if (accounts.length === 0) {
    accounts = [
      {
        id: 'env-apps', fromName: 'applications@ (env)',
        user: process.env.SMTP_APPS_USER || '',
        pass: process.env.SMTP_APPS_PASS || '',
        host: process.env.SMTP_HOST || 'mail.usbusinessgrants.org',
        port: Number(process.env.SMTP_PORT || 465),
        isDefault: true,
      },
    ];
  }

  async function verify(account: SmtpAccount) {
    const { id, fromName, user, pass, host, port } = account;
    const label = fromName ? `${fromName} <${user}>` : user;
    if (!user || !pass) return { id, label, ok: false, error: 'Credentials not configured', user };
    const isImplicitTls = port === 465;
    const transport = nodemailer.createTransport({
      host, port,
      secure: isImplicitTls,
      requireTLS: !isImplicitTls,
      auth: { user, pass },
      authMethod: 'LOGIN',
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout:   10000,
    });
    try {
      await transport.verify();
      return { id, label, ok: true, user };
    } catch (err) {
      return { id, label, ok: false, user, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const results = await Promise.all(accounts.map(verify));
  const allOk = results.every(r => r.ok);

  return NextResponse.json({ allOk, results }, { status: allOk ? 200 : 500 });
}
