'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, ExternalLink, Trash2, ToggleLeft, ToggleRight, Users, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type FormRecord = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft';
  submissionCount: number;
  createdAt: { _seconds: number } | null;
  fields: unknown[];
};

function adminHeaders() {
  const pw = typeof window !== 'undefined' ? (localStorage.getItem('usbg:adminToken') ?? '') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${pw}` };
}

function timeAgo(seconds: number) {
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forms', { headers: adminHeaders() });
      const data = await res.json();
      setForms(data.forms ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createForm() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), status: 'draft', fields: [] }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/admin/forms/${data.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(form: FormRecord) {
    const next = form.status === 'active' ? 'draft' : 'active';
    setForms(f => f.map(x => x.id === form.id ? { ...x, status: next } : x));
    await fetch(`/api/admin/forms/${form.id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ status: next }),
    });
  }

  async function deleteForm(id: string) {
    if (!confirm('Delete this form and all its submissions?')) return;
    setForms(f => f.filter(x => x.id !== id));
    await fetch(`/api/admin/forms/${id}`, { method: 'DELETE', headers: adminHeaders() });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forms</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create forms, embed on any site, track submissions</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0E468F] text-white rounded-lg text-sm font-semibold hover:bg-[#0A3D83] transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Form
        </button>
      </div>

      {/* New Form Modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-1">Create New Form</h2>
              <p className="text-sm text-slate-500 mb-5">You can add fields after creating</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Form Name *</label>
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createForm(); if (e.key === 'Escape') setShowNew(false); }}
                    placeholder="e.g. Contact Us, Grant Application..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E468F] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description (optional)</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="What is this form for?"
                    rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E468F] focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowNew(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createForm}
                  disabled={!newName.trim() || creating}
                  className="flex-1 px-4 py-2.5 bg-[#0E468F] text-white rounded-lg text-sm font-semibold hover:bg-[#0A3D83] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating…' : 'Create & Edit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-full mb-2" />
              <div className="h-3 bg-slate-100 rounded w-3/4 mb-5" />
              <div className="flex gap-3">
                <div className="h-3 bg-slate-200 rounded w-16" />
                <div className="h-3 bg-slate-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-slate-400" />
          </div>
          <h3 className="text-slate-700 font-semibold text-lg mb-1">No forms yet</h3>
          <p className="text-slate-400 text-sm mb-5">Create your first form to start collecting submissions</p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E468F] text-white rounded-lg text-sm font-semibold hover:bg-[#0A3D83] transition-colors"
          >
            <Plus size={16} />
            Create Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map(form => (
            <motion.div
              key={form.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-white rounded-xl border border-slate-100 hover:border-[#93B5E1] hover:shadow-md transition-all p-5 cursor-pointer relative"
              onClick={() => router.push(`/admin/forms/${form.id}`)}
            >
              {/* Status badge */}
              <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                form.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {form.status === 'active' ? 'Active' : 'Draft'}
              </div>

              <div className="w-10 h-10 bg-[#EEF4FF] rounded-xl flex items-center justify-center mb-3">
                <FileText size={18} className="text-[#0E468F]" />
              </div>

              <h3 className="font-semibold text-slate-900 text-[15px] mb-1 pr-14 line-clamp-1">{form.name}</h3>
              {form.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{form.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-3">
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {form.submissionCount ?? 0} submissions
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={11} />
                  {form.fields?.length ?? 0} fields
                </span>
              </div>

              {form.createdAt?._seconds && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                  <Calendar size={10} />
                  {timeAgo(form.createdAt._seconds)}
                </div>
              )}

              {/* Actions row */}
              <div
                className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-50"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => router.push(`/admin/forms/${form.id}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <ExternalLink size={12} />
                  Edit
                </button>
                <button
                  onClick={() => toggleStatus(form)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                    form.status === 'active'
                      ? 'text-amber-600 hover:bg-amber-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {form.status === 'active' ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  {form.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteForm(form.id)}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
