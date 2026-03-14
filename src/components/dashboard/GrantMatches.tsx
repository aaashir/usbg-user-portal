'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

const GrantMatches = () => {
  const { user } = useAuth();
  const state = useMemo(() => String(user?.properties?.state ?? '').trim(), [user]);

  const [grants, setGrants] = useState<Array<{ id: string; name: string; summary?: string; amount?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/grants/matches?state=${encodeURIComponent(state)}`);
        const data = (await res.json()) as unknown;
        if (!res.ok) {
          const msg =
            isRecord(data) && typeof data.message === 'string' ? data.message : 'Unable to load grant matches.';
          setError(msg);
          setGrants([]);
          return;
        }
        const d = isRecord(data) ? data : {};
        const list = Array.isArray(d.grants) ? d.grants : [];
        const parsed = list
          .filter(isRecord)
          .map((g) => {
            const id = typeof g.id === 'string' ? g.id : String(g.id ?? '');
            const name = typeof g.name === 'string' ? g.name : String(g.name ?? '');
            const summary = typeof g.summary === 'string' ? g.summary : undefined;
            const amount = typeof g.amount === 'string' ? g.amount : undefined;
            return { id, name, summary, amount };
          })
          .filter((g) => g.id.trim().length > 0 && g.name.trim().length > 0);

        setGrants(parsed);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [state]);

  const top3 = useMemo(() => grants.slice(0, 3), [grants]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#1F315C] leading-tight">Grant Matches for You</h2>
      <div className="space-y-6 flex-1">
        {!state && (
          <div className="text-sm text-slate-600">
            Missing state on your profile.
          </div>
        )}

        {state && isLoading && (
          <div className="text-sm text-slate-600">
            Loading matches…
          </div>
        )}

        {state && !isLoading && error && <div className="text-sm text-slate-600">{error}</div>}

        {state && !isLoading && !error && top3.length === 0 && (
          <div className="text-sm text-slate-600">No grant matches yet.</div>
        )}

        {state &&
          !isLoading &&
          top3.map((grant, index) => (
            <div key={grant.id} className={`${index !== top3.length - 1 ? 'border-b border-[#DFE6F4] pb-4' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full mt-2 flex-shrink-0 bg-[#5FA85D]"></div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#0F4DBA] text-base leading-tight mb-1">{grant.name}</h3>
                  <p className="text-sm leading-snug text-[#3E5A8A]">
                    {grant.amount ? `${grant.amount} · ` : ''}
                    {grant.summary || ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-2 flex justify-end">
        <Link href="/grants" className="text-[#3A8CF6] text-sm font-bold hover:text-[#1D73E8] inline-flex items-center gap-1">
          View All
          <span>›</span>
        </Link>
      </div>
    </div>
  );
};

export default GrantMatches;
