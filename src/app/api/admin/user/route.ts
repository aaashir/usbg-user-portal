import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const email = new URL(req.url).searchParams.get('email') ?? '';
  if (!email) return NextResponse.json({ message: 'Missing email.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  // Fetch all data in parallel — no sequential awaits
  const [contactSnap, docsSnap, overrideSnap, notesSnap, msgsSnap] = await Promise.all([
    db.collection('crm_contacts').doc(email).get(),
    db.collection('check_status_app').doc(email).collection('documents').get(),
    db.collection('check_status_app').doc(email).collection('admin').doc('settings').get().catch(() => null),
    db.collection('crm_contacts').doc(email).collection('notes').orderBy('createdAt', 'desc').get().catch(() => null),
    db.collection('check_status_app').doc(email).collection('messages').orderBy('sentAt', 'desc').get().catch(() => null),
  ]);

  const contactData = contactSnap.exists ? (contactSnap.data() as Record<string, unknown>) : {};

  // Normalise into a flat properties map (same shape the detail page expects)
  // Handle both camelCase (signup flow / HubSpot sync) and lowercase (legacy) field names
  const properties: Record<string, string | null> = {
    firstname:    String(contactData.firstName   ?? contactData.firstname   ?? ''),
    lastname:     String(contactData.lastName    ?? contactData.lastname    ?? ''),
    email:        String(contactData.email        ?? email),
    company:      String(contactData.businessName ?? contactData.company    ?? ''),
    phone:        String(contactData.phone        ?? ''),
    address:      String(contactData.address      ?? ''),
    city:         String(contactData.city         ?? ''),
    state:        String(contactData.state        ?? ''),
    zip:          String(contactData.zipCode      ?? contactData.zip        ?? ''),
    business_type:String(contactData.business_type ?? ''),
    industry:     String(contactData.industry     ?? ''),
    annualrevenue:String(contactData.annualrevenue ?? ''),
    numemployees: String(contactData.numemployees ?? ''),
    website:      String(contactData.website      ?? ''),
    pr:           String(contactData.pr           ?? ''),
    createdate:   String(contactData.createDate   ?? ''),
    unsubscribed: contactData.unsubscribed === true ? 'true' : '',
    fundingUse:   (() => {
      const val = contactData.fundingUse ?? contactData.fundinguse ?? contactData.fundUses;
      if (Array.isArray(val)) return (val as unknown[]).map(String).join(', ');
      return String(val ?? '');
    })(),
  };

  // Documents
  const docs: Record<string, { key: string; label?: string; filename?: string; url?: string }> = {};
  docsSnap.forEach((d: { id: string; data(): Record<string, unknown> }) => {
    const data = d.data();
    docs[d.id] = {
      key: d.id,
      label: typeof data.label === 'string' ? data.label : undefined,
      filename: typeof data.filename === 'string' ? data.filename : undefined,
      url: typeof data.url === 'string' ? data.url : undefined,
    };
  });

  // Progress override
  const progressOverride: Record<string, unknown> | null =
    overrideSnap?.exists ? (overrideSnap.data() as Record<string, unknown>) : null;

  // Notes
  type NoteItem = { id: string; body: string; createdAt: string };
  const notes: NoteItem[] = [];
  notesSnap?.forEach((d: { id: string; data(): Record<string, unknown> }) => {
    const nd = d.data();
    const ts = nd.createdAt as { toDate?: () => Date } | string | null;
    const dateStr = ts && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function'
      ? ts.toDate().toISOString()
      : typeof ts === 'string' ? ts : '';
    notes.push({ id: d.id, body: String(nd.body ?? ''), createdAt: dateStr });
  });

  // Messages
  type MsgItem = { id: string; body: string; sentAt: string; read: boolean };
  const messages: MsgItem[] = [];
  msgsSnap?.forEach((d: { id: string; data(): Record<string, unknown> }) => {
    const md = d.data();
    const ts = md.sentAt as { toDate?: () => Date } | string | null;
    const dateStr = ts && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function'
      ? ts.toDate().toISOString()
      : typeof ts === 'string' ? ts : '';
    messages.push({ id: d.id, body: String(md.body ?? ''), sentAt: dateStr, read: Boolean(md.read) });
  });

  // ── Extra form fields — all non-system fields not already in properties ──
  // These come from form submissions that used custom propertyKeys.
  const SYSTEM_KEYS = new Set([
    'hubspotId', 'hsProperties', 'importedAt', 'importSource',
    'updatedAt', 'createdAt', 'formSource', 'stripeSessionId', 'source',
    // already shown in properties:
    'firstName', 'lastname', 'firstName', 'lastname', 'firstname', 'lastName',
    'email', 'phone', 'businessName', 'company', 'address', 'city', 'state',
    'zip', 'zipCode', 'business_type', 'industry', 'annualrevenue', 'numemployees',
    'website', 'pr', 'createDate', 'fundingUse', 'fundinguse', 'fundUses',
  ]);

  const formData: Record<string, string> = {};
  for (const [k, v] of Object.entries(contactData)) {
    if (SYSTEM_KEYS.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    // Handle arrays — join as comma-separated string
    if (Array.isArray(v)) {
      if (v.length > 0) formData[k] = (v as unknown[]).map(String).join(', ');
      continue;
    }
    // Skip other objects (Timestamps, nested objects) — only flat string/number values
    if (typeof v === 'object') continue;
    formData[k] = String(v);
  }

  return NextResponse.json({ properties, docs, progressOverride, notes, messages, formData });
}
