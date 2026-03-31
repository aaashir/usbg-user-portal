'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Info, Eye, EyeOff, Check, RefreshCw, UserPlus, RefreshCcw, Mail, ChevronDown, Trash2, Plus } from 'lucide-react';

const PREFS = [
  { key: 'usbg:pref:rows', label: 'Default rows per page', options: ['25', '50', '100'], default: '25' },
  { key: 'usbg:pref:sort', label: 'Default sort order',    options: ['Newest first', 'Oldest first', 'Name A–Z'], default: 'Newest first' },
] as const;

type ContactEntry = { email: string; name: string; action: 'imported' | 'updated' };

type SyncProgress = {
  state:      'idle' | 'running' | 'done' | 'error';
  status?:    string;
  processed?: number;
  total?:     number;
  imported?:  number;
  updated?:   number;
  skipped?:   number;
  noEmail?:   number;
  error?:     string;
};

type Checkpoint = {
  after?: string | null;
  processed: number; total: number;
  imported: number; updated: number; skipped: number; noEmail: number;
  savedAt?: string;
  updateMode?: boolean;
} | null;

type SmtpAccount = {
  id: string;
  label: string;
  fromName: string;
  user: string;
  pass: string;
  host: string;
  port: number;
  isDefault: boolean;
};

function generateId() { return `acct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function SmtpSettingsCard() {
  const [accounts,              setAccounts]              = useState<SmtpAccount[]>([]);
  const [notificationAccountId, setNotificationAccountId] = useState<string>('');
  const [expanded,              setExpanded]              = useState<string | null>(null);
  const [showPass,              setShowPass]              = useState<Record<string, boolean>>({});
  const [loading,               setLoading]               = useState(true);
  const [saving,                setSaving]                = useState(false);
  const [saveStatus,            setSaveStatus]            = useState<'idle' | 'ok' | 'error'>('idle');
  const [saveError,             setSaveError]             = useState('');
  const [testing,               setTesting]               = useState(false);
  const [testResult,            setTestResult]            = useState<{ ok: boolean; msg: string } | null>(null);
  const tokenRef = useRef('');

  useEffect(() => {
    tokenRef.current = window.localStorage.getItem('usbg:adminToken') ?? '';
    void fetch('/api/admin/settings/smtp', {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    })
      .then(r => r.json())
      .then((d: { accounts?: SmtpAccount[]; notificationAccountId?: string }) => {
        setAccounts(d.accounts ?? []);
        setNotificationAccountId(d.notificationAccountId ?? '');
        if ((d.accounts ?? []).length > 0) setExpanded(d.accounts![0].id);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  function updateAccount(id: string, field: keyof SmtpAccount, value: string | number | boolean) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    setSaveStatus('idle'); setTestResult(null);
  }

  function setDefault(id: string) {
    setAccounts(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
  }

  function addAccount() {
    const newId = generateId();
    const newAccount: SmtpAccount = {
      id: newId, label: '', fromName: '', user: '', pass: '',
      host: 'mail.usbusinessgrants.org', port: 465, isDefault: accounts.length === 0,
    };
    setAccounts(prev => [...prev, newAccount]);
    setExpanded(newId);
  }

  function deleteAccount(id: string) {
    setAccounts(prev => {
      const next = prev.filter(a => a.id !== id);
      // If we deleted the default, promote the first remaining
      if (next.length > 0 && !next.some(a => a.isDefault)) next[0].isDefault = true;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true); setSaveStatus('idle'); setSaveError('');
    try {
      const res = await fetch('/api/admin/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ accounts, notificationAccountId }),
      });
      if (res.ok) { setSaveStatus('ok'); setTimeout(() => setSaveStatus('idle'), 3000); }
      else { const d = await res.json() as { message?: string }; setSaveError(d.message ?? 'Save failed'); setSaveStatus('error'); }
    } catch { setSaveError('Network error'); setSaveStatus('error'); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/admin/test-smtp', { headers: { Authorization: `Bearer ${tokenRef.current}` } });
      const d = await res.json() as { allOk: boolean; results?: { label: string; ok: boolean; error?: string }[] };
      if (d.allOk) {
        setTestResult({ ok: true, msg: 'All connections verified ✓' });
      } else {
        const failed = (d.results ?? []).filter(r => !r.ok).map(r => `${r.label}: ${r.error ?? 'failed'}`).join(' · ');
        setTestResult({ ok: false, msg: failed || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Network error' });
    } finally { setTesting(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <Mail size={15} className="text-slate-400" />
        <h2 className="text-[13px] font-semibold text-slate-700">Outbound Email Accounts</h2>
        <span className="ml-auto text-[11px] text-slate-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="px-6 py-5 text-[13px] text-slate-400">Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="px-6 py-5 text-[13px] text-slate-400">No accounts configured yet.</div>
        ) : (
          accounts.map(account => (
            <div key={account.id}>
              {/* Account header row */}
              <div
                className="flex items-center gap-3 px-6 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(prev => prev === account.id ? null : account.id)}
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail size={14} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-700 truncate">
                    {account.label || account.fromName || account.user || 'Untitled account'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{account.user || 'No email set'}</div>
                </div>
                {account.isDefault && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">
                    Default
                  </span>
                )}
                <ChevronDown
                  size={15}
                  className={`text-slate-300 flex-shrink-0 transition-transform ${expanded === account.id ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Expanded edit form */}
              {expanded === account.id && (
                <div className="px-6 pb-5 pt-1 space-y-4 bg-slate-50/50">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Account Label <span className="text-slate-400 font-normal normal-case">(for your reference)</span></label>
                    <input type="text" value={account.label ?? ''} onChange={e => updateAccount(account.id, 'label', e.target.value)}
                      placeholder="e.g. Notifications, CRM Outbound, Support…"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From Name</label>
                      <input type="text" value={account.fromName} onChange={e => updateAccount(account.id, 'fromName', e.target.value)}
                        placeholder="US Business Grants"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From Email</label>
                      <input type="email" value={account.user} onChange={e => updateAccount(account.id, 'user', e.target.value)}
                        placeholder="noreply@example.com"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">SMTP Host</label>
                      <input type="text" value={account.host} onChange={e => updateAccount(account.id, 'host', e.target.value)}
                        placeholder="mail.example.com"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">SMTP Port</label>
                      <input type="number" value={account.port} onChange={e => updateAccount(account.id, 'port', Number(e.target.value))}
                        placeholder="465"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPass[account.id] ? 'text' : 'password'}
                        value={account.pass}
                        onChange={e => updateAccount(account.id, 'pass', e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors pr-9"
                      />
                      <button type="button"
                        onClick={() => setShowPass(prev => ({ ...prev, [account.id]: !prev[account.id] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                        {showPass[account.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Leave as *** to keep the existing password.</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {!account.isDefault && (
                      <button onClick={() => setDefault(account.id)}
                        className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                        Set as Default
                      </button>
                    )}
                    {account.isDefault && (
                      <span className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check size={12} /> Default account
                      </span>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => deleteAccount(account.id)}
                      disabled={accounts.length <= 1}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-red-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-100 space-y-3">
        <button onClick={addAccount}
          className="flex items-center gap-2 text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          <Plus size={14} /> Add Email Account
        </button>

        {testResult && (
          <div className={`rounded-lg px-3 py-2 text-[12px] font-medium ${testResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {testResult.msg}
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="rounded-lg px-3 py-2 text-[12px] font-medium bg-red-50 text-red-700 border border-red-200">{saveError}</div>
        )}

        {/* Notification email picker */}
        {accounts.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Portal Notification Emails (CRM messages, progress updates)
            </label>
            <select
              value={notificationAccountId}
              onChange={e => { setNotificationAccountId(e.target.value); setSaveStatus('idle'); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-400 transition-colors"
            >
              <option value="">Use default account</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.label ? `${a.label} — ` : ''}{a.fromName || a.user}{a.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">Which email account sends &quot;you have a new message&quot; notifications to customers.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4DBA] text-white text-[13px] font-semibold shadow-sm hover:bg-[#0d43a5] transition-colors disabled:opacity-60">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : saveStatus === 'ok' ? <Check size={13} /> : null}
            {saving ? 'Saving…' : saveStatus === 'ok' ? 'Saved!' : 'Save All'}
          </button>
          <button onClick={() => void handleTest()} disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60">
            {testing ? <RefreshCw size={13} className="animate-spin" /> : null}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [saved,        setSaved]        = useState('');
  const [vals,         setVals]         = useState<Record<string, string>>({});
  const [sync,         setSync]         = useState<SyncProgress>({ state: 'idle' });
  const [checkpoint,   setCheckpoint]   = useState<Checkpoint>(null);
  const [contacts,     setContacts]     = useState<ContactEntry[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef('');

  useEffect(() => {
    tokenRef.current = window.localStorage.getItem('usbg:adminToken') ?? '';
    // Check for existing checkpoint
    void fetch('/api/admin/sync-hubspot', { headers: { Authorization: `Bearer ${tokenRef.current}` } })
      .then(r => r.json())
      .then((d: { checkpoint: Checkpoint }) => { if (d.checkpoint?.after) setCheckpoint(d.checkpoint); })
      .catch(() => null);
  }, []);

  async function runSync(mode: 'new' | 'update' | 'resume') {
    setSync({ state: 'running', status: 'Starting…' });
    setCheckpoint(null);
    setContacts([]);
    const params = new URLSearchParams();
    if (mode === 'update') params.set('update', '1');
    if (mode === 'resume') params.set('resume', '1');
    else                   params.set('fresh',  '1');
    const url = `/api/admin/sync-hubspot?${params}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (msg.error) {
              setSync({ state: 'error', error: String(msg.error) });
            } else if (msg.done) {
              setSync({
                state:     'done',
                processed: Number(msg.processed ?? 0),
                total:     Number(msg.total     ?? 0),
                imported:  Number(msg.imported  ?? 0),
                updated:   Number(msg.updated   ?? 0),
                skipped:   Number(msg.skipped   ?? 0),
                noEmail:   Number(msg.noEmail   ?? 0),
              });
            } else {
              // Append new contacts to feed and auto-scroll
              if (Array.isArray(msg.contacts) && msg.contacts.length > 0) {
                setContacts(prev => {
                  const next = [...prev, ...(msg.contacts as ContactEntry[])];
                  return next.slice(-200); // keep last 200
                });
                setTimeout(() => {
                  if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
                }, 0);
              }
              setSync(prev => ({
                ...prev,
                state:     'running',
                status:    typeof msg.status === 'string' ? msg.status : prev.status,
                processed: msg.processed !== undefined ? Number(msg.processed) : prev.processed,
                total:     msg.total     !== undefined ? Number(msg.total)     : prev.total,
                imported:  msg.imported  !== undefined ? Number(msg.imported)  : prev.imported,
                updated:   msg.updated   !== undefined ? Number(msg.updated)   : prev.updated,
                skipped:   msg.skipped   !== undefined ? Number(msg.skipped)   : prev.skipped,
                noEmail:   msg.noEmail   !== undefined ? Number(msg.noEmail)   : prev.noEmail,
              }));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setSync({ state: 'error', error: err instanceof Error ? err.message : 'Network error' });
    }
  }

  // Load saved prefs from localStorage
  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const p of PREFS) {
      loaded[p.key] = window.localStorage.getItem(p.key) ?? p.default;
    }
    setVals(loaded);
  }, []);

  function handleChange(key: string, val: string) {
    window.localStorage.setItem(key, val);
    setVals(prev => ({ ...prev, [key]: val }));
    setSaved(key);
    setTimeout(() => setSaved(''), 2000);
  }

  const pct = sync.total && sync.processed !== undefined
    ? Math.min(100, Math.round((sync.processed / sync.total) * 100))
    : null;

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Outbound Email (SMTP) ── */}
      <SmtpSettingsCard />

      {/* ── Preferences ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-[13px] font-semibold text-slate-700">Preferences</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {PREFS.map(({ key, label, options }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="text-[13px] font-medium text-slate-700">{label}</div>
              <div className="flex items-center gap-2">
                <select
                  value={vals[key] ?? ''}
                  onChange={e => handleChange(key, e.target.value)}
                  className="text-[13px] border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white outline-none focus:border-blue-400 transition-colors"
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {saved === key && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 w-14">
                    <Check size={11} /> Saved
                  </span>
                )}
                {saved !== key && <span className="w-14" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HubSpot Sync ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <RefreshCw size={15} className="text-slate-400" />
          <h2 className="text-[13px] font-semibold text-slate-700">HubSpot Sync</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Import contacts from HubSpot (last 180 days) into the CRM, including all documents and file attachments.
          </p>

          {/* Resume banner */}
          {checkpoint && sync.state === 'idle' && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-amber-800">Previous sync interrupted</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {checkpoint.processed?.toLocaleString()} of {checkpoint.total?.toLocaleString()} processed
                  {checkpoint.savedAt && !isNaN(new Date(checkpoint.savedAt).getTime())
                    ? ` · stopped ${new Date(checkpoint.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => void runSync('resume')}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[12px] font-semibold hover:bg-amber-700 transition-colors"
              >
                <RefreshCw size={11} /> Resume
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => void runSync('new')}
              disabled={sync.state === 'running'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4DBA] text-white text-[13px] font-semibold shadow-sm hover:bg-[#0d43a5] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={sync.state === 'running' ? 'animate-spin' : ''} />
              Sync New Contacts
            </button>
            <button
              onClick={() => void runSync('update')}
              disabled={sync.state === 'running'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-[13px] font-semibold shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={sync.state === 'running' ? 'animate-spin' : ''} />
              Update All Contacts
            </button>
          </div>

          {/* Progress bar */}
          {sync.state === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-slate-500 truncate">{sync.status ?? 'Running…'}</span>
                {pct !== null && (
                  <span className="font-semibold text-slate-700 ml-3 flex-shrink-0">
                    {sync.processed?.toLocaleString()} / {sync.total?.toLocaleString()} ({pct}%)
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-[#0F4DBA] transition-all duration-300"
                  style={{ width: pct !== null ? `${pct}%` : '100%' }}
                />
              </div>
              {(sync.imported !== undefined || sync.updated !== undefined) && (
                <div className="flex gap-4 text-[11px] text-slate-400 font-medium">
                  {sync.imported  !== undefined && <span>{sync.imported.toLocaleString()} imported</span>}
                  {sync.updated   !== undefined && sync.updated > 0 && <span>{sync.updated.toLocaleString()} updated</span>}
                  {sync.skipped   !== undefined && <span>{sync.skipped.toLocaleString()} skipped</span>}
                  {sync.noEmail   !== undefined && sync.noEmail > 0 && <span>{sync.noEmail.toLocaleString()} no email</span>}
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {sync.state === 'done' && (
            <div className="space-y-2">
              <div className="w-full bg-emerald-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-emerald-500 w-full" />
              </div>
              <div className="flex flex-wrap gap-4 text-[12px] font-semibold text-emerald-700">
                <span className="flex items-center gap-1"><Check size={12} /> Done</span>
                {(sync.imported ?? 0) > 0   && <span>{sync.imported?.toLocaleString()} imported</span>}
                {(sync.updated  ?? 0) > 0   && <span>{sync.updated?.toLocaleString()} updated</span>}
                {(sync.skipped  ?? 0) > 0   && <span className="text-slate-500">{sync.skipped?.toLocaleString()} skipped</span>}
                {(sync.noEmail  ?? 0) > 0   && <span className="text-slate-400">{sync.noEmail?.toLocaleString()} no email</span>}
              </div>
            </div>
          )}

          {/* Error */}
          {sync.state === 'error' && (
            <p className="text-[12px] font-semibold text-red-500">{sync.error}</p>
          )}

          {/* Live contact feed */}
          {(sync.state === 'running' || sync.state === 'done') && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Live Feed
                </span>
                <span className="text-[11px] text-slate-400">{contacts.length} shown</span>
              </div>
              <div ref={feedRef} className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {contacts.length === 0 && (
                  <div className="px-3 py-6 text-center text-[12px] text-slate-400">
                    {sync.state === 'running' ? 'Waiting for contacts…' : 'No contacts processed.'}
                  </div>
                )}
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                      ${c.action === 'imported' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                      {c.action === 'imported'
                        ? <UserPlus   size={10} className="text-emerald-600" />
                        : <RefreshCcw size={10} className="text-blue-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] font-semibold text-slate-700 truncate block">{c.name}</span>
                      <span className="text-[11px] text-slate-400 truncate block">{c.email}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0
                      ${c.action === 'imported' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {c.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Keep this tab open while syncing. Large datasets may take a few minutes.
          </p>
        </div>
      </div>

      {/* ── About ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Info size={15} className="text-slate-400" />
          <h2 className="text-[13px] font-semibold text-slate-700">About</h2>
        </div>
        <div className="px-6 py-5 space-y-3">
          {[
            ['CRM Version',  'v0.6.0'],
            ['Platform',     'Next.js 15 · Vercel'],
            ['Database',     'Firebase Firestore'],
            ['Organization', 'US Business Grants'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-0.5">
              <span className="text-[12px] font-medium text-slate-500">{k}</span>
              <span className="text-[12px] font-semibold text-slate-700">{v}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
