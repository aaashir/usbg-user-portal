export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase, checkAdminAuth } from '../_shared';
import { FieldValue } from 'firebase-admin/firestore';

function uid() { return Math.random().toString(36).slice(2, 10); }

// Every form always starts with a locked email field
const EMAIL_FIELD = {
  id: 'email_field',
  type: 'email',
  label: 'Email Address',
  placeholder: 'Enter your email',
  required: true,
  options: [],
  propertyKey: 'email',
  locked: true, // cannot be deleted or have required toggled off
};

// GET /api/admin/forms — list all forms
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const snap = await db.collection('forms').orderBy('createdAt', 'desc').get();
  const forms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ forms });
}

// POST /api/admin/forms — create a new form (always with email field)
export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const body = await req.json();
  const { name, description, status } = body;

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  // Ensure the email field is always the first field with a stable id
  const emailField = { ...EMAIL_FIELD, id: `email_${uid()}` };

  const docRef = await db.collection('forms').add({
    name,
    description: description || '',
    fields: [emailField],
    status: status || 'draft',
    submissionCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: docRef.id });
}
