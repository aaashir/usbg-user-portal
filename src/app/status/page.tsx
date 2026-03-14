'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { getLogActivity, logUserActivity } from '@/lib/firebase';

const NOW_MS = Date.now();

function getApplicationStatus(createdAt: string, pr: string, now: number) {
  const input = new Date(createdAt).getTime();
  if (!Number.isFinite(input)) return 'Status unavailable';

  const diffInDays = Math.floor((now - input) / (1000 * 60 * 60 * 24));

  const isExpedited = pr === 'TRUE' || pr === 'EF';

  if (isExpedited) {
    if (diffInDays >= 0 && diffInDays <= 14) return 'In Administrative Review';
    if (diffInDays >= 15 && diffInDays <= 27) return 'In Finance Review';
    if (diffInDays >= 28 && diffInDays <= 35) return 'In Programmatic Review';
    if (diffInDays >= 36 && diffInDays <= 41) return 'With Grant Review Board';
    return 'REVIEW COMPLETE';
  }

  if (diffInDays >= 0 && diffInDays <= 17) return 'In Administrative Review';
  if (diffInDays >= 18 && diffInDays <= 35) return 'In Finance Review';
  if (diffInDays >= 36 && diffInDays <= 53) return 'In Programmatic Review';
  if (diffInDays >= 54 && diffInDays <= 71) return 'With Grant Review Board';
  return 'REVIEW COMPLETE';
}

export default function StatusPage() {
  const router = useRouter();
  const { user } = useAuth();

  const email = useMemo(() => String(user?.properties?.['email'] ?? ''), [user]);
  const company = useMemo(() => String(user?.properties?.['company'] ?? ''), [user]);
  const createdAt = useMemo(() => String(user?.createdAt ?? ''), [user]);
  const pr = useMemo(() => String(user?.properties?.['pr'] ?? ''), [user]);

  const [lastViewed, setLastViewed] = useState<string | null>(null);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);

  const dateSubmitted = useMemo(() => {
    const t = new Date(createdAt).getTime();
    if (!Number.isFinite(t)) return '—';
    return `${new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
  }, [createdAt]);

  const status = useMemo(() => getApplicationStatus(createdAt, pr, NOW_MS), [createdAt, pr]);

  useEffect(() => {
    if (!email) return;
    (async () => {
      const log = await getLogActivity(email);
      setLastViewed(log.lastViewed);
      setLastDownloaded(log.lastDownloaded);
      await logUserActivity(email, 'checked_status');
    })();
  }, [email]);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">Application Status</h1>
        <p className="text-slate-500 text-sm font-medium">Review your latest application details.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-[720px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500">Business Name</div>
            <div className="text-sm font-semibold text-slate-900">{company || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Email</div>
            <div className="text-sm font-semibold text-slate-900 break-all">{email || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Date Submitted</div>
            <div className="text-sm font-semibold text-slate-900">{dateSubmitted}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Status</div>
            <div className="text-sm font-semibold text-slate-900">{status}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Last Viewed</div>
            <div className="text-sm font-semibold text-slate-900">{lastViewed || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Last Downloaded</div>
            <div className="text-sm font-semibold text-slate-900">{lastDownloaded || '—'}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/status/view')}
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-semibold"
          >
            View File
          </button>
        </div>
      </div>
    </div>
  );
}
