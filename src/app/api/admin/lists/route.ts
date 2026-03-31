export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';
import { FieldValue } from 'firebase-admin/firestore';

/** GET /api/admin/lists — list all custom contact lists */
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const snap = await db.collection('crm_lists').orderBy('createdAt', 'desc').get();
  const lists = snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    const ts = data.createdAt as { toDate?: () => Date } | null;
    return {
      id:          d.id,
      name:        String(data.name        ?? ''),
      description: String(data.description ?? ''),
      contactEmails: Array.isArray(data.contactEmails) ? (data.contactEmails as string[]) : [],
      count:       Array.isArray(data.contactEmails) ? (data.contactEmails as string[]).length : 0,
      createdAt:   ts && typeof ts === 'object' && ts.toDate ? ts.toDate().toISOString() : '',
    };
  });
  return NextResponse.json(lists);
}

/** POST /api/admin/lists — create a new list */
export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const body = await req.json() as { name?: string; description?: string; contactEmails?: string[] };
  if (!body.name?.trim()) return NextResponse.json({ message: 'name is required.' }, { status: 400 });

  const ref = await db.collection('crm_lists').add({
    name:          body.name.trim(),
    description:   body.description?.trim() ?? '',
    contactEmails: body.contactEmails ?? [],
    createdAt:     FieldValue.serverTimestamp(),
    updatedAt:     FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true, id: ref.id });
}
