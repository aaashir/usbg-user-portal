/**
 * One-time script: import ALL HubSpot contacts with ALL properties → Firestore crm_contacts/{email}
 * Usage: node scripts/hubspot-api-import.mjs
 *
 * Requires in .env.local:
 *   HUBSPOT_API_KEY=pat-na1-xxxx
 *   FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
const envVars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  envVars[key] = val;
}

const HUBSPOT_TOKEN = envVars.HUBSPOT_API_KEY || '';
const projectId     = envVars.FIREBASE_ADMIN_PROJECT_ID || '';
const clientEmail   = envVars.FIREBASE_ADMIN_CLIENT_EMAIL || '';
const privateKey    = (envVars.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!HUBSPOT_TOKEN) { console.error('❌  Missing HUBSPOT_API_KEY in .env.local'); process.exit(1); }
if (!projectId || !clientEmail || !privateKey) { console.error('❌  Missing Firebase admin credentials in .env.local'); process.exit(1); }

// ── Init Firebase ─────────────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

const HS_HEADERS = {
  Authorization: `Bearer ${HUBSPOT_TOKEN}`,
  'Content-Type': 'application/json',
};

// ── Step 1: Fetch all property names ─────────────────────────────────────────
async function getAllPropertyNames() {
  console.log('📋  Fetching all HubSpot contact property definitions...');
  const res = await fetch('https://api.hubapi.com/crm/v3/properties/contacts?limit=1000', {
    headers: HS_HEADERS,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot properties API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const names = (data.results || []).map(p => p.name);
  console.log(`   Found ${names.length} properties`);
  return names;
}

// ── Step 2: Fetch all contacts (paginated) ────────────────────────────────────
async function fetchAllContacts(propertyNames) {
  const contacts = [];
  // HubSpot limits to 250 properties per request via query param; chunk if needed
  const PROP_CHUNK = 250;
  const propChunks = [];
  for (let i = 0; i < propertyNames.length; i += PROP_CHUNK) {
    propChunks.push(propertyNames.slice(i, i + PROP_CHUNK));
  }

  // We'll use the first chunk for pagination (to get all contact IDs + core props),
  // then fetch remaining prop chunks per-page via the same cursor approach.
  // Simplest approach: fetch all contacts with all props using multiple parallel requests per page.
  // Actually HubSpot v3 supports up to 100 contacts/page and all props in one call if we batch props.

  let after = undefined;
  let page = 0;

  console.log('\n📥  Fetching contacts from HubSpot...');

  while (true) {
    // Build URL — pass all props joined (HubSpot accepts them all)
    const propsParam = propertyNames.join(',');
    const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', propsParam);
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url.toString(), { headers: HS_HEADERS });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot contacts API error ${res.status}: ${body}`);
    }
    const data = await res.json();
    const results = data.results || [];
    contacts.push(...results);

    page++;
    const paging = data.paging?.next;
    console.log(`   Page ${page}: fetched ${results.length} contacts (total so far: ${contacts.length})`);

    if (!paging) break;
    after = paging.after;

    // Respect HubSpot rate limit (100 req/10s for private apps)
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\n   ✅ Total contacts fetched: ${contacts.length}`);
  return contacts;
}

// ── Step 3: Upsert to Firestore ───────────────────────────────────────────────
async function upsertToFirestore(contacts) {
  const BATCH_SIZE = 400;
  let imported = 0;
  let skipped  = 0;

  console.log('\n🔥  Writing to Firestore...');

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = contacts.slice(i, i + BATCH_SIZE);

    for (const contact of chunk) {
      const props = contact.properties || {};
      const email = (props.email || '').toLowerCase().trim();

      if (!email) { skipped++; continue; }

      // Store the full HubSpot properties object as-is, plus our standard fields
      const doc = {
        hubspotId:   contact.id || '',
        email,
        firstname:   props.firstname  || '',
        lastname:    props.lastname   || '',
        // Spread all raw HubSpot properties so nothing is lost
        hsProperties: props,
        // Keep top-level fields we already use in the app
        industry:    props.industry   || '',
        pr:          props.pr         || '',
        zip:         props.zip        || props.postal_code || '',
        company:     props.company    || '',
        phone:       props.phone      || '',
        state:       props.state      || '',
        createDate:  props.createdate || '',
        importedAt:  new Date(),
        importSource: 'hubspot-api',
      };

      const ref = db.collection('crm_contacts').doc(email);
      batch.set(ref, doc, { merge: true });
      imported++;
    }

    await batch.commit();
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const total    = Math.min(i + BATCH_SIZE, contacts.length);
    console.log(`   Committed batch ${batchNum} (${total}/${contacts.length})`);
  }

  return { imported, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const propertyNames = await getAllPropertyNames();
    const contacts      = await fetchAllContacts(propertyNames);
    const { imported, skipped } = await upsertToFirestore(contacts);

    console.log(`\n✅  Done!`);
    console.log(`   Imported : ${imported}`);
    console.log(`   Skipped  : ${skipped} (no email)`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
  }
})();
