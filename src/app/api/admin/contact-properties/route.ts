export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminFirebase, checkAdminAuth } from '../_shared';
import { FieldValue } from 'firebase-admin/firestore';

export type ContactProperty = {
  key: string;
  label: string;
  type: string;
  group: string;
  builtin: boolean;
};

// ─── HubSpot Standard + USBG built-in properties ──────────────────────────────
export const BUILTIN_PROPERTIES: ContactProperty[] = [
  // Contact Information
  { key: 'firstname',        label: 'First Name',                    type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'lastname',         label: 'Last Name',                     type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'email',            label: 'Email',                         type: 'email',    group: 'Contact Information', builtin: true },
  { key: 'phone',            label: 'Phone Number',                  type: 'phone',    group: 'Contact Information', builtin: true },
  { key: 'mobilephone',      label: 'Mobile Phone Number',           type: 'phone',    group: 'Contact Information', builtin: true },
  { key: 'salutation',       label: 'Salutation',                    type: 'select',   group: 'Contact Information', builtin: true },
  { key: 'jobtitle',         label: 'Job Title',                     type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'company',          label: 'Company Name',                  type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'businessName',     label: 'Business Name (USBG)',          type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'website',          label: 'Website URL',                   type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'address',          label: 'Street Address',                type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'city',             label: 'City',                          type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'state',            label: 'State / Region',                type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'zip',              label: 'Postal Code',                   type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'country',          label: 'Country / Region',              type: 'text',     group: 'Contact Information', builtin: true },
  { key: 'industry',         label: 'Industry',                      type: 'select',   group: 'Contact Information', builtin: true },
  { key: 'annualrevenue',    label: 'Annual Revenue',                type: 'number',   group: 'Contact Information', builtin: true },
  { key: 'numemployees',     label: 'Number of Employees',           type: 'number',   group: 'Contact Information', builtin: true },
  { key: 'message',          label: 'Message',                       type: 'textarea', group: 'Contact Information', builtin: true },
  { key: 'lifecyclestage',   label: 'Lifecycle Stage',               type: 'select',   group: 'Contact Information', builtin: true },
  { key: 'hs_lead_status',   label: 'Lead Status',                   type: 'select',   group: 'Contact Information', builtin: true },
  { key: 'hs_persona',       label: 'Persona',                       type: 'select',   group: 'Contact Information', builtin: true },
  { key: 'hs_language',      label: 'Preferred Language',            type: 'select',   group: 'Contact Information', builtin: true },
  { key: 'createDate',       label: 'Create Date',                   type: 'date',     group: 'Contact Information', builtin: true },
  // Business / Financial
  { key: 'fax',              label: 'Fax Number',                    type: 'text',     group: 'Business', builtin: true },
  { key: 'description',      label: 'About Us / Description',        type: 'textarea', group: 'Business', builtin: true },
  // USBG-specific
  { key: 'pr',               label: 'Program (PR)',                  type: 'text',     group: 'USBG', builtin: true },
  { key: 'fundinguse',       label: 'Funding Use',                   type: 'textarea', group: 'USBG', builtin: true },
  // Social Media
  { key: 'twitterhandle',    label: 'Twitter Username',              type: 'text',     group: 'Social Media', builtin: true },
  { key: 'linkedinbio',      label: 'LinkedIn Bio',                  type: 'textarea', group: 'Social Media', builtin: true },
  { key: 'linkedin_company_page', label: 'LinkedIn Company Page',    type: 'text',     group: 'Social Media', builtin: true },
  { key: 'linkedinconnections',   label: 'LinkedIn Connections',      type: 'number',   group: 'Social Media', builtin: true },
  { key: 'facebookid',       label: 'Facebook ID',                   type: 'text',     group: 'Social Media', builtin: true },
  // Sales
  { key: 'total_revenue',    label: 'Total Revenue',                 type: 'number',   group: 'Sales', builtin: true },
  { key: 'recent_deal_amount', label: 'Recent Deal Amount',          type: 'number',   group: 'Sales', builtin: true },
  { key: 'num_associated_deals', label: 'Associated Deals',          type: 'number',   group: 'Sales', builtin: true },
  // Conversion
  { key: 'first_conversion_date',        label: 'First Conversion Date',   type: 'date', group: 'Conversion', builtin: true },
  { key: 'first_conversion_event_name',  label: 'First Conversion',        type: 'text', group: 'Conversion', builtin: true },
  { key: 'recent_conversion_date',       label: 'Recent Conversion Date',  type: 'date', group: 'Conversion', builtin: true },
  { key: 'num_conversion_events',        label: 'Form Submissions (count)', type: 'number', group: 'Conversion', builtin: true },
];

// GET — list all (builtin + custom)
export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ properties: BUILTIN_PROPERTIES });

  const snap = await db.collection('contact_properties').get();
  const custom: ContactProperty[] = snap.docs.map(d => ({
    key: d.id,
    ...(d.data() as Omit<ContactProperty, 'key'>),
    builtin: false,
  }));

  const builtinKeys = new Set(BUILTIN_PROPERTIES.map(p => p.key));
  const unique = custom.filter(c => !builtinKeys.has(c.key));
  return NextResponse.json({ properties: [...BUILTIN_PROPERTIES, ...unique] });
}

// POST — register a new custom property
export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key, label, type, group } = await req.json();
  if (!key || !label) return NextResponse.json({ error: 'key and label required' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  await db.collection('contact_properties').doc(key).set({
    label, type: type || 'text', group: group || 'Custom', builtin: false,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
