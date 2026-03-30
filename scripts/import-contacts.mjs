/**
 * One-time script: import HubSpot CSV contacts (pr != empty) → Firestore crm_contacts/{email}
 * Usage: node scripts/import-contacts.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
const envVars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) envVars[key.trim()] = rest.join('=').trim();
}

const projectId = envVars.FIREBASE_ADMIN_PROJECT_ID || '';
const clientEmail = envVars.FIREBASE_ADMIN_CLIENT_EMAIL || '';
const privateKey = (envVars.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase admin credentials in .env.local');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const csvPath = '/Users/aashir/Downloads/hubspot-crm-exports-all-contacts-2026-03-19.csv';
const lines = readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
const headers = parseCsvLine(lines[0]);

const contacts = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCsvLine(lines[i]);
  const row = {};
  headers.forEach((h, idx) => { row[h] = vals[idx]?.trim() ?? ''; });
  if (row['pr'] && row['Email']) contacts.push(row);
}

console.log(`Found ${contacts.length} contacts with valid pr`);

// ── Firestore batch import ────────────────────────────────────────────────────
const BATCH_SIZE = 400; // Firestore max 500 per batch
let imported = 0;
let skipped = 0;

for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
  const batch = db.batch();
  const chunk = contacts.slice(i, i + BATCH_SIZE);

  for (const c of chunk) {
    const email = c['Email'].toLowerCase().trim();
    if (!email) { skipped++; continue; }

    const ref = db.collection('crm_contacts').doc(email);
    batch.set(ref, {
      recordId: c['Record ID'] || '',
      firstname: c['First Name'] || '',
      lastname: c['Last Name'] || '',
      email,
      industry: c['Industry'] || '',
      pr: c['pr'] || '',
      zip: c['Postal Code'] || '',
      businessName: c['business name'] || '',
      createDate: c['Create Date'] || '',
      importedAt: new Date(),
    }, { merge: true });

    imported++;
  }

  await batch.commit();
  console.log(`  Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, contacts.length)}/${contacts.length})`);
}

console.log(`\n✅ Done. Imported: ${imported}, Skipped (no email): ${skipped}`);
