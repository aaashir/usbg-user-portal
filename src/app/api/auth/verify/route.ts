export const runtime = 'nodejs';

// POST /api/auth/verify
// Checks crm_contacts in Firestore by email + zip.
// Used as fallback when the HubSpot Cloud Function doesn't find the user
// (e.g. new signups from the signup flow who aren't in HubSpot yet).

import { NextResponse } from 'next/server';
import { getAdminFirebase } from '../../admin/_shared';

const VALID_PR = new Set(['SF', 'EF', 'UF', 'TRUE', 'starter', 'growth', 'pro']);

export async function POST(req: Request) {
  const { email, zipCode } = await req.json() as { email?: string; zipCode?: string };

  if (!email || !zipCode) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ found: false }, { status: 500 });

  const doc = await db
    .collection('crm_contacts')
    .doc(email.toLowerCase().trim())
    .get();

  if (!doc.exists) {
    return NextResponse.json({ found: false });
  }

  const data = doc.data()!;
  const storedZip = String(data.zipCode ?? data.zip ?? '').trim();
  const pr        = String(data.pr ?? '').trim();

  // Zip must match
  if (storedZip !== zipCode.trim()) {
    return NextResponse.json({ found: true, zipMismatch: true });
  }

  // Must have a valid subscription tier
  if (!VALID_PR.has(pr)) {
    return NextResponse.json({ found: true, noAccess: true });
  }

  // Resolve createdAt — stored as Firestore Timestamp or ISO string
  const rawCreatedAt = data.createdAt ?? data.createDate ?? null;
  let createdAt: string | null = null;
  if (rawCreatedAt) {
    if (typeof rawCreatedAt === 'string') {
      createdAt = rawCreatedAt;
    } else if (typeof rawCreatedAt.toDate === 'function') {
      createdAt = (rawCreatedAt.toDate() as Date).toISOString();
    }
  }

  // Return a shape compatible with what the portal expects from HubSpot
  return NextResponse.json({
    found: true,
    contact: {
      createdAt: createdAt ?? undefined,
      properties: {
        email:     data.email      ?? '',
        firstname: data.firstName  ?? '',
        lastname:  data.lastName   ?? '',
        zip:       storedZip,
        state:     data.state      ?? '',
        phone:     data.phone      ?? '',
        company:   data.businessName ?? '',
        pr,
      },
    },
  });
}
