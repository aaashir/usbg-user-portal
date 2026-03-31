export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../../_shared';
import { FieldValue } from 'firebase-admin/firestore';

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/lists/[id] — get a single list with contacts */
export async function GET(req: Request, { params }: Params) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  const { id } = await params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const snap = await db.collection('crm_lists').doc(id).get();
  if (!snap.exists) return NextResponse.json({ message: 'Not found.' }, { status: 404 });

  const data = snap.data() as Record<string, unknown>;
  return NextResponse.json({
    id:            snap.id,
    name:          String(data.name        ?? ''),
    description:   String(data.description ?? ''),
    contactEmails: Array.isArray(data.contactEmails) ? (data.contactEmails as string[]) : [],
  });
}

/** PUT /api/admin/lists/[id] — update name/description or add/remove contacts */
export async function PUT(req: Request, { params }: Params) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  const { id } = await params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const body = await req.json() as {
    name?: string;
    description?: string;
    addEmails?: string[];
    removeEmails?: string[];
    contactEmails?: string[]; // full replace
  };

  const ref = db.collection('crm_lists').doc(id);
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (body.name        !== undefined) update.name        = body.name.trim();
  if (body.description !== undefined) update.description = body.description.trim();

  if (body.contactEmails !== undefined) {
    // Full replace
    update.contactEmails = body.contactEmails;
  } else {
    // Partial add/remove via array union/remove
    if (body.addEmails?.length) update.contactEmails = FieldValue.arrayUnion(...body.addEmails);
    if (body.removeEmails?.length) update.contactEmails = FieldValue.arrayRemove(...body.removeEmails);
  }

  await ref.update(update);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/lists/[id] — delete a list */
export async function DELETE(req: Request, { params }: Params) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  const { id } = await params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  await db.collection('crm_lists').doc(id).delete();
  return NextResponse.json({ ok: true });
}
