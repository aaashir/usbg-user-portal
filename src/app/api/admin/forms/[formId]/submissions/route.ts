export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase, checkAdminAuth } from '../../../_shared';
import { FieldValue } from 'firebase-admin/firestore';

type Ctx = { params: Promise<{ formId: string }> };

// GET — list all submissions
export async function GET(req: Request, ctx: Ctx) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId } = await ctx.params;
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const snap = await db
    .collection('forms').doc(formId).collection('submissions')
    .orderBy('submittedAt', 'desc').get();

  const submissions = snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, ...data, submittedAt: data.submittedAt?.toDate?.()?.toISOString() ?? null };
  });

  return NextResponse.json({ submissions });
}

// DELETE — delete a single submission by id (?id=xxx) or all (?all=1)
export async function DELETE(req: Request, ctx: Ctx) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const id  = searchParams.get('id');
  const all = searchParams.get('all') === '1';

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const formRef = db.collection('forms').doc(formId);
  const subsRef = formRef.collection('submissions');

  if (all) {
    const snap = await subsRef.get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await formRef.update({ submissionCount: 0 });
    return NextResponse.json({ ok: true, deleted: snap.size });
  }

  if (id) {
    await subsRef.doc(id).delete();
    await formRef.update({ submissionCount: FieldValue.increment(-1) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Provide ?id=xxx or ?all=1' }, { status: 400 });
}
