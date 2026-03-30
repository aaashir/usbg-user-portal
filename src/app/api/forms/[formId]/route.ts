export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../../admin/_shared';

type Ctx = { params: Promise<{ formId: string }> };

// GET /api/forms/[formId] — public, returns form schema (no submissions, no auth needed)
export async function GET(_req: Request, ctx: Ctx) {
  const { formId } = await ctx.params;

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const doc = await db.collection('forms').doc(formId).get();
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = doc.data()!;

  // Return only what the public form page needs (no submission data)
  return NextResponse.json(
    {
      id: doc.id,
      name: data.name,
      description: data.description,
      status: data.status,
      fields: data.fields ?? [],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
