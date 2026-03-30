export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

const HS_HEADERS = { 'Content-Type': 'application/json' };

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
  'lifecyclestage', 'hs_lead_status', 'createdate', 'closedate',
  'bank_statement_month_1', 'bank_statement_month_2', 'bank_statement_month_3',
  'drivers_license', 'drivers_license_front_side', 'drivers_license_back_side',
  'profitlossstatement', 'proof_of_payment',
  'reference_review_1', 'reference_review_2', 'reference_review_3',
  'upload_additional_documents', 'voided_check', 'waiver_support_documents',
  'grant_acceptance_video', 'matching_grant_video',
  'download_pdf_url', 'pdf_url',
];

export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const email = new URL(req.url).searchParams.get('email')?.toLowerCase().trim() ?? '';
  if (!email) return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ ok: false, error: 'Firebase not configured' }, { status: 500 });

  const hsKey = process.env.HUBSPOT_API_KEY;
  if (!hsKey) return NextResponse.json({ ok: false, error: 'HUBSPOT_API_KEY not configured' }, { status: 500 });

  // Search HubSpot for this specific email
  const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { ...HS_HEADERS, Authorization: `Bearer ${hsKey}` },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }],
      }],
      properties: FETCH_PROPERTIES,
      limit: 1,
    }),
  });

  if (!searchRes.ok) {
    const txt = await searchRes.text();
    return NextResponse.json({ ok: false, error: `HubSpot API ${searchRes.status}: ${txt}` }, { status: 502 });
  }

  const searchData = await searchRes.json() as { results: Array<{ id: string; properties: Record<string, string> }> };
  const contact = searchData.results?.[0];
  if (!contact) return NextResponse.json({ ok: false, error: 'Contact not found in HubSpot' }, { status: 404 });

  const props = contact.properties;
  const batch = db.batch();

  // Update crm_contacts
  batch.set(db.collection('crm_contacts').doc(email), {
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
    importSource: 'hubspot-contact-sync',
  }, { merge: true });

  // Write file-type properties as documents
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

  await batch.commit();
  return NextResponse.json({ ok: true });
}
