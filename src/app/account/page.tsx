'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function AccountPage() {
  const { user } = useAuth();

  const company = useMemo(() => String(user?.properties?.['company'] ?? ''), [user]);
  const email = useMemo(() => String(user?.properties?.['email'] ?? ''), [user]);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">Account</h1>
        <p className="text-slate-500 text-sm font-medium">Your account details.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-[640px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500">Business</div>
            <div className="text-sm font-semibold text-slate-900">{company || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Email</div>
            <div className="text-sm font-semibold text-slate-900">{email || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

