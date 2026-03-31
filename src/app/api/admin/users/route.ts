import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export const runtime = 'nodejs';

const SELECTED_FIELDS = [
  'firstname', 'lastname', 'firstName', 'lastName',
  'businessName', 'email', 'phone',
  'state', 'pr', 'industry', 'createDate', 'zip', 'zipCode', 'fundingUse',
];

function docToContact(d: { id: string; data(): Record<string, unknown> }) {
  const data = d.data();
  return {
    id:          d.id,
    firstname:   String(data.firstName   ?? data.firstname   ?? ''),
    lastname:    String(data.lastName    ?? data.lastname    ?? ''),
    company:     String(data.businessName ?? data.company    ?? ''),
    email:       String(data.email        ?? d.id),
    phone:       String(data.phone        ?? ''),
    state:       String(data.state        ?? ''),
    pr:          String(data.pr           ?? ''),
    createdate:  String(data.createDate   ?? ''),
    industry:    String(data.industry     ?? ''),
    zip:         String(data.zipCode     ?? data.zip         ?? ''),
    fundingUse:  String(data.fundingUse   ?? data.fundinguse  ?? ''),
  };
}

type Contact = ReturnType<typeof docToContact>;

function sortContacts(list: Contact[], key: string, dir: string) {
  return [...list].sort((a, b) => {
    let va = '', vb = '';
    if      (key === 'name')  { va = `${a.firstname} ${a.lastname}`.toLowerCase(); vb = `${b.firstname} ${b.lastname}`.toLowerCase(); }
    else if (key === 'email') { va = a.email;      vb = b.email; }
    else if (key === 'pr')    { va = a.pr;         vb = b.pr; }
    else if (key === 'state') { va = a.state;      vb = b.state; }
    else                      { va = a.createdate; vb = b.createdate; }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });
}

export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit    = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const search   = (searchParams.get('search') ?? '').toLowerCase().trim();
  const prFilter = (searchParams.get('pr') ?? '').trim();
  const stateFilter = (searchParams.get('state') ?? '').trim();
  const industryFilter = (searchParams.get('industry') ?? '').trim();
  const fundingFilter  = (searchParams.get('fundinguse') ?? '').trim();
  const sortKey  = searchParams.get('sort') ?? 'createdate';
  const sortDir  = searchParams.get('dir')  ?? 'desc';

  const col = db.collection('crm_contacts');

  // ── Tier counts (always needed for tab badges) ───────────────────────────
  const [sfSnap, sfTrueSnap, efSnap, ufSnap, totalSnap] = await Promise.all([
    col.where('pr', '==', 'SF').count().get(),
    col.where('pr', '==', 'TRUE').count().get(),
    col.where('pr', '==', 'EF').count().get(),
    col.where('pr', '==', 'UF').count().get(),
    col.count().get(),
  ]);
  const sfCount    = (sfSnap.data() as { count: number }).count + (sfTrueSnap.data() as { count: number }).count;
  const efCount    = (efSnap.data() as { count: number }).count;
  const ufCount    = (ufSnap.data() as { count: number }).count;
  const grandTotal = (totalSnap.data() as { count: number }).count;
  const counts = {
    sf:   sfCount,
    ef:   efCount,
    uf:   ufCount,
    lead: Math.max(0, grandTotal - sfCount - efCount - ufCount),
  };

  // ── No filters — fast paginated query ───────────────────────────────────
  if (!search && !prFilter && !stateFilter && !industryFilter && !fundingFilter) {
    const snap = await col
      .select(...SELECTED_FIELDS)
      .orderBy('createDate', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .get();

    return NextResponse.json({
      contacts:   snap.docs.map(docToContact),
      total:      grandTotal,
      page,
      totalPages: Math.max(1, Math.ceil(grandTotal / limit)),
      counts,
    });
  }

  // ── Filters active — server-side filtering ───────────────────────────────
  let docs: Contact[] = [];

  if (search) {
    // Exact email match — email is the doc ID, so this is O(1)
    const isExactEmail = search.includes('@');
    if (isExactEmail) {
      const docSnap = await col.doc(search).get();
      if (docSnap.exists) {
        const rawData = docSnap.data() ?? {};
        docs = [docToContact({ id: docSnap.id, data: () => rawData as Record<string, unknown> })];
      } else {
        // Might have a slightly different case — fall through to prefix search
        const snap = await col
          .select(...SELECTED_FIELDS)
          .where('email', '>=', search)
          .where('email', '<=', search + '\uf8ff')
          .get();
        docs = snap.docs.map(docToContact);
      }
    } else {
      // Prefix search on email field (uses auto single-field index)
      const snap = await col
        .select(...SELECTED_FIELDS)
        .where('email', '>=', search)
        .where('email', '<=', search + '\uf8ff')
        .get();
      docs = snap.docs.map(docToContact);

      // Also search firstname/lastname prefix
      const [fnSnap, lnSnap] = await Promise.all([
        col.select(...SELECTED_FIELDS).where('firstname', '>=', search).where('firstname', '<=', search + '\uf8ff').get(),
        col.select(...SELECTED_FIELDS).where('lastname',  '>=', search).where('lastname',  '<=', search + '\uf8ff').get(),
      ]);
      const seen = new Set(docs.map(d => d.id));
      for (const d of [...fnSnap.docs, ...lnSnap.docs]) {
        if (!seen.has(d.id)) { seen.add(d.id); docs.push(docToContact(d)); }
      }
    }

    // Apply PR + state + industry + fundingUse filters on the (already small) result set
    if (prFilter === 'LEAD') {
      const PLAN_VALUES = new Set(['SF', 'TRUE', 'EF', 'UF']);
      docs = docs.filter(c => !PLAN_VALUES.has(c.pr));
    } else if (prFilter) {
      docs = docs.filter(c => c.pr === prFilter || (prFilter === 'SF' && c.pr === 'TRUE'));
    }
    if (stateFilter)    docs = docs.filter(c => c.state      === stateFilter);
    if (industryFilter) docs = docs.filter(c => c.industry   === industryFilter);
    if (fundingFilter)  docs = docs.filter(c => c.fundingUse === fundingFilter);

  } else if (prFilter === 'LEAD') {
    // Leads — contacts with no recognised plan value; must fetch all and filter
    const PLAN_VALUES = new Set(['SF', 'TRUE', 'EF', 'UF']);
    const snap = await col.select(...SELECTED_FIELDS).get();
    docs = snap.docs.map(docToContact).filter(c => !PLAN_VALUES.has(c.pr));
    if (stateFilter)    docs = docs.filter(c => c.state      === stateFilter);
    if (industryFilter) docs = docs.filter(c => c.industry   === industryFilter);
    if (fundingFilter)  docs = docs.filter(c => c.fundingUse === fundingFilter);

  } else if (prFilter) {
    // PR tab filter — fetch the whole tier subset (max ~1300), sort in-memory
    const prValues = prFilter === 'SF' ? ['SF', 'TRUE'] : [prFilter];
    const snaps = await Promise.all(
      prValues.map(v => col.select(...SELECTED_FIELDS).where('pr', '==', v).get())
    );
    const seen = new Set<string>();
    for (const snap of snaps) {
      for (const d of snap.docs) {
        if (!seen.has(d.id)) { seen.add(d.id); docs.push(docToContact(d)); }
      }
    }

    if (stateFilter)    docs = docs.filter(c => c.state      === stateFilter);
    if (industryFilter) docs = docs.filter(c => c.industry   === industryFilter);
    if (fundingFilter)  docs = docs.filter(c => c.fundingUse === fundingFilter);

  } else if (stateFilter && !industryFilter && !fundingFilter) {
    // State-only filter
    const snap = await col.select(...SELECTED_FIELDS).where('state', '==', stateFilter).get();
    docs = snap.docs.map(docToContact);
  } else {
    // Industry/funding-only or combined — fetch all and filter in-memory
    const snap = await col.select(...SELECTED_FIELDS).get();
    docs = snap.docs.map(docToContact);
    if (stateFilter)    docs = docs.filter(c => c.state      === stateFilter);
    if (industryFilter) docs = docs.filter(c => c.industry   === industryFilter);
    if (fundingFilter)  docs = docs.filter(c => c.fundingUse === fundingFilter);
  }

  // Sort + paginate in-memory
  const sorted     = sortContacts(docs, sortKey, sortDir);
  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset     = (page - 1) * limit;
  const pageSlice  = sorted.slice(offset, offset + limit);

  return NextResponse.json({ contacts: pageSlice, total, page, totalPages, counts });
}

export async function DELETE(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });

  const batch = db.batch();
  ids.forEach(id => batch.delete(db.collection('crm_contacts').doc(id)));
  await batch.commit();

  return NextResponse.json({ ok: true, deleted: ids.length });
}
