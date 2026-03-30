export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../../../admin/_shared';
import { FieldValue } from 'firebase-admin/firestore';

type Ctx = { params: Promise<{ formId: string }> };

type FormField = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  propertyKey?: string; // maps to crm_contacts field
};

// POST /api/forms/[formId]/submit — public, no auth needed
export async function POST(req: Request, ctx: Ctx) {
  const { formId } = await ctx.params;

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  // Verify form exists and is active
  const formDoc = await db.collection('forms').doc(formId).get();
  if (!formDoc.exists) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  const form = formDoc.data()!;
  if (form.status !== 'active') {
    return NextResponse.json({ error: 'Form is not accepting submissions' }, { status: 403 });
  }

  const body = await req.json() as Record<string, string>;
  const referer = req.headers.get('referer') || req.headers.get('origin') || '';
  const fields: FormField[] = form.fields ?? [];

  // ── Build labelled submission data (field label → value for readability)
  const labelledData: Record<string, string> = {};
  for (const field of fields) {
    const val = body[field.id] ?? '';
    labelledData[field.label] = val;
  }

  // ── Save raw submission
  await db.collection('forms').doc(formId).collection('submissions').add({
    data: body,          // raw: fieldId → value
    labelled: labelledData, // readable: label → value
    submittedAt: FieldValue.serverTimestamp(),
    source: referer,
  });

  // ── Increment form counter
  await db.collection('forms').doc(formId).update({
    submissionCount: FieldValue.increment(1),
  });

  // ── Upsert contact in crm_contacts ─────────────────────────────────────────
  // Find the email field (by propertyKey='email' or type='email')
  const emailField = fields.find(
    f => f.propertyKey === 'email' || (f.type === 'email' && !f.propertyKey)
  );
  const emailValue = emailField ? (body[emailField.id] ?? '').trim().toLowerCase() : '';

  if (emailValue) {
    // Build contact patch from all fields that have a propertyKey set
    const contactPatch: Record<string, string> = {};
    for (const field of fields) {
      if (field.propertyKey && body[field.id] !== undefined && body[field.id] !== '') {
        contactPatch[field.propertyKey] = body[field.id];
      }
    }

    // Always set email
    contactPatch.email = emailValue;

    const contactRef = db.collection('crm_contacts').doc(emailValue);
    const existing = await contactRef.get();

    if (existing.exists) {
      // Update existing contact — never overwrite createDate
      const { createDate: _cd, ...patchWithoutDate } = contactPatch;
      await contactRef.set(
        { ...patchWithoutDate, updatedAt: new Date(), formSource: formId },
        { merge: true }
      );
    } else {
      // Create new contact
      await contactRef.set({
        ...contactPatch,
        createDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: new Date(),
        formSource: formId,
        pr: contactPatch.pr ?? '',
      });
    }
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// OPTIONS for CORS (embed on other sites)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
