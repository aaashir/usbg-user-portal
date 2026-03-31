'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Users, Plus, Trash2, Shield, ShieldCheck, ChevronDown, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type AdminUser = {
  uid: string; email: string; displayName: string;
  role: 'super_admin' | 'admin' | 'editor'; isActive: boolean; createdAt: string;
};

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-100 text-red-700',    icon: <ShieldCheck size={11} /> },
  admin:       { label: 'Admin',       color: 'bg-blue-100 text-blue-700',  icon: <Shield size={11} /> },
  editor:      { label: 'Editor',      color: 'bg-slate-100 text-slate-600', icon: <Shield size={11} /> },
};

function token() { return typeof window !== 'undefined' ? (window.localStorage.getItem('usbg:adminToken') ?? '') : ''; }

export default function UsersPage() {
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // New user form
  const [showForm,    setShowForm]    = useState(false);
  const [newEmail,    setNewEmail]    = useState('');
  const [newName,     setNewName]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole,     setNewRole]     = useState<'admin' | 'editor'>('admin');
  const [showPass,    setShowPass]    = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState('');

  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [confirmUid,  setConfirmUid]  = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admin-users', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.status === 403) { setIsSuperAdmin(false); setLoading(false); return; }
      setIsSuperAdmin(true);
      if (res.ok) setUsers(await res.json() as AdminUser[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError('');
    try {
      const res = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ email: newEmail, displayName: newName, password: newPassword, role: newRole }),
      });
      const d = await res.json() as { ok?: boolean; message?: string };
      if (d.ok) {
        setShowForm(false); setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('admin');
        void loadUsers();
      } else { setCreateError(d.message ?? 'Failed to create user.'); }
    } catch { setCreateError('Network error.'); }
    finally { setCreating(false); }
  }

  async function handleRoleChange(uid: string, role: string) {
    setUpdatingUid(uid);
    try {
      await fetch(`/api/admin/admin-users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ role }),
      });
      void loadUsers();
    } finally { setUpdatingUid(null); }
  }

  async function handleDelete(uid: string) {
    setConfirmUid(uid);
  }

  async function confirmDeleteUser(uid: string) {
    setConfirmUid(null);
    setDeletingUid(uid);
    try {
      await fetch(`/api/admin/admin-users/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      void loadUsers();
    } finally { setDeletingUid(null); }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm p-8"><Spinner size={16} /> Loading…</div>
  );

  if (!isSuperAdmin) return (
    <div className="max-w-lg">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <ShieldCheck size={28} className="text-red-400 mx-auto mb-3" />
        <h2 className="font-bold text-red-700 mb-1">Super Admin Only</h2>
        <p className="text-sm text-red-600">Only super admins can manage users and access.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F4DBA] to-[#032D67] flex items-center justify-center flex-shrink-0 shadow-sm">
          <Users size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Users & Access</h1>
          <p className="text-sm text-slate-500">Manage admin accounts and their permission levels.</p>
        </div>
        <button onClick={() => void loadUsers()} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-slate-700 flex-1">Admin Users</h2>
          <span className="text-[11px] text-slate-400">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map(user => {
            const meta = ROLE_META[user.role] ?? ROLE_META.editor;
            return (
              <div key={user.uid} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#0F4DBA]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] font-bold text-[#0F4DBA]">
                    {(user.displayName || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-700 truncate">{user.displayName || user.email}</div>
                  <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                </div>
                {/* Role badge + picker */}
                <div className="flex items-center gap-2">
                  {user.role === 'super_admin' ? (
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.color}`}>
                      {meta.icon}{meta.label}
                    </span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={e => void handleRoleChange(user.uid, e.target.value)}
                      disabled={updatingUid === user.uid}
                      className="text-[12px] font-semibold border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white outline-none focus:border-blue-400 transition-colors"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                    </select>
                  )}
                  {/* Delete */}
                  {user.role !== 'super_admin' && (
                    <button
                      onClick={() => void handleDelete(user.uid)}
                      disabled={deletingUid === user.uid}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deletingUid === user.uid ? <Spinner size={13} /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add user */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center gap-2.5 px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <Plus size={15} className="text-blue-600" />
          <span className="text-[13px] font-semibold text-blue-600">Add New User</span>
          <ChevronDown size={14} className={`ml-auto text-slate-400 transition-transform ${showForm ? 'rotate-180' : ''}`} />
        </button>

        {showForm && (
          <form onSubmit={(e) => void handleCreate(e)} className="px-6 pb-6 pt-1 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Display Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="jane@usbusinessgrants.org" required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
                      const pass = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                      setNewPassword(pass);
                      setShowPass(true);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Generate
                  </button>
                </div>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters" required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors pr-9" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'editor')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white transition-colors">
                  <option value="admin">Admin — full CRM access</option>
                  <option value="editor">Editor — limited access</option>
                </select>
              </div>
            </div>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700">{createError}</div>
            )}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4DBA] text-white text-[13px] font-semibold disabled:opacity-60">
                {creating ? <><Spinner size={13} /> Creating…</> : <><Check size={13} /> Create User</>}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      <ConfirmDialog
        open={confirmUid !== null}
        title="Remove Admin User"
        message="Remove this admin user? They will lose all access immediately."
        confirmLabel="Remove"
        onConfirm={() => confirmUid && void confirmDeleteUser(confirmUid)}
        onCancel={() => setConfirmUid(null)}
      />
    </div>
  );
}
