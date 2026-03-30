export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase, checkAdminAuth } from '../../_shared';
import { FieldValue } from 'firebase-admin/firestore';

type Ctx = { params: Promise<{ formId: string }> };

// GET /api/admin/forms/[formId] — get form + fields
export async function GET(req: Request, ctx: Ctx) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId } = await ctx.params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const doc = await db.collection('forms').doc(formId).get();
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ id: doc.id, ...doc.data() });
}

// PUT /api/admin/forms/[formId] — update form
export async function PUT(req: Request, ctx: Ctx) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId } = await ctx.params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const body = await req.json();
  const { name, description, fields, status } = body;

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (fields !== undefined) update.fields = fields;
  if (status !== undefined) update.status = status;

  await db.collection('forms').doc(formId).update(update);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/forms/[formId] — delete form
export async function DELETE(req: Request, ctx: Ctx) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId } = await ctx.params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  await db.collection('forms').doc(formId).delete();
  return NextResponse.json({ ok: true });
}
