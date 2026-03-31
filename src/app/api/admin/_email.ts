/**
 * Shared SMTP email helper — uses nodemailer with the US Business Grants mail server.
 * Config is driven by env vars so nothing sensitive is hardcoded here.
 *
 * Required env vars (set in .env.local and Vercel):
 *   SMTP_HOST        mail.usbusinessgrants.org
 *   SMTP_PORT        465
 *   SMTP_USER        noreply@usbusinessgrants.org
 *   SMTP_PASS        <password>
 *   SMTP_FROM        "US Business Grants" <noreply@usbusinessgrants.org>
 *
 *   SMTP_APPS_USER   applications@usbusinessgrants.org   (CRM outbound)
 *   SMTP_APPS_PASS   <password>
 */

import nodemailer from 'nodemailer';
import { getAdminFirebase } from './_shared';

function createTransport() {
  const host = process.env.SMTP_HOST || 'mail.usbusinessgrants.org';
  const port = Number(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER || 'noreply@usbusinessgrants.org';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || '"US Business Grants" <noreply@usbusinessgrants.org>';

  if (!pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,   // true for 465 (TLS), false for 587 (STARTTLS)
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // some shared hosts have self-signed certs
  });
}

export const FROM_ADDRESS =
  process.env.SMTP_FROM || '"US Business Grants" <noreply@usbusinessgrants.org>';

const PORTAL_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://portal.usbusinessgrants.org';

const LOGO_URL = 'https://usbusinessgrants.org/assets/flag-logo4.png';

/** Base HTML wrapper for all outgoing emails */
function baseTemplate(bodyHtml: string, unsubscribeUrl?: string) {
  const privacyUrl  = 'https://usbusinessgrants.org/privacy';
  const contactUrl  = 'https://usbusinessgrants.org/contact';
  const unsubLink   = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#4a6cf7;text-decoration:none;font-size:13px">Unsubscribe</a>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;border:1px solid #e2e8f0">
      <!-- Logo header -->
      <tr>
        <td align="center" style="padding:28px 32px 20px">
          <img src="${LOGO_URL}" alt="US Business Grants" height="52" style="display:block;height:52px;width:auto" />
        </td>
      </tr>
      <!-- Divider -->
      <tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0"></td></tr>
      <!-- Body -->
      <tr><td style="padding:32px 40px;font-size:14px;color:#1e293b;line-height:1.7">${bodyHtml}</td></tr>
      <!-- Footer -->
      <tr>
        <td style="border-top:1px dashed #cbd5e1;padding:20px 32px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top">
                <img src="${LOGO_URL}" alt="US Business Grants" height="36" style="display:block;height:36px;width:auto;margin-bottom:8px" />
                <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6">1 Boston Place<br>Boston, MA 02108</p>
              </td>
              <td style="vertical-align:top;text-align:right">
                <a href="${privacyUrl}" style="color:#4a6cf7;text-decoration:none;font-size:13px">Privacy</a><br>
                <a href="${contactUrl}" style="color:#4a6cf7;text-decoration:none;font-size:13px">Contact us</a><br>
                ${unsubLink}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** CTA button snippet */
function ctaButton(label: string, url: string) {
  return `<p style="margin:24px 0">
    <a href="${url}" style="background:#0E468F;color:#ffffff;padding:13px 28px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block">${label}</a>
  </p>`;
}

// ─── Unsubscribe helpers ─────────────────────────────────────────────────────

import crypto from 'crypto';

/** Get or create a stable unsubscribe token for an email address */
async function getUnsubToken(email: string): Promise<string> {
  try {
    const db = await getAdminFirebase();
    if (db) {
      const ref  = db.collection('crm_contacts').doc(email);
      const snap = await ref.get();
      const data = snap.data() as Record<string, unknown> | undefined;
      if (data?.unsubToken && typeof data.unsubToken === 'string') return data.unsubToken;
      const token = crypto.randomBytes(20).toString('hex');
      await ref.set({ unsubToken: token }, { merge: true });
      return token;
    }
  } catch { /* ignore */ }
  // Fallback — deterministic but not stored (won't work for unsubscribe page lookup)
  return crypto.createHash('sha256').update(email + (process.env.FIREBASE_ADMIN_PROJECT_ID ?? '')).digest('hex');
}

function unsubUrl(token: string) {
  return `${PORTAL_URL}/unsubscribe?token=${token}`;
}

/** Returns true if this contact has unsubscribed */
export async function isUnsubscribed(email: string): Promise<boolean> {
  try {
    const db = await getAdminFirebase();
    if (db) {
      const snap = await db.collection('crm_contacts').doc(email).get();
      return (snap.data() as Record<string, unknown> | undefined)?.unsubscribed === true;
    }
  } catch { /* ignore */ }
  return false;
}

// ─── Email senders ──────────────────────────────────────────────────────────

/** Notify a user that they have a new secure portal message */
export async function sendNewMessageEmail(opts: {
  to: string;
  name: string;
  body?: string;
}): Promise<void> {
  // Try to use the admin-configured notification account first
  let transport: nodemailer.Transporter | null = null;
  let fromAddress = FROM_ADDRESS;

  try {
    const db = await getAdminFirebase();
    if (db) {
      const snap = await db.doc('settings/crm_email').get();
      if (snap.exists) {
        const data = snap.data() as {
          accounts?: Array<{ id: string; fromName: string; user: string; pass: string; host: string; port: number; isDefault: boolean }>;
          notificationAccountId?: string;
        };
        const accounts = data.accounts ?? [];
        const notifAcct = (data.notificationAccountId
          ? accounts.find(a => a.id === data.notificationAccountId)
          : null) ?? accounts.find(a => a.isDefault) ?? accounts[0];
        if (notifAcct?.user && notifAcct?.pass) {
          const port = notifAcct.port || 465;
          transport = nodemailer.createTransport({
            host: notifAcct.host || 'mail.usbusinessgrants.org',
            port,
            secure: port === 465,
            auth: { user: notifAcct.user, pass: notifAcct.pass },
            tls: { rejectUnauthorized: false },
          });
          fromAddress = `"${notifAcct.fromName || 'US Business Grants'}" <${notifAcct.user}>`;
        }
      }
    }
  } catch (err) {
    console.warn('[sendNewMessageEmail] Could not load Firestore SMTP config, falling back to env:', err);
  }

  // Fall back to env-based transport
  if (!transport) transport = createTransport();

  if (!transport) {
    console.error('[sendNewMessageEmail] SMTP transport not configured — SMTP_PASS missing?');
    return;
  }

  const messageHtml = opts.body
    ? `<div style="background:#f8fafc;border-left:4px solid #0F4DBA;border-radius:4px;padding:16px 20px;margin:16px 0">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap">${escHtml(opts.body)}</p>
       </div>`
    : '';

  const unsubToken = await getUnsubToken(opts.to);
  const html = baseTemplate(`
    <p style="margin:0 0 16px">Dear ${escHtml(opts.name)},</p>
    <p style="margin:0 0 16px">You have received a secure message.</p>
    <p style="margin:0 0 16px">Please log in to your account to review the message, as it may include important updates regarding your selected grants, application progress, or next steps that may require your attention.</p>
    ${messageHtml}
    <p style="margin:0 0 24px">For your privacy and security, message details are not included in this email and can only be accessed within your secure account.</p>
    ${ctaButton('Log In to View Message', PORTAL_URL)}
    <p style="margin:24px 0 16px">We recommend reviewing your message promptly to ensure you do not miss any important or time-sensitive updates.</p>
    <p style="margin:0 0 16px">If you did not expect this notification or believe it was sent in error, please contact our support team. If you need help accessing your account or have any questions, our team is here to assist.</p>
    <p style="margin:0 0 4px">Sincerely,</p>
    <p style="margin:0 0 4px">US Business Grants Team</p>
    <p style="margin:0"><a href="mailto:support@usbusinessgrants.org" style="color:#4a6cf7;text-decoration:none">support@usbusinessgrants.org</a></p>
  `, unsubUrl(unsubToken));

  try {
    await transport.sendMail({
      from: fromAddress,
      to: opts.to,
      subject: 'New Message — US Business Grants',
      html,
    });
    console.log(`[sendNewMessageEmail] Sent to ${opts.to} from ${fromAddress}`);
  } catch (err) {
    console.error(`[sendNewMessageEmail] Failed to send to ${opts.to}:`, err);
    throw err;
  }
}

/** The progress step labels (must match STEP_LABELS in the admin UI) */
const STEP_LABELS = [
  'Application Received',
  'Administrative Review',
  'Finance Review',
  'Programmatic Review',
  'Grant Matches',
  'Sent',
];

/** Notify a user that their application status was updated */
export async function sendProgressUpdateEmail(opts: {
  to: string;
  name: string;
  progressStep: number;
  financeWarning?: boolean;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) return;

  const stepLabel = STEP_LABELS[opts.progressStep] ?? `Step ${opts.progressStep + 1}`;

  // Build a status timeline snippet
  const stepsHtml = STEP_LABELS.map((label, i) => {
    const done    = i <= opts.progressStep;
    const current = i === opts.progressStep;
    const dot     = done
      ? `<td style="width:14px;height:14px;background:#0F4DBA;border-radius:50%;vertical-align:middle"></td>`
      : `<td style="width:14px;height:14px;background:#e2e8f0;border-radius:50%;vertical-align:middle"></td>`;
    const text = current
      ? `<td style="padding:4px 0 4px 10px;font-size:13px;font-weight:bold;color:#0F4DBA">${escHtml(label)} ◀</td>`
      : done
        ? `<td style="padding:4px 0 4px 10px;font-size:13px;color:#64748b;text-decoration:line-through">${escHtml(label)}</td>`
        : `<td style="padding:4px 0 4px 10px;font-size:13px;color:#94a3b8">${escHtml(label)}</td>`;
    return `<tr>${dot}${text}</tr>`;
  }).join('');

  const financeWarningHtml = opts.financeWarning ? `
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin:16px 0">
      <p style="margin:0;font-size:13px;color:#854d0e;font-weight:600">⚠️ Finance Review Notice</p>
      <p style="margin:6px 0 0;font-size:13px;color:#92400e;line-height:1.5">
        Our team has flagged your application for additional finance review. Please log in to your portal for more information or to upload any requested documents.
      </p>
    </div>` : '';

  const unsubToken = await getUnsubToken(opts.to);
  const html = baseTemplate(`
    <p style="font-size:15px;color:#1e293b;margin:0 0 12px">Hello ${escHtml(opts.name)},</p>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px">
      Your grant application status has been updated to <strong>${escHtml(stepLabel)}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px">
      ${stepsHtml}
    </table>
    ${financeWarningHtml}
    ${ctaButton('View Application Status', PORTAL_URL)}
    <p style="font-size:13px;color:#94a3b8;margin:16px 0 0">
      Log in to your portal at any time to check your full application status and messages.
    </p>
  `, unsubUrl(unsubToken));

  await transport.sendMail({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: `Application Update: ${stepLabel} — US Business Grants`,
    html,
  });
}

/** Simple helper to escape HTML entities */
function escHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── CRM outbound (applications@) ───────────────────────────────────────────

async function createAppsTransport(accountId?: string): Promise<{ transport: nodemailer.Transporter; from: string } | null> {
  let host     = process.env.SMTP_HOST     || 'mail.usbusinessgrants.org';
  let port     = Number(process.env.SMTP_PORT || '465');
  let user     = process.env.SMTP_APPS_USER || '';
  let pass     = process.env.SMTP_APPS_PASS || '';
  let fromName = 'US Business Grants';

  try {
    const db = await getAdminFirebase();
    if (db) {
      const snap = await db.doc('settings/crm_email').get();
      if (snap.exists) {
        const data = snap.data() as { accounts?: Array<{ id: string; fromName: string; user: string; pass: string; host: string; port: number; isDefault: boolean }> };
        const accounts = data.accounts ?? [];
        if (accounts.length > 0) {
          const account = (accountId ? accounts.find(a => a.id === accountId) : null)
            ?? accounts.find(a => a.isDefault)
            ?? accounts[0];
          if (account.user && account.pass) {
            host = account.host || host;
            port = account.port || port;
            user = account.user;
            pass = account.pass;
            fromName = account.fromName || fromName;
          }
        }
      }
    }
  } catch { /* fall through to env defaults */ }

  if (!user || !pass) return null;

  // port 465 → implicit TLS (secure: true)
  // port 587 or anything else → STARTTLS (secure: false, requireTLS: true)
  const isImplicitTls = port === 465;
  const transport = nodemailer.createTransport({
    host, port,
    secure: isImplicitTls,
    requireTLS: !isImplicitTls,
    auth: { user, pass, method: 'LOGIN' } as { user: string; pass: string; method?: string },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
  } as Parameters<typeof nodemailer.createTransport>[0]);

  return { transport, from: `"${fromName}" <${user}>` };
}

export const APPS_FROM_ADDRESS =
  `"US Business Grants" <${process.env.SMTP_APPS_USER || 'applications@usbusinessgrants.org'}>`;

/**
 * Substitute {{variable}} placeholders in a template string.
 * Supported vars: name, firstName, lastName, businessName, email
 */
export function substituteTplVars(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Send a CRM email from applications@usbusinessgrants.org.
 * - default (plain text): body wrapped in baseTemplate with <br> linebreaks
 * - isHtml: true — body is HTML markup, wrapped in baseTemplate as-is
 * - rawHtml: true — body is a complete standalone HTML email, no wrapper
 */
export async function sendCrmEmail(opts: {
  to: string;
  subject: string;
  body: string;         // may contain {{name}} etc placeholders
  isHtml?: boolean;     // body is HTML content — wrap in baseTemplate as HTML
  rawHtml?: boolean;    // body is a complete email HTML — skip baseTemplate entirely
  vars?: Record<string, string>;
  fromAccountId?: string;
  skipUnsubCheck?: boolean;
}): Promise<void> {
  // Check unsubscribe (unless explicitly skipped)
  if (!opts.skipUnsubCheck && await isUnsubscribed(opts.to)) {
    console.log(`[sendCrmEmail] Skipping — ${opts.to} has unsubscribed`);
    return;
  }

  const result = await createAppsTransport(opts.fromAccountId);
  if (!result) return;
  const { transport, from } = result;

  const vars = opts.vars ?? {};
  const subject      = substituteTplVars(opts.subject, vars);
  const bodyResolved = substituteTplVars(opts.body, vars);

  // Generate unsubscribe URL
  const token  = await getUnsubToken(opts.to);
  const unsub  = unsubUrl(token);

  let html: string;
  if (opts.rawHtml) {
    html = bodyResolved;
  } else if (opts.isHtml) {
    html = baseTemplate(bodyResolved, unsub);
  } else {
    html = baseTemplate(
      `<div style="font-size:14px;color:#475569;line-height:1.7">${bodyResolved.replace(/\n/g, '<br>')}</div>`,
      unsub,
    );
  }

  await transport.sendMail({ from, to: opts.to, subject, html });
}
