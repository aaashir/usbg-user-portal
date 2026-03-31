'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Users, ChevronRight, X, Check, Search } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import Link from 'next/link';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type CrmList = {
  id: string;
  name: string;
  description: string;
  contactEmails: string[];
  count: number;
  createdAt: string;
};

function token() {
  return typeof window !== 'undefined' ? (window.localStorage.getItem('usbg:adminToken') ?? '') : '';
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ListsPage() {
  const [lists,       setLists]       = useState<CrmList[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmListId, setConfirmListId] = useState<string | null>(null);

  // Create modal
  const [modalOpen,   setModalOpen]   = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');

  // Detail panel
  const [selected,    setSelected]    = useState<CrmList | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [removeEmail, setRemoveEmail] = useState<string | null>(null);
  const [searchQ,     setSearchQ]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lists', { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error();
      setLists(await res.json() as CrmList[]);
    } catch { setError('Could not load lists.'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openDetail(list: CrmList) {
    setSelected(list);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/lists/${list.id}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setSelected(await res.json() as CrmList);
    } finally { setDetailLoading(false); }
  }

  async function handleCreate() {
    if (!newName.trim()) { setSaveError('Name is required.'); return; }
    setSaving(true); setSaveError('');
    try {
      const res = await fetch('/api/admin/lists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (!res.ok) throw new Error();
      setModalOpen(false); setNewName(''); setNewDesc('');
      await load();
    } catch { setSaveError('Failed to create list.'); }
    finally   { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setConfirmListId(id);
  }

  async function confirmDeleteList(id: string) {
    setConfirmListId(null);
    setDeletingId(id);
    try {
      await fetch(`/api/admin/lists/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
      setLists(prev => prev.filter(l => l.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally { setDeletingId(null); }
  }

  async function handleRemoveContact(email: string) {
    if (!selected) return;
    setRemoveEmail(email);
    try {
      await fetch(`/api/admin/lists/${selected.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeEmails: [email] }),
      });
      const updated = { ...selected, contactEmails: selected.contactEmails.filter(e => e !== email), count: selected.count - 1 };
      setSelected(updated);
      setLists(prev => prev.map(l => l.id === selected.id ? { ...l, count: l.count - 1 } : l));
    } finally { setRemoveEmail(null); }
  }

  const filteredEmails = selected?.contactEmails.filter(e =>
    !searchQ || e.toLowerCase().includes(searchQ.toLowerCase())
  ) ?? [];

  return (
    <div className="animate-in fade-in duration-300 h-full flex gap-6">

      {/* Left panel — list of lists */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Contact Lists</h1>
            <p className="text-slate-500 text-sm mt-0.5">Segment contacts into custom lists for targeted emails.</p>
          </div>
          <button
            onClick={() => { setNewName(''); setNewDesc(''); setSaveError(''); setModalOpen(true); }}
            className="flex items-center gap-2 bg-[#0E468F] text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-[#0d3d80] transition-colors flex-shrink-0"
          >
            <Plus size={15} /> New List
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : lists.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm font-medium">No lists yet.</p>
            <p className="text-slate-400 text-xs mt-1">Create a list, or bulk-select contacts to add them to a list.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lists.map(list => (
              <div
                key={list.id}
                onClick={() => void openDetail(list)}
                className={`bg-white border rounded-xl shadow-sm cursor-pointer transition-all hover:border-[#0E468F] hover:shadow-md ${selected?.id === list.id ? 'border-[#0E468F] ring-1 ring-[#0E468F]/20' : 'border-slate-200'}`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-[#0E468F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1F315C]">{list.name}</div>
                    {list.description && <div className="text-xs text-slate-400 truncate mt-0.5">{list.description}</div>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{list.count} contacts</span>
                    <span className="text-[11px] text-slate-400">{formatDate(list.createdAt)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); void handleDelete(list.id); }}
                      disabled={deletingId === list.id}
                      className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      {deletingId === list.id ? <Spinner size={13} /> : <Trash2 size={14} />}
                    </button>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel — list detail */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)', position: 'sticky', top: '80px' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <div className="text-sm font-bold text-[#1F315C]">{selected.name}</div>
              <div className="text-xs text-slate-400">{selected.count} contacts</div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-100 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Search emails…" value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {detailLoading ? (
              <div className="flex justify-center py-8"><Spinner size={20} /></div>
            ) : filteredEmails.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-400">
                {searchQ ? 'No matches.' : 'No contacts in this list yet. Bulk-select contacts to add them.'}
              </div>
            ) : (
              filteredEmails.map(email => (
                <div key={email} className="flex items-center gap-2 px-4 py-2.5 group hover:bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#0E468F]">
                    {email[0]?.toUpperCase()}
                  </div>
                  <Link href={`/admin/contacts/${encodeURIComponent(email)}`} className="flex-1 min-w-0 text-xs text-slate-700 hover:text-[#0E468F] truncate transition-colors">
                    {email}
                  </Link>
                  <button
                    onClick={() => void handleRemoveContact(email)}
                    disabled={removeEmail === email}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 transition-all disabled:opacity-40 flex-shrink-0"
                  >
                    {removeEmail === email ? <Spinner size={11} /> : <X size={12} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-[#1F315C]">New List</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">List Name *</label>
                <input
                  autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
                  placeholder="e.g. Hot Leads, Q1 Follow-up…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Description <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <input
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="What is this list for?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              {saveError && <div className="text-sm text-red-600">{saveError}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={() => void handleCreate()} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-[#0E468F] text-white hover:bg-[#0d3d80] disabled:opacity-60 transition-colors">
                {saving ? <><Spinner size={14} /> Creating…</> : <><Check size={14} /> Create List</>}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmListId !== null}
        title="Delete List"
        message="Delete this list? Contacts will not be deleted."
        confirmLabel="Delete"
        onConfirm={() => confirmListId && void confirmDeleteList(confirmListId)}
        onCancel={() => setConfirmListId(null)}
      />
    </div>
  );
}
