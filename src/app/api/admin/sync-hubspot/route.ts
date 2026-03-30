export const runtime = 'nodejs';

import { NextResponse }    from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

const HS_HEADERS = { 'Content-Type': 'application/json' };

// Firestore doc that stores resume checkpoint
const CHECKPOINT_PATH = { col: 'admin_meta', doc: 'hs_sync_checkpoint' };

const HS_DOC_MAP: Record<string, string> = {
  bank_statement_month_1:       'bank_statement_1',
  bank_statement_month_2:       'bank_statement_2',
  bank_statement_month_3:       'bank_statement_3',
  drivers_license:              'drivers_license',
  drivers_license_front_side:   'drivers_license_front',
  drivers_license_back_side:    'drivers_license_back',
  profitlossstatement:          'business_plan',
  proof_of_payment:             'proof_of_payment',
  reference_review_1:           'reference_1',
  reference_review_2:           'reference_2',
  reference_review_3:           'reference_3',
  upload_additional_documents:  'additional_documents',
  voided_check:                 'voided_check',
  waiver_support_documents:     'waiver_support',
  grant_acceptance_video:       'grant_acceptance_video',
  matching_grant_video:         'matching_grant_video',
};

const HS_DOC_LABELS: Record<string, string> = {
  bank_statement_month_1:       'Bank Statement – Month 1',
  bank_statement_month_2:       'Bank Statement – Month 2',
  bank_statement_month_3:       'Bank Statement – Month 3',
  drivers_license:              'Drivers License',
  drivers_license_front_side:   'Drivers License (Front)',
  drivers_license_back_side:    'Drivers License (Back)',
  profitlossstatement:          'Business Plan / P&L Statement',
  proof_of_payment:             'Proof of Payment',
  reference_review_1:           'Reference / Review 1',
  reference_review_2:           'Reference / Review 2',
  reference_review_3:           'Reference / Review 3',
  upload_additional_documents:  'Additional Documents',
  voided_check:                 'Voided Check',
  waiver_support_documents:     'Waiver Support Documents',
  grant_acceptance_video:       'Grant Acceptance Video',
  matching_grant_video:         'Matching Grant Video',
};

// Curated property list — covers all fields we use (search API rejects 200+ properties)
const FETCH_PROPERTIES = [
  'firstname', 'lastname', 'email', 'phone', 'mobilephone',
  'address', 'city', 'state', 'zip', 'postal_code', 'country',
  'company', 'business_name', 'website', 'jobtitle',
  'pr', 'fundinguse', 'industry', 'annualrevenue', 'numemployees',
  'agree_to_terms', 'desired_funding_amount', 'how_much_money_do_you_need_',
  'how_soon_do_you_need_it_', 'howmuchmoney', 'estimated_loan_amount',
  'business_start_year', 'business_start_month',
  'have_you_been_in_business_for_at_least_6_months_',
  'how_long_have_you_been_in_business_',
  'have_you_ever_defaulted_on_a_payment_',
  'have_you_ever_filed_for_bankruptcy_',
  'credit_score', 'gross_monthly_revenue', 'gross_monthly_sales',
  'current_bank_balance', 'deposits',
  'business_bank_account', 'i_have_a_business_bank_account',
  'home_based', 'ein', 'co_owner_name',
  'businessconcept', 'businessgoals', 'competitiveadvantage',
  'benefits', 'business_services', 'basisforwaiver',
  'goodgrantrecipient', 'bank', 'which_bank_do_you_use_1',
  'lifecyclestage', 'hs_lead_status', 'createdate', 'closedate', 'lastmodifieddate',
  'bank_statement_month_1', 'bank_statement_month_2', 'bank_statement_month_3',
  'drivers_license', 'drivers_license_front_side', 'drivers_license_back_side',
  'profitlossstatement', 'proof_of_payment',
  'reference_review_1', 'reference_review_2', 'reference_review_3',
  'upload_additional_documents', 'voided_check', 'waiver_support_documents',
  'grant_acceptance_video', 'matching_grant_video',
  'download_pdf_url', 'pdf_url',
];

async function getHubSpotToken() {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) throw new Error('HUBSPOT_API_KEY not configured');
  return key;
}

async function fetchHubSpotPage(token: string, after?: string) {
  const body: Record<string, unknown> = {
    filterGroups: [{
      filters: [{
        propertyName: 'createdate',
        operator: 'GTE',
        value: String(Date.now() - 180 * 24 * 60 * 60 * 1000),
      }],
    }],
    properties: FETCH_PROPERTIES,
    limit: 100,
    ...(after ? { after } : {}),
  };

  console.log('[hs-sync] token length:', token.length, 'starts:', token.slice(0, 10));
  console.log('[hs-sync] after cursor:', after ?? 'none');
  console.log('[hs-sync] property count:', FETCH_PROPERTIES.length);

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { ...HS_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[hs-sync] HubSpot error body:', errText);
    // Signal stale cursor separately so caller can retry from page 1
    if (res.status === 400 && after) {
      const e = new Error(`STALE_CURSOR:${errText}`) as Error & { staleCursor: true };
      e.staleCursor = true;
      throw e;
    }
    throw new Error(`HubSpot API ${res.status}: ${errText}`);
  }
  return res.json() as Promise<{
    results: Array<{ id: string; properties: Record<string, string> }>;
    paging?: { next?: { after: string } };
    total?: number;
  }>;
}

export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const url        = new URL(req.url);
  const updateMode = url.searchParams.get('update') === '1';
  const resume     = url.searchParams.get('resume') === '1';
  const fresh      = url.searchParams.get('fresh')  === '1'; // clear checkpoint + restart

  const checkpointRef = db.collection(CHECKPOINT_PATH.col).doc(CHECKPOINT_PATH.doc);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const token = await getHubSpotToken();

        // ── Load or clear checkpoint ──────────────────────────────────────────
        type CheckpointData = {
          after?: string;
          imported: number; updated: number; skipped: number; noEmail: number; processed: number; total: number;
          updateMode?: boolean; savedAt?: unknown;
        };
        let checkpoint: CheckpointData | null = null;

        if (fresh) {
          await checkpointRef.delete();
          send({ status: 'Starting fresh sync…' });
        } else if (resume) {
          const snap = await checkpointRef.get();
          if (snap.exists) {
            checkpoint = snap.data() as unknown as CheckpointData;
            send({
              status: `Resuming from checkpoint (${(checkpoint?.processed ?? 0).toLocaleString()} already processed)…`,
              ...checkpoint,
            });
          } else {
            send({ status: 'No checkpoint found — starting from beginning…' });
          }
        } else {
          // Default: fresh start, clear any old checkpoint
          await checkpointRef.delete();
          send({ status: 'Loading existing contacts…' });
        }

        // ── Load existing contacts ────────────────────────────────────────────
        // Non-update mode: just track emails to skip
        // Update mode: track importedAt timestamps to skip unchanged contacts
        const existingEmails = new Set<string>();
        const existingImportedAt = new Map<string, number>(); // email → importedAt ms

        if (!updateMode) {
          const existingSnap = await db.collection('crm_contacts').select().get();
          existingSnap.docs.forEach(d => existingEmails.add(d.id));
          send({ status: `Found ${existingEmails.size.toLocaleString()} existing contacts. Starting sync…` });
        } else {
          const existingSnap = await db.collection('crm_contacts').select('importedAt').get();
          existingSnap.docs.forEach(d => {
            existingEmails.add(d.id);
            const raw = (d.data() as Record<string, unknown>).importedAt;
            let ms = 0;
            if (raw && typeof raw === 'object' && 'toDate' in raw && typeof (raw as { toDate: unknown }).toDate === 'function') {
              ms = (raw as { toDate(): Date }).toDate().getTime();
            } else if (raw instanceof Date) {
              ms = raw.getTime();
            }
            existingImportedAt.set(d.id, ms);
          });
          send({ status: `Loaded ${existingEmails.size.toLocaleString()} existing contacts. Syncing changed records only…` });
        }

        let after     = checkpoint?.after;
        let imported  = checkpoint?.imported  ?? 0;
        let updated   = checkpoint?.updated   ?? 0;
        let skipped   = checkpoint?.skipped   ?? 0;
        let noEmail   = checkpoint?.noEmail   ?? 0;
        let processed = checkpoint?.processed ?? 0;
        let total     = checkpoint?.total     ?? 0;
        const BATCH_SIZE = 50;

        while (true) {
          let data: Awaited<ReturnType<typeof fetchHubSpotPage>>;
          try {
            data = await fetchHubSpotPage(token, after);
          } catch (err) {
            // Stale pagination cursor — restart from page 1 with fresh counters
            if (err instanceof Error && err.message.startsWith('STALE_CURSOR:')) {
              // Reset counters so display makes sense from the fresh restart
              imported = 0; updated = 0; skipped = 0; noEmail = 0; processed = 0; total = 0;
              after = undefined;
              await checkpointRef.set({ after: null, imported, updated, skipped, noEmail, processed, total, updateMode, savedAt: new Date() });
              send({ status: 'Pagination cursor expired — restarting from page 1…', processed: 0, total: 0, imported: 0, updated: 0, skipped: 0, noEmail: 0 });
              continue;
            }
            throw err;
          }
          const results = data.results ?? [];
          if (total === 0 && data.total) {
            total = data.total;
            send({ status: `Found ${total.toLocaleString()} contacts in HubSpot. Processing…`, total });
          }

          const toWrite = results.filter(c => {
            const props = c.properties;
            const email = (props.email ?? '').toLowerCase().trim();
            if (!email) { noEmail++; return false; }
            // Skip-new-contacts mode: skip any that already exist
            if (!updateMode && existingEmails.has(email)) { skipped++; processed++; return false; }
            // Update mode: skip contacts that haven't changed since last sync
            if (updateMode && existingImportedAt.has(email)) {
              const hsModifiedMs = props.lastmodifieddate ? Number(props.lastmodifieddate) : 0;
              const ourSyncMs    = existingImportedAt.get(email)!;
              if (hsModifiedMs > 0 && hsModifiedMs <= ourSyncMs) { skipped++; processed++; return false; }
            }
            return true;
          });

          // Collect contacts written this page for the activity feed
          const pageContacts: Array<{ email: string; name: string; action: 'imported' | 'updated' | 'skipped' }> = [];

          for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
            const batch = db.batch();
            for (const contact of toWrite.slice(i, i + BATCH_SIZE)) {
              const props = contact.properties;
              const email = props.email.toLowerCase().trim();
              const isExisting = existingEmails.has(email);
              existingEmails.add(email);
              existingImportedAt.set(email, Date.now()); // mark as freshly synced

              const payload = {
                hubspotId:    contact.id,
                email,
                firstName:    props.firstname    ?? '',
                lastName:     props.lastname     ?? '',
                phone:        props.phone        ?? '',
                zipCode:      props.zip          ?? props.postal_code ?? '',
                state:        props.state        ?? '',
                businessName: props.company      ?? props.business_name ?? '',
                pr:           props.pr           ?? '',
                createDate:   props.createdate   ?? '',
                industry:     props.industry     ?? '',
                fundingUse:   props.fundinguse   ?? '',
                hsProperties: props,
                importedAt:   new Date(),
                importSource: 'hubspot-manual-sync',
              };

              const action = updateMode && isExisting ? 'updated' : 'imported';
              if (updateMode) {
                batch.set(db.collection('crm_contacts').doc(email), payload, { merge: true });
                if (isExisting) updated++; else imported++;
              } else {
                batch.set(db.collection('crm_contacts').doc(email), payload);
                imported++;
              }
              processed++;

              const name = [props.firstname, props.lastname].filter(Boolean).join(' ')
                        || props.company || props.business_name || email;
              pageContacts.push({ email, name, action });

              for (const [hsProp, docKey] of Object.entries(HS_DOC_MAP)) {
                const fileUrl = props[hsProp];
                if (!fileUrl) continue;
                const docRef = db
                  .collection('check_status_app').doc(email)
                  .collection('documents').doc(docKey);
                batch.set(docRef, {
                  key:      docKey,
                  label:    HS_DOC_LABELS[hsProp] ?? hsProp,
                  url:      fileUrl,
                  source:   'hubspot',
                  syncedAt: new Date(),
                }, { merge: true });
              }
            }
            await batch.commit();
          }

          const next = data.paging?.next;

          // Save checkpoint after every page
          await checkpointRef.set({
            after:     next?.after ?? null,
            imported, updated, skipped, noEmail, processed, total,
            updateMode,
            savedAt:   new Date(),
          });

          send({ processed, total, imported, updated, skipped, noEmail, contacts: pageContacts });

          if (!next) break;
          after = next.after;

          await new Promise(r => setTimeout(r, 120));
        }

        // Clear checkpoint on successful completion
        await checkpointRef.delete();
        send({ done: true, imported, updated, skipped, noEmail, processed, total });

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send({ error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}

// GET — return current checkpoint status (so UI can show "resume available")
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ checkpoint: null });

  const snap = await db.collection(CHECKPOINT_PATH.col).doc(CHECKPOINT_PATH.doc).get();
  if (!snap.exists) return NextResponse.json({ checkpoint: null });

  const raw = snap.data() ?? {};

  // Serialize Firestore Timestamps → ISO strings
  const checkpoint: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
      checkpoint[k] = (v as { toDate(): Date }).toDate().toISOString();
    } else {
      checkpoint[k] = v;
    }
  }

  return NextResponse.json({ checkpoint });
}
