export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkAdminAuth } from '../_shared';

async function getDb() {
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })});
  }
  return getFirestore();
}

function brevoListId(plan: string): number | null {
  const map: Record<string, string> = {
    starter: process.env.BREVO_LIST_ID_STARTER   ?? '',
    SF:      process.env.BREVO_LIST_ID_STARTER   ?? '',
    growth:  process.env.BREVO_LIST_ID_GROWTH    ?? '',
    EF:      process.env.BREVO_LIST_ID_GROWTH    ?? '',
    pro:     process.env.BREVO_LIST_ID_UNLIMITED ?? '',
    UF:      process.env.BREVO_LIST_ID_UNLIMITED ?? '',
    unlimited: process.env.BREVO_LIST_ID_UNLIMITED ?? '',
  };
  const raw = map[plan?.toLowerCase()] ?? map[plan] ?? '';
  return raw ? parseInt(raw, 10) : null;
}

// POST /api/admin/brevo-sync
// Body: { email: string }  — manually push a CRM contact to Brevo
export async function POST(req: Request) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = process.env.BREVO_API_KEY;
  if (!key) return NextResponse.json({ error: 'BREVO_API_KEY not set' }, { status: 500 });

  const { email } = (await req.json()) as { email?: string };
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Load contact from Firestore
  const db = await getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const snap = await db.collection('crm_contacts').doc(email.toLowerCase().trim()).get();
  if (!snap.exists) return NextResponse.json({ error: 'Contact not found in CRM' }, { status: 404 });

  const c = snap.data() as Record<string, unknown>;

  // Determine plan / list
  const plan    = (c.plan ?? c.pr ?? '') as string;
  const listId  = brevoListId(plan);

  const firstName  = (c.firstName  ?? '') as string;
  const lastName   = (c.lastName   ?? '') as string;
  const fundUses   = Array.isArray(c.fundUses) ? (c.fundUses as string[]).join(',') : ((c.fundUses ?? '') as string);

  const zip = (c.zipCode ?? '') as string;
  const attributes: Record<string, string> = {
    FIRSTNAME:       firstName,
    LASTNAME:        lastName,
    BUSINESS_NAME:   (c.businessName   ?? '') as string,
    STATE:           (c.state          ?? '') as string,
    FUND_USES:       fundUses,
    MONTHLY_REVENUE: (c.monthlyRevenue ?? '') as string,
    WEBSITE:         (c.website        ?? '') as string,
    PLAN:            plan,
    ZIP:             zip,
    EXT_ID:          zip,
  };

  const body: Record<string, unknown> = {
    email: email.toLowerCase().trim(),
    attributes,
    updateEnabled: true,
  };
  if (listId) body.listIds = [listId];

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Brevo manual sync failed (${res.status}):`, errText);
    return NextResponse.json({ error: `Brevo error ${res.status}: ${errText}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, listId, plan });
}
