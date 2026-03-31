'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Send, Users, Check, AlertCircle, ChevronDown, Zap, CheckCircle2, XCircle, Hash, Clock, ChevronRight, RefreshCw, Eye } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import VariableTextarea from '@/components/ui/VariableTextarea';

type Template = { id: string; name: string; subject: string; body: string; isHtml: boolean };

type Filter = 'all' | 'SF' | 'EF' | 'UF' | 'custom' | 'list';

const FILTER_OPTIONS: { value: Filter; label: string; desc: string; color: string }[] = [
  { value: 'all',    label: 'All Contacts',   desc: 'Every contact in your CRM',      color: 'bg-slate-100 text-slate-700 border-slate-300'   },
  { value: 'SF',     label: 'Starter',        desc: 'Contacts with Starter plan',     color: 'bg-blue-50   text-blue-700  border-blue-300'    },
  { value: 'EF',     label: 'Growth',         desc: 'Contacts with Growth plan',      color: 'bg-amber-50  text-amber-700 border-amber-300'   },
  { value: 'UF',     label: 'Unlimited',      desc: 'Contacts with Unlimited plan',   color: 'bg-purple-50 text-purple-700 border-purple-300' },
  { value: 'list',   label: 'Contact List',   desc: 'Send to a saved contact list',   color: 'bg-teal-50   text-teal-700  border-teal-300'    },
  { value: 'custom', label: 'Custom Emails',  desc: 'Paste specific email addresses', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
];

function token() {
  return typeof window !== 'undefined' ? (window.localStorage.getItem('usbg:adminToken') ?? '') : '';
}

type SendResult = { sent: number; failed: number; total: number; errors: string[] };

type BulkLog = {
  id: string; subject: string; bodyPreview: string; isHtml: boolean;
  filter: string; sent: number; failed: number; total: number;
  errors: string[]; sentAt: string;
  customEmails: string[]; recipients: string[];
};

const FILTER_LABELS: Record<string, { label: string; color: string }> = {
  all:    { label: 'All',       color: 'bg-slate-100 text-slate-600' },
  SF:     { label: 'Starter',   color: 'bg-blue-100 text-blue-700'   },
  EF:     { label: 'Growth',    color: 'bg-amber-100 text-amber-700' },
  UF:     { label: 'Unlimited', color: 'bg-purple-100 text-purple-700' },
  custom: { label: 'Custom',    color: 'bg-emerald-100 text-emerald-700' },
};

// Mirror of the server-side baseTemplate so preview matches actual email
function buildPreviewHtml(body: string, isHtml: boolean): string {
  const bodyHtml = isHtml
    ? body
    : `<div style="font-size:14px;color:#475569;line-height:1.7">${body.replace(/\n/g, '<br>')}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:600px;width:100%">
      <tr><td style="background:#0F4DBA;padding:20px 32px"><span style="color:#fff;font-size:18px;font-weight:bold">US Business Grants</span></td></tr>
      <tr><td style="padding:32px">${bodyHtml}</td></tr>
      <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:11px;color:#94a3b8">You received this email because you applied for a grant through US Business Grants.</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function previewSubstitute(text: string): string {
  return text
    .replace(/\{\{name\}\}/g,         'John Doe')
    .replace(/\{\{firstName\}\}/g,    'John')
    .replace(/\{\{lastName\}\}/g,     'Doe')
    .replace(/\{\{businessName\}\}/g, 'Acme LLC')
    .replace(/\{\{email\}\}/g,        'john@acme.com');
}

function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function BulkEmailPage() {
  const [templates, setTemplates]           = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTplDropdown, setShowTplDropdown]   = useState(false);

  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState('');
  const [isHtml,    setIsHtml]    = useState(false);

  const [filter,         setFilter]         = useState<Filter>('all');
  const [customEmails,   setCustomEmails]   = useState('');
  const [crmLists,       setCrmLists]       = useState<{ id: string; name: string; count: number }[]>([]);
  const [crmListsLoaded, setCrmListsLoaded] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [smtpAccounts,   setSmtpAccounts]   = useState<{ id: string; label?: string; fromName: string; user: string; isDefault: boolean }[]>([]);
  const [fromAccountId,  setFromAccountId]  = useState('');

  const [recipientCount,        setRecipientCount]        = useState<number | null>(null);
  const [recipientCountLoading, setRecipientCountLoading] = useState(false);

  const [sending,   setSending]   = useState(false);
  const [result,    setResult]    = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState('');

  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [showPreview,  setShowPreview]  = useState(false);

  const [history,        setHistory]        = useState<BulkLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedLog,    setExpandedLog]    = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/bulk-email?history=1', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setHistory(await res.json() as BulkLog[]);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Load templates
  useEffect(() => {
    fetch('/api/admin/email-templates', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() as Promise<Template[]> : [])
      .then(t => setTemplates(t))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  // Load SMTP accounts + CRM lists on mount
  useEffect(() => {
    fetch('/api/admin/settings/smtp', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() as Promise<{ accounts?: { id: string; label?: string; fromName: string; user: string; isDefault: boolean }[] }> : { accounts: [] })
      .then(d => {
        const accts = d.accounts ?? [];
        setSmtpAccounts(accts);
        const def = accts.find(a => a.isDefault) ?? accts[0];
        if (def) setFromAccountId(def.id);
      })
      .catch(() => {});

    fetch('/api/admin/lists', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() as Promise<{ id: string; name: string; count: number }[]> : [])
      .then(l => { setCrmLists(l); setCrmListsLoaded(true); })
      .catch(() => setCrmListsLoaded(true));
  }, []);

  // Fetch recipient count when filter changes (not for custom/list)
  const fetchCount = useCallback(async (f: Filter) => {
    if (f === 'custom' || f === 'list') { setRecipientCount(null); return; }
    setRecipientCountLoading(true);
    try {
      const res = await fetch(`/api/admin/bulk-email?filter=${f}`, { headers: { Authorization: `Bearer ${token()}` } });
      const d   = await res.json() as { count: number };
      setRecipientCount(d.count ?? 0);
    } catch { setRecipientCount(null); }
    finally   { setRecipientCountLoading(false); }
  }, []);

  useEffect(() => { void fetchCount(filter); }, [filter, fetchCount]);

  function applyTemplate(t: Template) {
    setSelectedTemplate(t);
    setSubject(t.subject);
    setBody(t.body);
    setIsHtml(t.isHtml);
    setShowTplDropdown(false);
    setResult(null);
    setSendError('');
  }

  function customEmailCount() {
    return customEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@')).length;
  }

  const selectedList = crmLists.find(l => l.id === selectedListId);
  const displayCount = filter === 'custom'
    ? customEmailCount()
    : filter === 'list'
      ? (selectedList?.count ?? 0)
      : (recipientCount ?? 0);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) { setSendError('Subject and body are required.'); return; }

    const customList = filter === 'custom'
      ? customEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
      : [];

    if (filter === 'custom' && customList.length === 0) {
      setSendError('Enter at least one valid email address.');
      return;
    }

    setSending(true); setSendError(''); setResult(null); setConfirmOpen(false);
    try {
      const res = await fetch('/api/admin/bulk-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          isHtml,
          filter,
          emails:        filter === 'custom' ? customList : undefined,
          listId:        filter === 'list'   ? selectedListId : undefined,
          fromAccountId: fromAccountId || undefined,
        }),
      });
      const d = await res.json() as SendResult & { message?: string };
      if (!res.ok) { setSendError(d.message ?? 'Send failed.'); return; }
      setResult(d);
      void loadHistory(); // refresh history after send
    } catch { setSendError('Network error. Please try again.'); }
    finally   { setSending(false); }
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F4DBA] to-[#032D67] flex items-center justify-center flex-shrink-0 shadow-sm">
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Email Marketing</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Send templated or custom emails to a filtered group of contacts from{' '}
            <span className="font-semibold text-slate-700">
              {smtpAccounts.find(a => a.id === fromAccountId)?.user ?? 'applications@usbusinessgrants.org'}
            </span>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — Compose */}
        <div className="lg:col-span-2 space-y-4">

          {/* Template picker */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Template (optional)</h2>
            {templatesLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Spinner size={14} /> Loading templates…</div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-slate-400">No templates yet. <a href="/admin/marketing/emails" className="text-blue-600 hover:underline font-semibold">Create one →</a></p>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowTplDropdown(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 transition-colors"
                >
                  <span className={selectedTemplate ? 'text-[#1F315C] font-semibold' : 'text-slate-400'}>
                    {selectedTemplate ? selectedTemplate.name : 'Select a template…'}
                  </span>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${showTplDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showTplDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-blue-50 transition-colors ${selectedTemplate?.id === t.id ? 'bg-blue-50' : ''}`}
                      >
                        <Mail size={14} className="text-slate-400 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-[#1F315C]">{t.name}</div>
                          <div className="text-xs text-slate-400 truncate">{t.subject}</div>
                        </div>
                        {t.isHtml && <span className="ml-auto text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded uppercase">HTML</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compose */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-1">Compose</h2>
              {/* Edit / Preview tabs */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                <button onClick={() => setShowPreview(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${!showPreview ? 'bg-white shadow text-[#1F315C]' : 'text-slate-400'}`}>
                  Edit
                </button>
                <button onClick={() => setShowPreview(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${showPreview ? 'bg-white shadow text-[#1F315C]' : 'text-slate-400'}`}>
                  <Eye size={11} /> Preview
                </button>
              </div>
              {/* Plain / HTML toggle — only in Edit mode */}
              {!showPreview && (
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                  <button onClick={() => setIsHtml(false)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${!isHtml ? 'bg-white shadow text-[#1F315C]' : 'text-slate-400'}`}>
                    Plain
                  </button>
                  <button onClick={() => setIsHtml(true)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${isHtml ? 'bg-white shadow text-purple-700' : 'text-slate-400'}`}>
                    HTML
                  </button>
                </div>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                {showPreview ? (
                  <div className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-700 min-h-[36px]">
                    {previewSubstitute(subject) || <span className="text-slate-400 italic">No subject</span>}
                  </div>
                ) : (
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Important update for {{businessName}}"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Body</label>
                {showPreview ? (
                  <div className="rounded-lg border border-slate-200 overflow-hidden" style={{ height: '360px' }}>
                    <iframe
                      srcDoc={buildPreviewHtml(previewSubstitute(body), isHtml)}
                      className="w-full h-full"
                      sandbox="allow-same-origin"
                      title="Email preview"
                    />
                  </div>
                ) : isHtml ? (
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
                    placeholder="<p>Hi {{name}},</p><p>...</p>"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none font-mono" />
                ) : (
                  <VariableTextarea
                    value={body}
                    onChange={setBody}
                    rows={14}
                    placeholder="Type your message… Type {{ to insert a variable like {{name}} or {{businessName}}"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right — Recipients + Send */}
        <div className="space-y-4">
          {/* Recipients */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recipients</h2>
            <div className="space-y-2">
              {FILTER_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  filter === opt.value ? `${opt.color} border-current` : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input type="radio" name="filter" value={opt.value} checked={filter === opt.value}
                    onChange={() => setFilter(opt.value)} className="mt-0.5 accent-[#0F4DBA]" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#1F315C]">{opt.label}</div>
                    <div className="text-xs text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* List picker */}
            {filter === 'list' && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Select List</label>
                {!crmListsLoaded ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner size={13} /> Loading lists…</div>
                ) : crmLists.length === 0 ? (
                  <p className="text-sm text-slate-400">No lists found. <a href="/admin/contacts/lists" className="text-blue-600 underline">Create one →</a></p>
                ) : (
                  <select
                    value={selectedListId}
                    onChange={e => setSelectedListId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="">— Choose a list —</option>
                    {crmLists.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.count} contacts)</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Custom emails textarea */}
            {filter === 'custom' && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email Addresses</label>
                <textarea
                  value={customEmails}
                  onChange={e => setCustomEmails(e.target.value)}
                  rows={5}
                  placeholder="john@example.com&#10;jane@example.com&#10;or comma/semicolon separated…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">{customEmailCount()} valid address{customEmailCount() !== 1 ? 'es' : ''}</p>
              </div>
            )}
          </div>

          {/* From account picker */}
          {smtpAccounts.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Send From</label>
              <div className="flex flex-wrap gap-2">
                {smtpAccounts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setFromAccountId(a.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                      fromAccountId === a.id
                        ? 'border-[#0E468F] bg-blue-50 text-[#0E468F]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Mail size={12} />
                    {a.label || a.fromName || a.user}
                    {a.isDefault && <span className="text-[10px] text-slate-400">(default)</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recipient count badge */}
          {filter !== 'custom' && filter !== 'list' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Users size={16} className="text-[#0F4DBA] flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Will reach</div>
                {recipientCountLoading ? (
                  <div className="flex items-center gap-1.5 mt-0.5"><Spinner size={12} /><span className="text-sm text-slate-500">Counting…</span></div>
                ) : (
                  <div className="text-xl font-black text-[#1F315C]">{recipientCount ?? '—'} <span className="text-sm font-semibold text-slate-500">contacts</span></div>
                )}
              </div>
            </div>
          )}
          {(filter === 'list' || filter === 'custom') && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Users size={16} className="text-[#0F4DBA] flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Will reach</div>
                <div className="text-xl font-black text-[#1F315C]">{displayCount} <span className="text-sm font-semibold text-slate-500">contacts</span></div>
              </div>
            </div>
          )}

          {/* Send result */}
          {result && (
            <div className={`rounded-xl border p-4 ${result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.failed === 0
                  ? <Check size={16} className="text-green-600" />
                  : <AlertCircle size={16} className="text-amber-600" />}
                <span className="text-sm font-bold text-[#1F315C]">
                  {result.failed === 0 ? 'All sent!' : 'Partially sent'}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                  <span>Sent: <strong>{result.sent}</strong></span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5">
                    <XCircle size={13} className="text-red-400 flex-shrink-0" />
                    <span>Failed: <strong>{result.failed}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Hash size={13} className="text-slate-400 flex-shrink-0" />
                  <span>Total: {result.total}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => <div key={i} className="truncate">{e}</div>)}
                </div>
              )}
            </div>
          )}

          {sendError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={14} />{sendError}
            </div>
          )}

          {/* Send button */}
          <button
            onClick={() => {
              setSendError('');
              if (!subject.trim() || !body.trim()) { setSendError('Subject and body are required.'); return; }
              if (filter === 'custom' && customEmailCount() === 0) { setSendError('Enter at least one valid email address.'); return; }
              setConfirmOpen(true);
            }}
            disabled={sending}
            className="w-full bg-gradient-to-r from-[#0F4DBA] to-[#032D67] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2 shadow transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            {sending
              ? <><Spinner size={16} /> Sending…</>
              : <><Send size={15} /> Send to {filter === 'custom' ? `${customEmailCount()} contacts` : recipientCount !== null ? `${recipientCount} contacts` : 'contacts'}</>}
          </button>
        </div>
      </div>

      {/* ── Send History ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <Clock size={15} className="text-slate-400" />
          <h2 className="text-[13px] font-semibold text-slate-700">Send History</h2>
          <span className="text-[11px] text-slate-400 ml-1">Last 20 sends</span>
          <button onClick={() => void loadHistory()} disabled={historyLoading}
            className="ml-auto text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
            <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400">
            <Spinner size={14} /> Loading history…
          </div>
        ) : history.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No bulk emails sent yet. Your send history will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map(log => {
              const tier = FILTER_LABELS[log.filter] ?? { label: log.filter, color: 'bg-slate-100 text-slate-600' };
              const isExpanded = expandedLog === log.id;
              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.failed === 0 ? 'bg-emerald-400' : log.sent === 0 ? 'bg-red-400' : 'bg-amber-400'}`} />

                    {/* Subject */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-700 truncate">{log.subject}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{timeAgo(log.sentAt)}</div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.color}`}>{tier.label}</span>
                      <div className="flex items-center gap-1 text-[12px]">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="font-semibold text-slate-700">{log.sent}</span>
                        <span className="text-slate-400">/ {log.total}</span>
                      </div>
                      {log.failed > 0 && (
                        <div className="flex items-center gap-1 text-[12px]">
                          <XCircle size={12} className="text-red-400" />
                          <span className="font-semibold text-red-500">{log.failed}</span>
                        </div>
                      )}
                      <ChevronRight size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 bg-slate-50/60 space-y-2.5">
                      <div className="flex flex-wrap gap-4 text-[12px]">
                        <div><span className="text-slate-400 font-medium">Sent at: </span><span className="text-slate-700 font-semibold">{new Date(log.sentAt).toLocaleString()}</span></div>
                        <div><span className="text-slate-400 font-medium">Segment: </span><span className="text-slate-700 font-semibold">{FILTER_LABELS[log.filter]?.label ?? log.filter}</span></div>
                        <div><span className="text-slate-400 font-medium">Format: </span><span className={`font-semibold ${log.isHtml ? 'text-purple-600' : 'text-slate-700'}`}>{log.isHtml ? 'HTML' : 'Plain text'}</span></div>
                      </div>

                      {/* Recipients list */}
                      {log.recipients.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Recipients ({log.recipients.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {log.recipients.map((email, i) => (
                              <span key={i} className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-0.5 text-slate-600 font-medium">
                                {email}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {log.bodyPreview && (
                        <div className="text-[12px] text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono line-clamp-3">
                          {log.bodyPreview}{log.bodyPreview.length >= 200 ? '…' : ''}
                        </div>
                      )}
                      {log.errors.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-red-500 uppercase tracking-wide">Delivery errors</div>
                          {log.errors.map((e, i) => (
                            <div key={i} className="text-[11px] text-red-600 truncate">{e}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <Send size={22} className="text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-[#1F315C] text-center mb-1">Send Bulk Email?</h2>
            <p className="text-sm text-slate-500 text-center mb-1">
              This will send <strong className="text-[#1F315C]">{displayCount} email{displayCount !== 1 ? 's' : ''}</strong> immediately.
            </p>
            <p className="text-xs text-slate-400 text-center mb-5">From: applications@usbusinessgrants.org</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => void handleSend()} className="flex-1 py-2.5 rounded-xl bg-[#0F4DBA] text-white text-sm font-bold hover:bg-[#0d43a8] transition-colors">
                Yes, Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
