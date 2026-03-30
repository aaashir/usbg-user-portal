import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export const runtime = 'nodejs';

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isHtml: boolean;
  createdAt: string;
  updatedAt: string;
};

/** GET /api/admin/email-templates — list all templates */
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const snap = await db.collection('crm_email_templates').orderBy('createdAt', 'desc').get();
  const templates: EmailTemplate[] = [];
  snap.forEach(d => {
    const data = d.data() as Record<string, unknown>;
    const ts = (t: unknown) => {
      if (t && typeof t === 'object' && 'toDate' in t && typeof (t as { toDate: () => Date }).toDate === 'function')
        return (t as { toDate: () => Date }).toDate().toISOString();
      return typeof t === 'string' ? t : new Date().toISOString();
    };
    templates.push({
      id: d.id,
      name: String(data.name ?? ''),
      subject: String(data.subject ?? ''),
      body: String(data.body ?? ''),
      isHtml: Boolean(data.isHtml ?? false),
      createdAt: ts(data.createdAt),
      updatedAt: ts(data.updatedAt),
    });
  });

  return NextResponse.json(templates);
}

/** POST /api/admin/email-templates — create a template */
export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const body = await req.json() as { name?: string; subject?: string; body?: string; isHtml?: boolean };
  if (!body.name?.trim()) return NextResponse.json({ message: 'Name is required.' }, { status: 400 });

  const now = new Date();
  const ref = await db.collection('crm_email_templates').add({
    name: body.name.trim(),
    subject: (body.subject ?? '').trim(),
    body: (body.body ?? '').trim(),
    isHtml: body.isHtml ?? false,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: ref.id, ok: true });
}
