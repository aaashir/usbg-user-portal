'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CreditCard, Zap, XCircle } from 'lucide-react';

function prop(properties: Record<string, unknown> | undefined, key: string): string {
  return String(properties?.[key] ?? '').trim() || '—';
}

function membershipLabel(pr: string): string {
  if (pr === 'SF' || pr === 'TRUE' || pr === 'starter') return 'Starter';
  if (pr === 'EF' || pr === 'growth') return 'Growth';
  if (pr === 'UF' || pr === 'pro') return 'Unlimited';
  return 'Member';
}

function currentMonthKey() {
  const d = new Date();
  return `business_plan_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AccountPage() {
  const { user } = useAuth();
  const properties = useMemo(() => user?.properties as Record<string, unknown> | undefined, [user]);
  const email = useMemo(() => String(properties?.email ?? '').trim(), [properties]);
  const pr    = useMemo(() => String(properties?.pr    ?? ''), [properties]);

  const [bpUsed, setBpUsed] = useState<number | null>(null);

  useEffect(() => {
    if (!email) return;
    const mk = currentMonthKey();
    getDoc(doc(db, 'check_status_app', email, 'usage', 'ai'))
      .then(snap => {
        const count = snap.exists()
          ? ((snap.data() as Record<string, unknown>)[mk] as number ?? 0)
          : 0;
        setBpUsed(count);
      })
      .catch(() => setBpUsed(0));
  }, [email]);

  const fields = useMemo(() => [
    { label: 'Business Name',        value: prop(properties, 'company') },
    { label: 'First Name',           value: prop(properties, 'firstname') },
    { label: 'Last Name',            value: prop(properties, 'lastname') },
    { label: 'Email',                value: prop(properties, 'email') },
    { label: 'Phone',                value: prop(properties, 'phone') },
    { label: 'Address',              value: prop(properties, 'address') },
    { label: 'City',                 value: prop(properties, 'city') },
    { label: 'State',                value: prop(properties, 'state') },
    { label: 'Zip Code',             value: prop(properties, 'zip') },
    { label: 'Business Type',        value: prop(properties, 'business_type') },
    { label: 'Industry',             value: prop(properties, 'industry') },
    { label: 'Annual Revenue',       value: prop(properties, 'annualrevenue') },
    { label: 'Number of Employees',  value: prop(properties, 'numemployees') },
    { label: 'Website',              value: prop(properties, 'website') },
  ], [properties]);

  const visibleFields = fields.filter((f) => f.value !== '—');
  const displayFields = visibleFields.length > 0 ? visibleFields : fields.slice(0, 4);

  return (
    <div className="animate-in fade-in duration-500 space-y-5 max-w-[720px]">
      <header>
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">Account</h1>
        <p className="text-slate-500 text-sm font-medium">Your account details and subscription.</p>
      </header>

      {/* ── Membership & Quota ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Membership</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Plan</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{membershipLabel(pr)}</span>
              {pr && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {pr}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              AI Business Plan — This Month
            </div>
            {bpUsed === null ? (
              <div className="text-sm text-slate-400">Loading…</div>
            ) : (
              <div className={`text-sm font-bold ${bpUsed >= 1 ? 'text-orange-600' : 'text-emerald-600'}`}>
                {bpUsed} / 1 used
                {bpUsed >= 1 && (
                  <span className="ml-2 text-[11px] font-normal text-slate-400">
                    Resets next month
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contact Info ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {displayFields.map((f) => (
            <div key={f.label}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{f.label}</div>
              <div className="text-sm font-semibold text-slate-900 break-words">{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Billing & Subscription ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Billing &amp; Subscription</h2>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <CreditCard size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">Change your payment method</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-1.5">
              To change your payment method, please login to the payment portal here.
            </p>
            <a
              href="https://billing.stripe.com/p/login/4gwg0Wbdz41P5ZmdQQ"
              target="_blank" rel="noreferrer"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Payment Portal →
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <Zap size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">Upgrade your service</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-1.5">
              To upgrade your service, please login to the subscription portal here.
            </p>
            <a
              href="https://billing.stripe.com/p/login/4gwg0Wbdz41P5ZmdQQ"
              target="_blank" rel="noreferrer"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Subscription Portal →
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-red-100">
          <XCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">Request a cancellation or refund</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-1.5">
              To request cancellation or a refund, use the link below.
            </p>
            <a
              href="https://usbusinessgrants.org/refund-request/"
              target="_blank" rel="noreferrer"
              className="text-sm font-semibold text-red-600 hover:text-red-700 hover:underline"
            >
              Refund / Cancel Request →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
