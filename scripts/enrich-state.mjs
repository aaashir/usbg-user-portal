/**
 * Enrichment script: fetch state from HubSpot ONLY for existing crm_contacts
 * Uses HubSpot search API in batches of 100 — fast, targeted.
 * Usage: node scripts/enrich-state.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Load .env.local ──────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) envVars[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
}

const hubspotKey = envVars.HUBSPOT_API_KEY || '';
if (!hubspotKey) { console.error('Missing HUBSPOT_API_KEY'); process.exit(1); }

// ── Firebase init ─────────────────────────────────────────────────────────────
const projectId = envVars.FIREBASE_ADMIN_PROJECT_ID || '';
const clientEmail = envVars.FIREBASE_ADMIN_CLIENT_EMAIL || '';
const privateKey = (envVars.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

// ── Step 1: Get all emails from crm_contacts ──────────────────────────────────
console.log('Reading crm_contacts from Firestore…');
const snap = await db.collection('crm_contacts').select().get(); // select() = no field data, just IDs
const emails = snap.docs.map(d => d.id);
console.log(`Found ${emails.length} contacts to enrich`);

// ── Step 2: Search HubSpot in batches of 100 ─────────────────────────────────
const BATCH = 100;
const stateMap = {};
let batch = 0;

for (let i = 0; i < emails.length; i += BATCH) {
  const chunk = emails.slice(i, i + BATCH);
  batch++;

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hubspotKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'IN', values: chunk }]
      }],
      properties: ['email', 'state'],
      limit: 100,
    }),
  });

  if (!res.ok) {
    console.error(`HubSpot error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  for (const contact of data.results ?? []) {
    const email = (contact.properties?.email ?? '').toLowerCase().trim();
    const state = (contact.properties?.state ?? '').trim();
    if (email && state) stateMap[email] = state;
  }

  console.log(`  Batch ${batch}/${Math.ceil(emails.length / BATCH)} done (${Object.keys(stateMap).length} with state so far)`);
}

console.log(`\nTotal contacts with state: ${Object.keys(stateMap).length}`);

// ── Step 3: Update Firestore ──────────────────────────────────────────────────
const stateEmails = Object.keys(stateMap);
const FB_BATCH = 400;
let updated = 0;

for (let i = 0; i < stateEmails.length; i += FB_BATCH) {
  const fbBatch = db.batch();
  for (const email of stateEmails.slice(i, i + FB_BATCH)) {
    fbBatch.set(db.collection('crm_contacts').doc(email), { state: stateMap[email] }, { merge: true });
    updated++;
  }
  await fbBatch.commit();
}

console.log(`✅ Done. Updated ${updated} contacts with state in Firestore.`);
