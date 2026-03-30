import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export const runtime = 'nodejs';

const ALLOWED_FIELDS = ['firstname','lastname','businessName','phone','address','city','state','zip','industry','pr','website','annualrevenue','numemployees'];

export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const body = (await req.json()) as {
    email?: string;
    fields?: Record<string, string>; // multi-field update
    field?: string;                  // single-field update
    value?: string;
  };
  const { email } = body;
  if (!email) return NextResponse.json({ message: 'Missing email.' }, { status: 400 });

  // Normalise: support both { fields: {...} } and { field, value }
  const incoming: Record<string, string> = body.fields ?? {};
  if (body.field && body.value !== undefined) incoming[body.field] = body.value;
  if (Object.keys(incoming).length === 0)
    return NextResponse.json({ message: 'No fields provided.' }, { status: 400 });

  // Only allow whitelisted fields
  const safe: Record<string, string> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in incoming) safe[key] = String(incoming[key]);
  }

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  await db.collection('crm_contacts').doc(email).set({ ...safe, updatedAt: new Date() }, { merge: true });
  return NextResponse.json({ ok: true });
}
