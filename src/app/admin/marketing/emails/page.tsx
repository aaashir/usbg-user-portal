'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Mail, Eye, Code2, AlignLeft } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import VariableTextarea, { TEMPLATE_VARIABLES } from '@/components/ui/VariableTextarea';

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isHtml: boolean;
  createdAt: string;
  updatedAt: string;
};

function token() {
  return typeof window !== 'undefined' ? (window.localStorage.getItem('usbg:adminToken') ?? '') : '';
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Build a simple email-wrapper preview HTML (mirrors baseTemplate in _email.ts) */
function buildPreviewHtml(body: string, isHtml: boolean): string {
  const content = isHtml
    ? body
    : `<div style="font-size:14px;color:#475569;line-height:1.7">${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:600px;width:100%">
      <tr><td style="background:#0F4DBA;padding:20px 32px"><span style="color:#fff;font-size:18px;font-weight:bold">US Business Grants</span></td></tr>
      <tr><td style="padding:32px">${content}</td></tr>
      <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5">You received this email because you applied for a grant through US Business Grants.</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

/** Replace {{var}} with example values for preview */
function previewSubstitute(text: string) {
  const examples: Record<string, string> = {
    name: 'John Doe', firstName: 'John', lastName: 'Doe',
    businessName: 'Acme LLC', email: 'john@acme.com',
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => examples[k] ?? `{{${k}}}`);
}

const WELCOME_TEMPLATE: Omit<Template, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Welcome Email',
  subject: 'Welcome to US Business Grants, {{firstName}}!',
  isHtml: false,
  body: `Hi {{name}},

Welcome to US Business Grants! We're thrilled to have you on board.

Your application has been received and our team will be reviewing your information shortly. You can log in to your secure portal at any time to check your application status, upload documents, and receive messages from our team.

Here's what to expect next:
• Our team will review your application within 1–2 business days
• You'll receive status updates directly in your portal
• Our advisors may reach out for additional information

If you have any questions, simply reply to this email or log in to your portal.

We look forward to helping your business grow!

Warm regards,
The US Business Grants Team`,
};

export default function EmailsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [formName,    setFormName]    = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody,    setFormBody]    = useState('');
  const [formIsHtml,  setFormIsHtml]  = useState(false);
  const [modalTab,    setModalTab]    = useState<'edit' | 'preview'>('edit');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');

  const [previewId,   setPreviewId]   = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates', { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error();
      setTemplates(await res.json() as Template[]);
    } catch { setError('Could not load templates.'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate(prefill?: Partial<typeof WELCOME_TEMPLATE>) {
    setEditingId(null);
    setFormName(prefill?.name ?? '');
    setFormSubject(prefill?.subject ?? '');
    setFormBody(prefill?.body ?? '');
    setFormIsHtml(prefill?.isHtml ?? false);
    setModalTab('edit');
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(t: Template) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setFormIsHtml(t.isHtml);
    setModalTab('edit');
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) { setSaveError('Template name is required.'); return; }
    setSaving(true); setSaveError('');
    try {
      const payload = { name: formName, subject: formSubject, body: formBody, isHtml: formIsHtml };
      if (editingId) {
        const res = await fetch(`/api/admin/email-templates/${editingId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t));
      } else {
        const res = await fetch('/api/admin/email-templates', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        await load();
      }
      setModalOpen(false);
    } catch { setSaveError('Failed to save. Please try again.'); }
    finally   { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/email-templates/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } finally { setDeletingId(null); }
  }

  const previewTpl = templates.find(t => t.id === previewId);

  return (
    <div className="animate-in fade-in duration-300 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Email Templates</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Reusable templates sent from{' '}
            <span className="font-semibold text-slate-700">applications@usbusinessgrants.org</span>.
            Supports plain text and HTML. Use{' '}
            {TEMPLATE_VARIABLES.map((v, i) => (
              <span key={v.key}>
                <code className="bg-slate-100 px-1 rounded text-xs">{`{{${v.key}}}`}</code>
                {i < TEMPLATE_VARIABLES.length - 1 ? ', ' : ''}
              </span>
            ))} as variables.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 bg-[#0F4DBA] text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-[#0d43a8] transition-colors flex-shrink-0"
        >
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* Welcome email banner */}
      {!loading && !templates.find(t => t.name.toLowerCase().includes('welcome')) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
          <Mail size={20} className="text-[#0F4DBA] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1F315C]">Add a Welcome Email template</p>
            <p className="text-xs text-slate-500 mt-0.5">Get started quickly with a pre-written welcome message.</p>
          </div>
          <button onClick={() => openCreate(WELCOME_TEMPLATE)} className="text-sm font-bold text-[#0F4DBA] hover:underline flex-shrink-0">
            Add Welcome Email →
          </button>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm font-medium">No templates yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  {t.isHtml ? <Code2 size={16} className="text-[#0F4DBA]" /> : <AlignLeft size={16} className="text-[#0F4DBA]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1F315C]">{t.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${t.isHtml ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.isHtml ? 'HTML' : 'Text'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{t.subject || <span className="italic">No subject</span>}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-slate-400 mr-2">Updated {formatDate(t.updatedAt)}</span>
                  <button onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Preview">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => void handleDelete(t.id)} disabled={deletingId === t.id}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40" title="Delete">
                    {deletingId === t.id ? <Spinner size={14} /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>

              {/* Inline preview */}
              {previewId === t.id && (
                <div className="border-t border-slate-100">
                  <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">Subject:</span>
                    <span className="text-sm text-slate-700">{previewSubstitute(t.subject) || <span className="text-slate-400 italic">—</span>}</span>
                  </div>
                  {t.isHtml ? (
                    <iframe
                      srcDoc={buildPreviewHtml(previewSubstitute(t.body), true)}
                      className="w-full border-0"
                      style={{ height: '480px' }}
                      sandbox="allow-same-origin"
                      title="Email preview"
                    />
                  ) : (
                    <div className="px-5 py-4 bg-slate-50">
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                        {previewSubstitute(t.body)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '100%', maxWidth: formIsHtml ? '1100px' : '720px', maxHeight: '92vh' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-base font-bold text-[#1F315C]">{editingId ? 'Edit Template' : 'New Template'}</h2>
              <div className="flex items-center gap-3">
                {/* Plain/HTML toggle */}
                <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => { setFormIsHtml(false); setModalTab('edit'); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${!formIsHtml ? 'bg-white shadow text-[#1F315C]' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <AlignLeft size={13} /> Plain Text
                  </button>
                  <button
                    onClick={() => setFormIsHtml(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${formIsHtml ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Code2 size={13} /> HTML
                  </button>
                </div>
                {formIsHtml && (
                  <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                    <button onClick={() => setModalTab('edit')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${modalTab === 'edit' ? 'bg-white shadow text-[#1F315C]' : 'text-slate-500 hover:text-slate-700'}`}>
                      Edit
                    </button>
                    <button onClick={() => setModalTab('preview')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${modalTab === 'preview' ? 'bg-white shadow text-[#1F315C]' : 'text-slate-500 hover:text-slate-700'}`}>
                      Preview
                    </button>
                  </div>
                )}
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto">
              {formIsHtml && modalTab === 'preview' ? (
                /* HTML Preview */
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-500">Subject preview:</span>
                    <span className="text-sm text-slate-700">{previewSubstitute(formSubject) || <span className="text-slate-400 italic">No subject</span>}</span>
                  </div>
                  <iframe
                    srcDoc={buildPreviewHtml(previewSubstitute(formBody), true)}
                    className="flex-1 w-full border-0"
                    style={{ minHeight: '500px' }}
                    sandbox="allow-same-origin"
                    title="Email HTML preview"
                  />
                </div>
              ) : (
                /* Edit form */
                <div className={`px-6 py-5 space-y-4 ${formIsHtml ? 'grid grid-cols-2 gap-6 items-start' : ''}`}
                  style={formIsHtml ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start', padding: '20px 24px' } : {}}>

                  {/* Left / single column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Template Name *</label>
                      <input value={formName} onChange={e => setFormName(e.target.value)}
                        placeholder="e.g. Welcome Email"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                      <input value={formSubject} onChange={e => setFormSubject(e.target.value)}
                        placeholder="e.g. Welcome, {{firstName}}!"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        {formIsHtml ? 'HTML Body' : 'Body'}
                      </label>
                      {formIsHtml ? (
                        <textarea
                          value={formBody}
                          onChange={e => setFormBody(e.target.value)}
                          rows={20}
                          placeholder="<p>Hi {{name}},</p><p>...</p>"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none font-mono"
                        />
                      ) : (
                        <VariableTextarea
                          value={formBody}
                          onChange={setFormBody}
                          rows={14}
                          placeholder="Write your email body… Type {{ to insert variables"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                        />
                      )}
                    </div>
                    {saveError && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{saveError}</div>}
                  </div>

                  {/* Right column — live HTML preview (HTML mode only) */}
                  {formIsHtml && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Live Preview</label>
                      <iframe
                        srcDoc={buildPreviewHtml(previewSubstitute(formBody), true)}
                        className="w-full rounded-lg border border-slate-200"
                        style={{ height: '520px' }}
                        sandbox="allow-same-origin"
                        title="Live preview"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={() => void handleSave()} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-[#0F4DBA] text-white hover:bg-[#0d43a8] disabled:opacity-60 transition-colors">
                {saving ? <><Spinner size={14} /> Saving…</> : <><Check size={14} /> {editingId ? 'Save Changes' : 'Create Template'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
