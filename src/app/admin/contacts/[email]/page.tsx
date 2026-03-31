'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Eye, Send, Pencil, Check, X,
  User, FileText, MessageSquare, BarChart2, StickyNote, Plus, Trash2, RefreshCw, Mail, ChevronDown,
} from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import CustomSelect from '@/components/ui/CustomSelect';
import VariableTextarea from '@/components/ui/VariableTextarea';
import { useToast } from '@/app/admin/_toast-context';

type NoteItem = { id: string; body: string; createdAt: string };
type MsgItem  = { id: string; body: string; sentAt: string; read: boolean };

type UserDetail = {
  properties: Record<string, string | null>;
  docs: Record<string, { key: string; label?: string; filename?: string; url?: string }>;
  progressOverride: { progressStep?: number; financeWarning?: boolean } | null;
  notes: NoteItem[];
  messages: MsgItem[];
  formData?: Record<string, string>;
};

const STEP_LABELS = ['Received', 'Administrative Review', 'Finance Review', 'Programmatic Review', 'Grant Matches', 'Sent'];

const PR_TIERS = [
  { value: 'SF', label: 'Starter', color: 'bg-blue-50   text-blue-700  border-blue-200',    active: 'bg-blue-600  text-white border-blue-600'   },
  { value: 'EF', label: 'Growth',  color: 'bg-amber-50  text-amber-700  border-amber-200',  active: 'bg-amber-500 text-white border-amber-500'   },
  { value: 'UF', label: 'Unlimited',     color: 'bg-purple-50 text-purple-700 border-purple-200', active: 'bg-purple-600 text-white border-purple-600' },
];

function prMeta(pr: string) {
  if (pr === 'SF' || pr === 'TRUE') return { label: 'Starter', color: 'bg-blue-100   text-blue-700'   };
  if (pr === 'EF')                  return { label: 'Growth',  color: 'bg-amber-100  text-amber-700'  };
  if (pr === 'UF')                  return { label: 'Unlimited',     color: 'bg-purple-100 text-purple-700' };
  return { label: pr || 'None', color: 'bg-slate-100 text-slate-500' };
}

function field(val: string | null | undefined) { return val?.trim() || '—'; }

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function initials(firstname: string, lastname: string, email: string) {
  const f = firstname?.[0] ?? '';
  const l = lastname?.[0] ?? '';
  return (f + l).toUpperCase() || email?.[0]?.toUpperCase() || '?';
}

function EditableField({ label, value, fieldKey, onSave }: {
  label: string; value: string; fieldKey: string;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const [saving, setSaving]   = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSave(fieldKey, draft); setEditing(false); } finally { setSaving(false); }
  }
  function handleCancel() { setDraft(value); setEditing(false); }

  return (
    <div className="group">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') handleCancel(); }}
            className="flex-1 rounded-lg border border-blue-400 px-2 py-1 text-sm text-slate-800 outline-none"
          />
          <button onClick={() => void handleSave()} disabled={saving} className="text-green-600 hover:text-green-700 disabled:opacity-50">
            {saving ? <Spinner size={13} /> : <Check size={15} />}
          </button>
          <button onClick={handleCancel} className="text-red-400 hover:text-red-500"><X size={15} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-h-[26px]">
          <span className="text-sm font-semibold text-slate-800 break-words flex-1">
            {fieldKey === 'website' && value && value !== '—'
              ? <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">{value}</a>
              : value || '—'}
          </span>
          <button onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-blue-500 flex-shrink-0">
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

type Tab = 'overview' | 'documents' | 'messages' | 'progress' | 'email';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: 'Overview',   icon: <User size={15} /> },
  { id: 'documents',  label: 'Documents',  icon: <FileText size={15} /> },
  { id: 'messages',   label: 'Messages',   icon: <MessageSquare size={15} /> },
  { id: 'progress',   label: 'Progress',   icon: <BarChart2 size={15} /> },
  { id: 'email',      label: 'Email',      icon: <Mail size={15} /> },
];

type EmailTemplate = { id: string; name: string; subject: string; body: string; isHtml: boolean };
type EmailLog = { id: string; subject: string; body: string; sentAt: string; from: string };

export default function AdminContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const email  = decodeURIComponent(String(params.email ?? ''));
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [data,          setData]          = useState<UserDetail | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [tab,           setTab]           = useState<Tab>('overview');
  const [props,         setProps]         = useState<Record<string, string | null>>({});

  const [progressStep,    setProgressStep]    = useState<number>(-1);
  const [financeWarning,  setFinanceWarning]  = useState(false);
  const [savingProgress,  setSavingProgress]  = useState(false);
  const [progressSaved,   setProgressSaved]   = useState(false);

  const [prSaved, setPrSaved] = useState(false);

  const [messages,     setMessages]     = useState<MsgItem[]>([]);
  const [messageBody,  setMessageBody]  = useState('');
  const [sending,      setSending]      = useState(false);
  const [sendStatus,   setSendStatus]   = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  const [notes,       setNotes]       = useState<NoteItem[]>([]);
  const [newNote,     setNewNote]     = useState('');
  const [addingNote,  setAddingNote]  = useState(false);

  const [hsSyncing,   setHsSyncing]   = useState(false);
  const [hsSyncDone,  setHsSyncDone]  = useState(false);
  const [hsSyncError, setHsSyncError] = useState('');

  const [brevoSyncing,   setBrevoSyncing]   = useState(false);
  const [brevoSyncDone,  setBrevoSyncDone]  = useState(false);
  const [brevoSyncError, setBrevoSyncError] = useState('');

  // ── Email tab state ──────────────────────────────────────────────────────
  const [emailTemplates,    setEmailTemplates]    = useState<EmailTemplate[]>([]);
  const [emailTemplatesLoaded, setEmailTemplatesLoaded] = useState(false);
  const [selectedTemplate,  setSelectedTemplate]  = useState<EmailTemplate | null>(null);
  const [emailSubject,      setEmailSubject]      = useState('');
  const [emailBody,         setEmailBody]         = useState('');
  const [sendingEmail,      setSendingEmail]      = useState(false);
  const [emailSendStatus,   setEmailSendStatus]   = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailLog,          setEmailLog]          = useState<EmailLog[]>([]);
  const [emailLogLoading,   setEmailLogLoading]   = useState(false);
  const [expandedEmailId,   setExpandedEmailId]   = useState<string | null>(null);
  const [smtpAccounts,      setSmtpAccounts]      = useState<{ id: string; fromName: string; user: string; isDefault: boolean }[]>([]);
  const [fromAccountId,     setFromAccountId]     = useState<string>('');

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('usbg:adminToken') ?? '' : '';

  const load = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(`/api/admin/user?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      if (!res.ok)            { setError('Failed to load contact.'); return; }
      const d = (await res.json()) as UserDetail;
      setData(d);
      setProps(d.properties);
      setProgressStep(d.progressOverride?.progressStep ?? -1);
      setFinanceWarning(d.progressOverride?.financeWarning ?? false);
      setNotes(d.notes ?? []);
      setMessages(d.messages ?? []);
    } catch { setError('Failed to load contact.'); }
    finally  { setLoading(false); }
  }, [email, token, router]);

  useEffect(() => { void load(); }, [load]);

  // Load email templates lazily when Email tab is opened
  async function loadEmailTemplates() {
    if (emailTemplatesLoaded) return;
    try {
      const res = await fetch('/api/admin/email-templates', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEmailTemplates(await res.json() as EmailTemplate[]);
    } catch { /* ignore */ }
    setEmailTemplatesLoaded(true);
  }

  async function loadEmailLog() {
    setEmailLogLoading(true);
    try {
      const res = await fetch(`/api/admin/send-crm-email?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEmailLog(await res.json() as EmailLog[]);
    } catch { /* ignore */ }
    finally { setEmailLogLoading(false); }

    void fetch('/api/admin/settings/smtp', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { accounts?: { id: string; fromName: string; user: string; isDefault: boolean }[] }) => {
        const accts = d.accounts ?? [];
        setSmtpAccounts(accts);
        const def = accts.find(a => a.isDefault) ?? accts[0];
        if (def) setFromAccountId(def.id);
      })
      .catch(() => null);
  }

  function applyEmailTemplate(t: EmailTemplate) {
    setSelectedTemplate(t);
    setEmailSubject(t.subject);
    setEmailBody(t.body);
    setEmailSendStatus(null);
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true); setEmailSendStatus(null);
    try {
      const res = await fetch('/api/admin/send-crm-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject: emailSubject,
          body: emailBody,
          isHtml: selectedTemplate?.isHtml ?? false,
          firstName: props.firstname ?? '',
          lastName:  props.lastname  ?? '',
          businessName: props.company ?? '',
          fromAccountId,
        }),
      });
      if (res.ok) {
        setEmailSendStatus({ type: 'success', message: 'Email sent successfully!' });
        toastSuccess('Email sent', email);
        setEmailSubject(''); setEmailBody(''); setSelectedTemplate(null);
        void loadEmailLog();
      } else {
        const d = await res.json() as { message?: string };
        setEmailSendStatus({ type: 'error', message: d.message ?? 'Failed to send.' });
        toastError('Email failed to send', d.message ?? 'Check SMTP settings');
      }
    } catch {
      setEmailSendStatus({ type: 'error', message: 'Network error. Please try again.' });
      toastError('Email failed to send', 'Network error');
    } finally { setSendingEmail(false); }
  }

  async function handleFieldSave(key: string, val: string) {
    const map: Record<string, string> = {
      firstname: 'firstname', lastname: 'lastname', company: 'businessName',
      phone: 'phone', address: 'address', city: 'city', state: 'state', zip: 'zip',
      industry: 'industry', website: 'website', annualrevenue: 'annualrevenue',
      numemployees: 'numemployees', pr: 'pr',
    };
    await fetch('/api/admin/update-contact', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, field: map[key] ?? key, value: val }),
    });
    setProps(prev => ({ ...prev, [key]: val }));
    toastInfo(`${key.charAt(0).toUpperCase() + key.slice(1)} updated`);
  }

  async function handlePrChange(val: string) {
    await handleFieldSave('pr', val);
    setPrSaved(true);
    setTimeout(() => setPrSaved(false), 1800);
  }

  async function syncFromHubSpot() {
    setHsSyncing(true); setHsSyncDone(false); setHsSyncError('');
    try {
      // Use single-contact HubSpot lookup via the bulk sync endpoint with just this email
      const res = await fetch(`/api/admin/sync-hubspot-contact?email=${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        setHsSyncDone(true);
        setTimeout(() => setHsSyncDone(false), 3000);
        toastSuccess('Synced from HubSpot', email);
        void load();
      } else {
        setHsSyncError(d.error ?? 'Sync failed');
        toastError('HubSpot sync failed', d.error ?? 'Sync failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setHsSyncError(msg);
      toastError('HubSpot sync failed', msg);
    } finally {
      setHsSyncing(false);
    }
  }

  async function syncToBrevo() {
    setBrevoSyncing(true); setBrevoSyncDone(false); setBrevoSyncError('');
    try {
      const res = await fetch('/api/admin/brevo-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; listId?: number };
      if (d.ok) {
        setBrevoSyncDone(true);
        setTimeout(() => setBrevoSyncDone(false), 3000);
        toastSuccess('Synced to Brevo', email);
      } else {
        setBrevoSyncError(d.error ?? 'Sync failed');
        toastError('Brevo sync failed', d.error ?? 'Sync failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setBrevoSyncError(msg);
      toastError('Brevo sync failed', msg);
    } finally {
      setBrevoSyncing(false);
    }
  }

  async function saveProgress() {
    setSavingProgress(true); setProgressSaved(false);
    try {
      await fetch('/api/admin/update-progress', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, progressStep, financeWarning }),
      });
      setProgressSaved(true);
      toastSuccess('Progress saved');
      setTimeout(() => setProgressSaved(false), 2500);
    } finally { setSavingProgress(false); }
  }

  async function sendMessage() {
    if (!messageBody.trim()) return;
    setSending(true); setSendStatus(null);
    try {
      const userName = `${props.firstname ?? ''} ${props.lastname ?? ''}`.trim() || (props.company ?? '') || email;
      const res = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userName, body: messageBody }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setMessages(prev => [{ id: now, body: messageBody.trim(), sentAt: now, read: false }, ...prev]);
        setSendStatus({ type: 'success', message: 'Message sent.' });
        toastSuccess('Message sent', email);
        setMessageBody('');
      } else {
        setSendStatus({ type: 'error', message: 'Send failed.' });
        toastError('Message failed to send');
      }
    } catch {
      setSendStatus({ type: 'error', message: 'Send failed.' });
      toastError('Message failed to send');
    }
    finally   { setSending(false); }
  }

  async function deleteMessage(id: string) {
    setDeletingId(id);
    try {
      await fetch('/api/admin/delete-message', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, messageId: id }),
      });
      setMessages(prev => prev.filter(m => m.id !== id));
    } finally { setDeletingId(null); }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch('/api/admin/add-note', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, note: newNote.trim() }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setNotes(prev => [{ id: now, body: newNote.trim(), createdAt: now }, ...prev]);
        setNewNote('');
      }
    } finally { setAddingNote(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={36} /></div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data)   return null;

  const name = `${props.firstname ?? ''} ${props.lastname ?? ''}`.trim() || (props.company ?? email);
  const pr   = prMeta(props.pr ?? '');
  const ini  = initials(props.firstname ?? '', props.lastname ?? '', email);
  const uploadedDocs = Object.values(data.docs).filter(d => !d.key.startsWith('ai_'));
  const aiDocs       = Object.values(data.docs).filter(d =>  d.key.startsWith('ai_'));

  return (
    <div className="space-y-5 pb-10">

      {/* ── Back nav ── */}
      <div className="flex items-center gap-2">
        <Link href="/admin/contacts" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft size={15} /> Contacts
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-700 truncate max-w-xs">{name}</span>
      </div>

      {/* ── Profile header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-black flex-shrink-0 shadow">
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-black text-[#1F315C] leading-tight">{name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${pr.color}`}>{pr.label}</span>
          </div>
          <div className="text-sm text-slate-500 font-medium">{props.email || email}</div>
          {props.company && props.company !== name && (
            <div className="text-xs text-slate-400 mt-0.5">{props.company}</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400 font-medium">
            {props.state && <span>📍 {props.state}</span>}
            {props.phone && <span>📞 {props.phone}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => void syncToBrevo()}
              disabled={brevoSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{ borderColor: '#0B996E', color: '#0B996E' }}
            >
              {brevoSyncing ? (
                <RefreshCw size={11} className="animate-spin" style={{ color: '#0B996E' }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path fill="#0B996E" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 7.4c1.04 0 1.87.85 1.87 1.88 0 1.04-.83 1.88-1.87 1.88-1.03 0-1.87-.84-1.87-1.88 0-1.03.84-1.87 1.87-1.87zM9.3 8.67c.96 0 1.8.56 2.21 1.38l1.78 3.43c.37.72 1.1 1.18 1.9 1.18h.37l.87 1.67H15.2c-1.36 0-2.6-.76-3.24-1.97l-.47-.9-1.12 2.87H8.5l2.07-5.01-.42-.8c-.21-.4-.62-.65-1.07-.65H7.5L6.63 8.67H9.3z"/>
                </svg>
              )}
              {brevoSyncing ? 'Syncing…' : 'Sync to Brevo'}
            </button>
            <button
              onClick={() => void syncFromHubSpot()}
              disabled={hsSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{ borderColor: '#FF7A59', color: '#FF7A59' }}
            >
              {hsSyncing ? (
                <RefreshCw size={11} className="animate-spin" style={{ color: '#FF7A59' }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 56 56" fill="none">
                  <path d="M34.4 14.7V9.5a4.3 4.3 0 0 0 2.5-3.9V5.5A4.3 4.3 0 0 0 32.6 1.2h-.1A4.3 4.3 0 0 0 28.2 5.5v.1a4.3 4.3 0 0 0 2.5 3.9v5.2c-2.9.4-5.5 1.7-7.6 3.5L9.7 8.6a4.8 4.8 0 1 0-2 3.2l13 9.3A15.2 15.2 0 0 0 18 28.5c0 3.3 1.1 6.4 2.9 8.9l-3.9 3.9a3.8 3.8 0 1 0 2.7 2.6l4.1-4.1a15.3 15.3 0 0 0 23.5-12.9c0-6.5-4-12.1-9.9-14.2zm-1.9 23.4a8.8 8.8 0 1 1 0-17.6 8.8 8.8 0 0 1 0 17.6z" fill="#FF7A59"/>
                </svg>
              )}
              {hsSyncing ? 'Syncing…' : 'Sync from HubSpot'}
            </button>
          </div>
          {brevoSyncDone  && <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1"><Check size={11} /> Pushed to Brevo</span>}
          {brevoSyncError && <span className="text-[11px] font-semibold text-red-500 max-w-[200px] text-right">{brevoSyncError}</span>}
          {hsSyncDone  && <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><Check size={11} /> Synced</span>}
          {hsSyncError && <span className="text-[11px] font-semibold text-red-500 max-w-[160px] text-right">{hsSyncError}</span>}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 w-fit shadow-sm">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'email') { void loadEmailTemplates(); void loadEmailLog(); } }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-[#0F4DBA] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
            }`}>
            {t.icon} {t.label}
            {t.id === 'messages' && messages.length > 0 && (
              <span className="ml-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold px-1.5 py-0.5 leading-none">
                {messages.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════ OVERVIEW ════ */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <EditableField label="First Name"      value={field(props.firstname)}    fieldKey="firstname"    onSave={handleFieldSave} />
                <EditableField label="Last Name"       value={field(props.lastname)}     fieldKey="lastname"     onSave={handleFieldSave} />
                <EditableField label="Email"           value={field(props.email)}        fieldKey="email"        onSave={handleFieldSave} />
                <EditableField label="Phone"           value={field(props.phone)}        fieldKey="phone"        onSave={handleFieldSave} />
                <EditableField label="Business Name"   value={field(props.company)}      fieldKey="company"      onSave={handleFieldSave} />
                <EditableField label="Industry"        value={field(props.industry)}     fieldKey="industry"     onSave={handleFieldSave} />
                <EditableField label="Funding Use"     value={field(props.fundingUse)}   fieldKey="fundingUse"   onSave={handleFieldSave} />
                <EditableField label="Annual Revenue"  value={field(props.annualrevenue)}fieldKey="annualrevenue"onSave={handleFieldSave} />
                <EditableField label="Employees"       value={field(props.numemployees)} fieldKey="numemployees" onSave={handleFieldSave} />
                <EditableField label="Website"         value={field(props.website)}      fieldKey="website"      onSave={handleFieldSave} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="sm:col-span-2">
                  <EditableField label="Street Address" value={field(props.address)} fieldKey="address" onSave={handleFieldSave} />
                </div>
                <EditableField label="City"     value={field(props.city)}  fieldKey="city"  onSave={handleFieldSave} />
                <EditableField label="State"    value={field(props.state)} fieldKey="state" onSave={handleFieldSave} />
                <EditableField label="Zip Code" value={field(props.zip)}   fieldKey="zip"   onSave={handleFieldSave} />
              </div>
            </div>

            {/* ── Form Submission Data ── show any extra fields from signup form */}
            {data?.formData && Object.keys(data.formData).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Additional Info</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(data.formData).map(([k, v]) => {
                    const LABEL_MAP: Record<string, string> = {
                      monthlyRevenue: 'Monthly Revenue',
                      grossMonthlyRevenue: 'Monthly Revenue',
                      fundingUse: 'Funding Use',
                      fundUses: 'Funding Use',
                      plan: 'Plan',
                      business_type: 'Business Type',
                      numemployees: 'Employees',
                      annualrevenue: 'Annual Revenue',
                    };
                    const label = LABEL_MAP[k] ?? k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
                    return (
                      <div key={k}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                          {label}
                        </div>
                        <div className="text-sm font-medium text-slate-700 break-words">{v}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">PR Tier</h2>
                {prSaved && <span className="text-xs font-bold text-green-600 flex items-center gap-1"><Check size={11} /> Saved</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {PR_TIERS.map(tier => {
                  const isActive = props.pr === tier.value || (tier.value === 'SF' && props.pr === 'TRUE');
                  return (
                    <button key={tier.value} onClick={() => void handlePrChange(tier.value)}
                      className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${isActive ? tier.active : `${tier.color} hover:opacity-80`}`}>
                      {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <StickyNote size={14} className="text-slate-400" />
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">CRM Notes</h2>
                <span className="ml-auto text-xs text-slate-400">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex gap-2 mb-4">
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2}
                  placeholder="Add a note…"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
                <button onClick={() => void addNote()} disabled={addingNote || !newNote.trim()}
                  className="self-end bg-[#0F4DBA] text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1">
                  {addingNote ? <Spinner size={12} /> : <Plus size={13} />} Add
                </button>
              </div>
              {notes.length === 0
                ? <p className="text-sm text-slate-400">No notes yet.</p>
                : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notes.map(n => (
                      <div key={n.id} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-snug">{n.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          <div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Send Message</h2>
              <p className="text-xs text-slate-400 mb-3">Writes to the user&apos;s portal inbox + sends notification email.</p>
              <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={5}
                placeholder="Write your message here…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
              {sendStatus && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${sendStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {sendStatus.message}
                </div>
              )}
              <button onClick={() => void sendMessage()} disabled={sending || !messageBody.trim()}
                className="mt-3 w-full bg-[#0F4DBA] text-white text-sm font-bold py-2 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {sending ? <><Spinner size={14} /> Sending…</> : <><Send size={14} /> Send Message</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ DOCUMENTS ════ */}
      {tab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Documents</h2>
          {uploadedDocs.length === 0 && aiDocs.length === 0
            ? <p className="text-sm text-slate-400">No documents uploaded yet.</p>
            : (
              <div className="space-y-1">
                {uploadedDocs.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Uploaded</p>
                    {uploadedDocs.map(d => (
                      <div key={d.key} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                        <div>
                          <div className="text-sm font-semibold text-slate-700">{d.label ?? d.key}</div>
                          {d.filename && <div className="text-xs text-slate-400">{d.filename}</div>}
                        </div>
                        {d.url
                          ? <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-[#1F315C] hover:bg-slate-50 flex-shrink-0"><Eye size={12} /> View</a>
                          : <span className="text-xs text-slate-400">No file</span>}
                      </div>
                    ))}
                  </>
                )}
                {aiDocs.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-4 mb-2">AI Generated</p>
                    {aiDocs.map(d => (
                      <div key={d.key} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                        <div>
                          <div className="text-sm font-semibold text-slate-700">{d.label ?? d.key}</div>
                          {d.filename && <div className="text-xs text-slate-400">{d.filename}</div>}
                        </div>
                        {d.url
                          ? <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-[#1F315C] hover:bg-slate-50 flex-shrink-0"><Eye size={12} /> View</a>
                          : <span className="text-xs text-slate-400">No file</span>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
        </div>
      )}

      {/* ════ MESSAGES ════ */}
      {tab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sent Messages</h2>
              <span className="text-xs text-slate-400">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
            </div>
            {messages.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">No messages sent yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {messages.map(m => (
                  <div key={m.id} className="group flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${m.read ? 'bg-slate-300' : 'bg-blue-500'}`} title={m.read ? 'Read' : 'Unread'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-snug whitespace-pre-wrap">{m.body}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(m.sentAt)} · {m.read ? 'Read' : 'Unread'}</p>
                    </div>
                    <button onClick={() => void deleteMessage(m.id)} disabled={deletingId === m.id} title="Delete message"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 disabled:opacity-30 mt-0.5">
                      {deletingId === m.id ? <Spinner size={13} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Compose</h2>
              <p className="text-xs text-slate-400 mb-3">Writes to the user&apos;s portal inbox and sends a notification email.</p>
              <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={6}
                placeholder="Write your message here…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
              {sendStatus && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${sendStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {sendStatus.message}
                </div>
              )}
              <button onClick={() => void sendMessage()} disabled={sending || !messageBody.trim()}
                className="mt-3 w-full bg-[#0F4DBA] text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {sending ? <><Spinner size={14} /> Sending…</> : <><Send size={14} /> Send Message</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ PROGRESS ════ */}
      {tab === 'progress' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Progress Override</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Current Step</label>
                <CustomSelect
                  value={String(progressStep)}
                  onChange={v => setProgressStep(Number(v))}
                  options={[
                    { value: '-1', label: 'Auto (time-based)' },
                    ...STEP_LABELS.map((label, i) => ({ value: String(i), label: `${i + 1}. ${label}` })),
                  ]}
                />
                <p className="text-xs text-slate-400 mt-1.5">All steps up to this one will be marked complete.</p>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={financeWarning} onChange={e => setFinanceWarning(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Show Finance Review warning</span>
              </label>
              <button disabled={savingProgress} onClick={() => void saveProgress()}
                className="w-full bg-[#0F4DBA] text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
                {savingProgress ? <><Spinner size={14} /> Saving…</> : progressSaved ? <><Check size={14} /> Saved</> : 'Save Progress Status'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Preview</h2>
            <div className="space-y-2.5">
              {STEP_LABELS.map((label, i) => {
                const isDone = i === 0 || (progressStep >= 0 && i <= progressStep);
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${isDone ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {isDone ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-sm font-semibold ${isDone ? 'text-green-800' : 'text-slate-500'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════ EMAIL ════ */}
      {tab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Compose panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mail size={14} className="text-[#0F4DBA]" />
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compose Email</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Sends from{' '}
                <span className="font-semibold text-slate-600">applications@usbusinessgrants.org</span> directly to{' '}
                <span className="font-semibold text-slate-600">{email}</span>.
              </p>

              {/* Template picker — shown as clickable cards */}
              {emailTemplates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Templates</label>
                  <div className="grid grid-cols-2 gap-2">
                    {emailTemplates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applyEmailTemplate(t)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          selectedTemplate?.id === t.id
                            ? 'border-[#0F4DBA] bg-blue-50 text-[#0F4DBA]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        <Mail size={13} className="flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{t.name}</div>
                          {(t as EmailTemplate).isHtml && (
                            <span className="text-[9px] font-bold bg-purple-100 text-purple-600 px-1 rounded uppercase">HTML</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {emailTemplates.length === 0 && emailTemplatesLoaded && (
                <div className="mb-4 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                  No templates yet.{' '}
                  <a href="/admin/marketing/emails" className="text-blue-600 font-semibold hover:underline">Create email templates →</a>
                </div>
              )}

              {/* From account selector — only shown when multiple accounts exist */}
              {smtpAccounts.length > 1 && (
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From</label>
                  <select
                    value={fromAccountId}
                    onChange={e => setFromAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors bg-white"
                  >
                    {smtpAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.fromName ? `${a.fromName} <${a.user}>` : a.user}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Email subject…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>

              {/* Body with variable autocomplete */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Body</label>
                {(selectedTemplate as EmailTemplate | null)?.isHtml ? (
                  <textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    rows={10}
                    placeholder="<p>Hi {{name}},</p>"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none font-mono"
                  />
                ) : (
                  <VariableTextarea
                    value={emailBody}
                    onChange={setEmailBody}
                    rows={10}
                    placeholder="Write your email here… Type {{ to insert a variable"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                  />
                )}
              </div>

              {emailSendStatus && (
                <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${emailSendStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {emailSendStatus.message}
                </div>
              )}

              <button
                onClick={() => void handleSendEmail()}
                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                className="w-full bg-[#0F4DBA] text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-60 flex items-center justify-center gap-2 transition-colors hover:bg-[#0d43a8]"
              >
                {sendingEmail ? <><Spinner size={14} /> Sending…</> : <><Send size={14} /> Send Email</>}
              </button>
            </div>
          </div>

          {/* Sent email log */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sent Emails</h2>
                <button onClick={() => void loadEmailLog()} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <RefreshCw size={12} />
                </button>
              </div>
              {emailLogLoading ? (
                <div className="flex justify-center py-8"><Spinner size={20} /></div>
              ) : emailLog.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">No emails sent yet.</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                  {emailLog.map(e => (
                    <div key={e.id} className="px-4 py-3">
                      <button
                        className="w-full text-left"
                        onClick={() => setExpandedEmailId(expandedEmailId === e.id ? null : e.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-700 leading-snug truncate flex-1">{e.subject}</div>
                          <ChevronDown size={13} className={`text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${expandedEmailId === e.id ? 'rotate-180' : ''}`} />
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {e.sentAt ? new Date(e.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                        </div>
                      </button>
                      {expandedEmailId === e.id && (
                        <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2 font-sans leading-relaxed">{e.body}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
