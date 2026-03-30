import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../../_shared';

export const runtime = 'nodejs';

/** PUT /api/admin/email-templates/[id] — update a template */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { id } = await params;
  const body = await req.json() as { name?: string; subject?: string; body?: string; isHtml?: boolean };

  await db.collection('crm_email_templates').doc(id).update({
    ...(body.name    !== undefined && { name: body.name.trim() }),
    ...(body.subject !== undefined && { subject: body.subject.trim() }),
    ...(body.body    !== undefined && { body: body.body }),
    ...(body.isHtml  !== undefined && { isHtml: body.isHtml }),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/email-templates/[id] — delete a template */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { id } = await params;
  await db.collection('crm_email_templates').doc(id).delete();
  return NextResponse.json({ ok: true });
}
