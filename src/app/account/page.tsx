'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { CreditCard, Zap, XCircle, Bell, BellOff } from 'lucide-react';

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
  const [emailPrefs,        setEmailPrefs]        = useState<{ unsubscribed: boolean; emailNotifications: boolean } | null>(null);
  const [emailPrefsLoading, setEmailPrefsLoading] = useState(false);
  const [emailPrefsSaving,  setEmailPrefsSaving]  = useState(false);
  const [emailPrefsMsg,     setEmailPrefsMsg]      = useState('');

  // Load email preferences
  useEffect(() => {
    if (!email) return;
    setEmailPrefsLoading(true);
    getAuth().currentUser?.getIdToken()
      .then(tok => fetch('/api/preferences', { headers: { Authorization: `Bearer ${tok}` } }))
      .then(r => r?.ok ? r.json() as Promise<{ unsubscribed: boolean; emailNotifications: boolean }> : null)
      .then(d => { if (d) setEmailPrefs(d); })
      .catch(() => {})
      .finally(() => setEmailPrefsLoading(false));
  }, [email]);

  async function saveEmailPref(update: Partial<{ unsubscribed: boolean; emailNotifications: boolean }>) {
    setEmailPrefsSaving(true); setEmailPrefsMsg('');
    try {
      const tok = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        setEmailPrefs(prev => prev ? { ...prev, ...update } : null);
        setEmailPrefsMsg('Saved!');
        setTimeout(() => setEmailPrefsMsg(''), 3000);
      }
    } catch { setEmailPrefsMsg('Failed to save.'); }
    finally   { setEmailPrefsSaving(false); }
  }

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

      {/* ── Email Preferences ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email Preferences</h2>

        {emailPrefsLoading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : emailPrefs === null ? (
          <div className="text-sm text-slate-400">Could not load preferences.</div>
        ) : (
          <>
            {/* Portal notifications */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-start gap-3">
                {emailPrefs.emailNotifications ? <Bell size={16} className="text-blue-500 mt-0.5 flex-shrink-0" /> : <BellOff size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-slate-700">Portal Notifications</p>
                  <p className="text-xs text-slate-500 mt-0.5">Email alerts when you receive a new message or status update.</p>
                </div>
              </div>
              <button
                onClick={() => void saveEmailPref({ emailNotifications: !emailPrefs.emailNotifications })}
                disabled={emailPrefsSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${emailPrefs.emailNotifications ? 'bg-blue-600' : 'bg-slate-300'} disabled:opacity-60`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${emailPrefs.emailNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Marketing emails */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-start gap-3">
                {!emailPrefs.unsubscribed ? <Bell size={16} className="text-blue-500 mt-0.5 flex-shrink-0" /> : <BellOff size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-slate-700">Marketing Emails</p>
                  <p className="text-xs text-slate-500 mt-0.5">Grant opportunities, tips, and updates from US Business Grants.</p>
                  {emailPrefs.unsubscribed && (
                    <span className="mt-1 inline-block text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Unsubscribed</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => void saveEmailPref({ unsubscribed: !emailPrefs.unsubscribed })}
                disabled={emailPrefsSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${!emailPrefs.unsubscribed ? 'bg-blue-600' : 'bg-slate-300'} disabled:opacity-60`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${!emailPrefs.unsubscribed ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {emailPrefsMsg && <p className="text-xs font-semibold text-emerald-600">{emailPrefsMsg}</p>}
          </>
        )}
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
