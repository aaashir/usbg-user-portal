'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { matchesCacheKeys } from '@/lib/grants-cache';
import Spinner from '@/components/ui/Spinner';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

const GrantMatches = () => {
  const { user } = useAuth();
  const state = useMemo(() => String(user?.properties?.state ?? '').trim(), [user]);

  type FullGrant = { id: string; name: string; summary?: string; amount?: string; agency?: string; deadline?: string; url?: string; type?: string; state?: string };

  const [grants, setGrants] = useState<FullGrant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;

    const { firestoreDocId, localStorageKey: cacheKey, normalizedState } = matchesCacheKeys(state);

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as FullGrant[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGrants(parsed);
          return;
        }
      }
    } catch {
      // ignore localStorage errors
    }

    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        // Try Firestore cache directly before calling the API
        try {
          const snap = await getDoc(doc(db, 'grants_cache', firestoreDocId));
          const fsData = snap.data() as { grants?: unknown[] } | undefined;
          if (fsData?.grants && fsData.grants.length > 0) {
            const parsed = (fsData.grants as Record<string, unknown>[])
              .filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string')
              .map((g): FullGrant => ({
                id: g.id as string,
                name: g.name as string,
                summary: typeof g.summary === 'string' ? g.summary : undefined,
                amount: typeof g.amount === 'string' ? g.amount : undefined,
                agency: typeof g.agency === 'string' ? g.agency : undefined,
                deadline: typeof g.deadline === 'string' ? g.deadline : undefined,
                url: typeof g.url === 'string' ? g.url : undefined,
                type: typeof g.type === 'string' ? g.type : undefined,
                state: typeof g.state === 'string' ? g.state : undefined,
              }));
            if (parsed.length > 0) {
              setGrants(parsed);
              try { localStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch { /* ignore */ }
              return;
            }
          }
        } catch { /* ignore firestore errors, fall through to API */ }

        const res = await fetch(`/api/grants/matches?state=${encodeURIComponent(normalizedState)}`);
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
          .map((g): FullGrant => ({
            id: typeof g.id === 'string' ? g.id : String(g.id ?? ''),
            name: typeof g.name === 'string' ? g.name : String(g.name ?? ''),
            summary: typeof g.summary === 'string' ? g.summary : undefined,
            amount: typeof g.amount === 'string' ? g.amount : undefined,
            agency: typeof g.agency === 'string' ? g.agency : undefined,
            deadline: typeof g.deadline === 'string' ? g.deadline : undefined,
            url: typeof g.url === 'string' ? g.url : undefined,
            type: typeof g.type === 'string' ? g.type : undefined,
            state: typeof g.state === 'string' ? g.state : undefined,
          }))
          .filter((g) => g.id.trim().length > 0 && g.name.trim().length > 0);

        setGrants(parsed);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        } catch {
          // ignore localStorage write errors
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [state]);

  const top3 = useMemo(() => grants.slice(0, 3), [grants]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#1F315C] leading-tight">
        Business Grant Programs{state ? ` in ${state}` : ''}
      </h2>
      <div className="space-y-6 flex-1">
        {!state && (
          <div className="text-sm text-slate-600">
            Missing state on your profile.
          </div>
        )}

        {state && isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2"><Spinner size={18} /> Loading…</div>
        )}

        {state && !isLoading && error && <div className="text-sm text-slate-600">{error}</div>}

        {state && !isLoading && !error && top3.length === 0 && (
          <div className="text-sm text-slate-600">No grant matches yet.</div>
        )}

        {state &&
          !isLoading &&
          top3.map((grant, index) => (
            <div key={grant.id} className={`animate-fade-up ${index !== top3.length - 1 ? 'border-b border-[#DFE6F4] pb-4' : ''}`} style={{ animationDelay: `${index * 80}ms` }}>
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
