/**
 * Import HubSpot contacts created in the last 180 days → Firestore crm_contacts/{email}
 * - Includes ALL contacts (paid and non-paid, with or without PR)
 * - Skips contacts already present in Firestore
 * - Imports all available HubSpot fields
 *
 * Usage: node scripts/import-hubspot-180days.mjs
 */

import { readFileSync } from 'fs';
import { resolve }      from 'path';
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
  envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const HUBSPOT_TOKEN = envVars.HUBSPOT_API_KEY        || '';
const projectId    = envVars.FIREBASE_ADMIN_PROJECT_ID    || '';
const clientEmail  = envVars.FIREBASE_ADMIN_CLIENT_EMAIL  || '';
const privateKey   = (envVars.FIREBASE_ADMIN_PRIVATE_KEY  || '').replace(/\\n/g, '\n');

if (!HUBSPOT_TOKEN)                       { console.error('❌  Missing HUBSPOT_API_KEY');            process.exit(1); }
if (!projectId || !clientEmail || !privateKey) { console.error('❌  Missing Firebase admin credentials'); process.exit(1); }

// ── Init Firebase ─────────────────────────────────────────────────────────────
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const HS_HEADERS = {
  Authorization:  `Bearer ${HUBSPOT_TOKEN}`,
  'Content-Type': 'application/json',
};

const NOW_MS   = Date.now();
const SINCE_MS = NOW_MS - 180 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7-day windows to stay under 10k limit

// ── Step 1: Get all HubSpot property names ───────────────────────────────────
async function getAllPropertyNames() {
  console.log('📋  Fetching all HubSpot contact property definitions...');
  const res  = await fetch('https://api.hubapi.com/crm/v3/properties/contacts?limit=1000', { headers: HS_HEADERS });
  if (!res.ok) throw new Error(`HubSpot properties API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const names = (data.results || []).map(p => p.name);
  console.log(`   Found ${names.length} properties`);
  return names;
}

// ── Step 2: Fetch one time window (paginated up to 10k) ───────────────────────
async function fetchWindow(propertyNames, fromMs, toMs) {
  const contacts = [];
  let after = undefined;

  while (true) {
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: String(fromMs) },
          { propertyName: 'createdate', operator: 'LT',  value: String(toMs)   },
        ],
      }],
      properties: propertyNames,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST', headers: HS_HEADERS, body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HubSpot search API ${res.status}: ${await res.text()}`);
    const data    = await res.json();
    const results = data.results || [];
    contacts.push(...results);

    const next = data.paging?.next;
    if (!next) break;
    after = next.after;
    await new Promise(r => setTimeout(r, 120));
  }
  return contacts;
}

// ── Step 2 (main): Fetch all contacts across 7-day windows ───────────────────
async function fetchRecentContacts(propertyNames) {
  const allContacts = new Map(); // dedupe by hubspot ID
  const seenIds     = new Set();

  console.log(`\n📥  Fetching contacts created since ${new Date(SINCE_MS).toDateString()} (7-day windows)...`);

  let windowStart = SINCE_MS;
  let windowNum   = 0;

  while (windowStart < NOW_MS) {
    const windowEnd = Math.min(windowStart + WINDOW_MS, NOW_MS);
    windowNum++;

    const from = new Date(windowStart).toDateString();
    const to   = new Date(windowEnd).toDateString();
    process.stdout.write(`   Window ${windowNum}: ${from} → ${to} ... `);

    const contacts = await fetchWindow(propertyNames, windowStart, windowEnd);

    let newInWindow = 0;
    for (const c of contacts) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        allContacts.set(c.id, c);
        newInWindow++;
      }
    }
    console.log(`${contacts.length} fetched, ${newInWindow} new (total: ${allContacts.size})`);

    windowStart = windowEnd;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n   ✅ Total unique contacts fetched: ${allContacts.size}`);
  return Array.from(allContacts.values());
}

// ── Step 3: Load existing Firestore emails ────────────────────────────────────
async function loadExistingEmails() {
  console.log('\n🔍  Loading existing emails from Firestore...');
  const snap   = await db.collection('crm_contacts').select().get(); // IDs only — no field data
  const emails = new Set(snap.docs.map(d => d.id));
  console.log(`   Found ${emails.size} existing contacts`);
  return emails;
}

// ── Step 4: Write new contacts to Firestore ───────────────────────────────────
async function commitWithRetry(batch, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`   ⚠️  ${label} attempt ${attempt} failed (${err.code}), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function importNew(contacts, existingEmails) {
  const BATCH_SIZE = 100; // smaller batches = less chance of timeout
  let imported = 0;
  let skipped  = 0;
  let noEmail  = 0;

  const newContacts = contacts.filter(c => {
    const email = (c.properties?.email || '').toLowerCase().trim();
    if (!email)                    { noEmail++; return false; }
    if (existingEmails.has(email)) { skipped++; return false; }
    return true;
  });

  console.log(`\n🔥  Writing ${newContacts.length} new contacts to Firestore...`);
  console.log(`   Skipping ${skipped} already imported | ${noEmail} with no email`);

  const totalBatches = Math.ceil(newContacts.length / BATCH_SIZE);

  for (let i = 0; i < newContacts.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = newContacts.slice(i, i + BATCH_SIZE);

    for (const contact of chunk) {
      const props = contact.properties || {};
      const email = props.email.toLowerCase().trim();

      const doc = {
        hubspotId:    contact.id || '',
        email,
        firstName:    props.firstname  || '',
        lastName:     props.lastname   || '',
        phone:        props.phone      || '',
        zipCode:      props.zip        || props.postal_code || '',
        state:        props.state      || '',
        businessName: props.company    || '',
        pr:           props.pr         || '',
        createDate:   props.createdate || '',
        hsProperties: props,
        importedAt:   new Date(),
        importSource: 'hubspot-180days',
      };

      batch.set(db.collection('crm_contacts').doc(email), doc);
      imported++;
    }

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    await commitWithRetry(batch, `Batch ${batchNum}`);

    const done = Math.min(i + BATCH_SIZE, newContacts.length);
    process.stdout.write(`\r   Progress: ${done}/${newContacts.length} (batch ${batchNum}/${totalBatches})`);

    // Brief pause every 10 batches to avoid overwhelming the connection
    if (batchNum % 10 === 0) await new Promise(r => setTimeout(r, 500));
  }

  console.log(''); // newline after progress
  return { imported, skipped, noEmail };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const propertyNames  = await getAllPropertyNames();
    const contacts       = await fetchRecentContacts(propertyNames);
    const existingEmails = await loadExistingEmails();
    const { imported, skipped, noEmail } = await importNew(contacts, existingEmails);

    console.log('\n✅  Done!');
    console.log(`   Imported : ${imported}`);
    console.log(`   Skipped  : ${skipped} (already in Firestore)`);
    console.log(`   No email : ${noEmail} (ignored)`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
  }
})();
