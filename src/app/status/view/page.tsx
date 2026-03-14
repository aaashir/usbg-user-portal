'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { assignDeskId, getDeskId, logUserActivity } from '@/lib/firebase';

const NOW_MS = Date.now();

function checkForIncompleteProperties(obj: Record<string, unknown>) {
  return Object.values(obj).some((value) => value === null || value === undefined);
}

function getPropertyValue(property: unknown) {
  if (property === null || property === undefined) return '';
  return String(property);
}

function buildPdfPayload(properties: Record<string, unknown>, applicationCompleted: string) {
  const negativebalances = properties.negativebalances;
  const deposits = properties.deposits;
  const timeinbusiness = properties.timeinbusiness;
  const n20kinbank = properties.n20kinbank;
  const financeCompleted =
    negativebalances !== null &&
    negativebalances !== undefined &&
    deposits !== null &&
    deposits !== undefined &&
    timeinbusiness !== null &&
    timeinbusiness !== undefined &&
    n20kinbank !== null &&
    n20kinbank !== undefined;

  const businessAddress = (() => {
    const address = getPropertyValue(properties.address);
    const zip = getPropertyValue(properties.zip);
    const city = getPropertyValue(properties.city);
    const state = getPropertyValue(properties.state);
    if (address && zip && city && state) return `${address}, ${zip}, ${city}, ${state}`;
    return '';
  })();

  const productDescription = (() => {
    const productdescription = getPropertyValue(properties.productdescription);
    const productdifferentiation = getPropertyValue(properties.productdifferentiation);
    if (productdescription && productdifferentiation) return `${productdescription}, ${productdifferentiation}`;
    if (productdescription && !productdifferentiation) return productdescription;
    if (!productdescription && productdifferentiation) return productdifferentiation;
    return 'We were unable to complete this section due to missing information about your business.';
  })();

  const getBusinessPlanFormData = (property: unknown) => {
    if (property !== null && property !== undefined) return String(property);
    return 'Awaiting Response.';
  };

  const grantTypeInfo = applicationCompleted === 'YES' ? 'Application sent - awaiting response' : 'Ineligible for grant funding';

  return {
    email: getPropertyValue(properties.email),
    business_name: getPropertyValue(properties.company),
    ein: getPropertyValue(properties.ein),
    bank_account: getPropertyValue(properties.bank_statement_month_1) !== '' ? 'YES' : 'NO',
    application_completed: applicationCompleted,
    outstanding_balance: financeCompleted ? negativebalances : 'MISSING DOCUMENTS',
    minimum_deposits: financeCompleted ? deposits : 'MISSING DOCUMENTS',
    time_in_business: financeCompleted ? timeinbusiness : 'MISSING DOCUMENTS',
    enough_amount_in_bank: financeCompleted ? n20kinbank : 'MISSING DOCUMENTS',
    business_address: businessAddress,
    business_phone: getPropertyValue(properties.phone),
    government_grants: grantTypeInfo,
    general_foundation_grants: grantTypeInfo,
    industry_specific_grants: grantTypeInfo,
    minority_women_owned: grantTypeInfo,
    mission_statement: getBusinessPlanFormData(properties.missionstatement),
    business_concept: getBusinessPlanFormData(properties.businessconcept),
    business_goals: getBusinessPlanFormData(properties.businessgoals),
    product_description_differentiation: productDescription,
    target_market: getBusinessPlanFormData(properties.targetmarket),
    competitive_advantage: getBusinessPlanFormData(properties.competitiveadvantage),
    financial_projections: getBusinessPlanFormData(properties.financialprojection),
    requested_amount: getBusinessPlanFormData(properties.howmuchmoney),
    funding_use: getBusinessPlanFormData(properties.fundinguse),
    potential_grant_recipient_statement: getBusinessPlanFormData(properties.goodgrantrecipient),
    industry: getPropertyValue(properties.industry),
  };
}

function getViewFileReviewAccess(createdAt: string, pr: string, now: number) {
  const input = new Date(createdAt).getTime();
  const diffInHours = Math.floor((now - input) / (1000 * 60 * 60));
  const diffInDays = Math.floor((now - input) / (1000 * 60 * 60 * 24));

  const access = {
    ADMINISTRATIVE: false,
    FINANCE: false,
    PROGRAMMATIC: false,
    GRANT_REVIEW_BOARD: false,
    COMPLETED: false,
  };

  const isExpedited = pr === 'TRUE' || pr === 'EF';

  if (diffInHours >= 24) access.ADMINISTRATIVE = true;

  if (isExpedited) {
    if (diffInDays >= 15) access.FINANCE = true;
    if (diffInDays >= 28) access.PROGRAMMATIC = true;
    if (diffInDays >= 36) access.GRANT_REVIEW_BOARD = true;
    if (diffInDays >= 42) access.COMPLETED = true;
  } else {
    if (diffInDays >= 18) access.FINANCE = true;
    if (diffInDays >= 36) access.PROGRAMMATIC = true;
    if (diffInDays >= 54) access.GRANT_REVIEW_BOARD = true;
    if (diffInDays >= 72) access.COMPLETED = true;
  }

  return access;
}

function randomDeskId() {
  const ids = ['1572', '0286', '2041'];
  return ids[Math.floor(Math.random() * ids.length)];
}

export default function ViewFilePage() {
  const { user } = useAuth();

  const email = useMemo(() => String(user?.properties?.['email'] ?? ''), [user]);
  const pr = useMemo(() => String(user?.properties?.['pr'] ?? ''), [user]);
  const createdAt = useMemo(() => String(user?.createdAt ?? ''), [user]);
  const pdfUrl = useMemo(() => {
    const v = user?.properties?.['download_pdf_url'];
    return typeof v === 'string' ? v : '';
  }, [user]);
  const properties = useMemo(() => (user?.properties ?? {}) as Record<string, unknown>, [user]);
  const applicationCompleted = useMemo(() => (checkForIncompleteProperties(properties) ? 'YES' : 'NO'), [properties]);

  const [deskId, setDeskId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const access = useMemo(() => getViewFileReviewAccess(createdAt, pr, NOW_MS), [createdAt, pr]);

  const processingTime = useMemo(() => {
    if (!pr || pr === 'SF') return 'NORMAL 8-10 weeks';
    return 'EXPEDITED 2-6 weeks';
  }, [pr]);

  useEffect(() => {
    if (!email) return;
    (async () => {
      const existing = await getDeskId(email);
      if (existing) {
        setDeskId(existing);
      } else {
        const id = randomDeskId();
        await assignDeskId(email, id);
        setDeskId(id);
      }

      await logUserActivity(email, 'viewed_file');
    })();
  }, [email]);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">View File</h1>
        <p className="text-slate-500 text-sm font-medium">Summary and review access.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm font-semibold text-slate-700">
            Processing Time: <span className="text-slate-900">{processingTime}</span>
          </div>
          <div className="text-sm font-semibold text-slate-700">
            Desk - ID: <span className="text-slate-900">{deskId || '—'}</span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-bold text-slate-900">Review Access</div>
          <div className="mt-2 text-sm text-slate-700">
            Administrative: {access.ADMINISTRATIVE ? 'Complete' : 'In progress'} · Finance:{' '}
            {access.FINANCE ? 'Complete' : 'In progress'} · Programmatic:{' '}
            {access.PROGRAMMATIC ? 'Complete' : 'In progress'} · Grant Review Board:{' '}
            {access.GRANT_REVIEW_BOARD ? 'Complete' : 'In progress'}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={async () => {
              if (!access.PROGRAMMATIC) return;
              if (!email) return;
              setError('');

              let urlToOpen = pdfUrl;

              if (!urlToOpen) {
                setIsGenerating(true);
                try {
                  const res = await fetch('/api/generate-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildPdfPayload(properties, applicationCompleted)),
                  });

                  const data = (await res.json()) as { downloadUrl?: string; message?: string };
                  if (!res.ok || !data.downloadUrl) {
                    setError(data.message || 'Unable to generate PDF right now.');
                    return;
                  }

                  urlToOpen = data.downloadUrl;
                } catch {
                  setError('Unable to generate PDF right now.');
                  return;
                } finally {
                  setIsGenerating(false);
                }
              }

              await logUserActivity(email, 'downloaded_summary');
              window.open(urlToOpen, '_blank', 'noreferrer');
            }}
            disabled={isGenerating || !access.PROGRAMMATIC}
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {isGenerating ? 'Generating…' : 'View Summary PDF'}
          </button>
          <button
            type="button"
            onClick={() => window.open('https://usbusinessgrants.org/upload.html', '_blank', 'noreferrer')}
            className="rounded-md bg-white border border-slate-200 text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Upload Files
          </button>
        </div>

        {!access.PROGRAMMATIC && (
          <div className="mt-4 text-sm text-slate-600">
            Summary PDF becomes available after programmatic review begins.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
