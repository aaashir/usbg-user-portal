'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

type GrantRow = {
  id: string;
  name: string;
  summary?: string;
  agency?: string;
  amount?: string;
  deadline?: string;
  url?: string;
  type?: string;
  state?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export default function GrantsPage() {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);
  const state = useMemo(() => String(user?.properties?.state ?? '').trim(), [user]);

  const [isLoading, setIsLoading] = useState(false);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'all' | 'interested'>('all');

  useEffect(() => {
    if (!email) return;
    (async () => {
      const ref = collection(db, 'check_status_app', email, 'bookmarks');
      const snap = await getDocs(ref);
      const next: Record<string, boolean> = {};
      snap.forEach((d) => {
        next[d.id] = true;
      });
      setBookmarked(next);
    })();
  }, [email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const matchesPromise = state
          ? fetch(`/api/grants/matches?state=${encodeURIComponent(state)}`).then((r) => r.json())
          : Promise.resolve(null);
        const matchesData = await matchesPromise;
        if (cancelled) return;

        const rows: GrantRow[] = [];

        if (matchesData && isRecord(matchesData) && Array.isArray(matchesData.grants)) {
          for (const item of matchesData.grants) {
            if (!isRecord(item)) continue;
            const id = typeof item.id === 'string' ? item.id : String(item.id ?? '');
            const name = typeof item.name === 'string' ? item.name : String(item.name ?? '');
            if (!id || !name) continue;
            rows.push({
              id,
              name,
              summary: typeof item.summary === 'string' ? item.summary : undefined,
              agency: typeof item.agency === 'string' ? item.agency : undefined,
              amount: typeof item.amount === 'string' ? item.amount : undefined,
              deadline: typeof item.deadline === 'string' ? item.deadline : undefined,
              url: typeof item.url === 'string' ? item.url : undefined,
              type: typeof item.type === 'string' ? item.type : undefined,
              state: typeof item.state === 'string' ? item.state : undefined,
            });
          }
        }

        const dedup = new Map<string, GrantRow>();
        for (const r of rows) dedup.set(r.id, r);
        setGrants(Array.from(dedup.values()));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  const visible = useMemo(() => {
    if (view === 'interested') return grants.filter((g) => bookmarked[g.id]);
    return grants;
  }, [bookmarked, grants, view]);

  async function toggleBookmark(grant: GrantRow) {
    if (!email) return;
    const ref = doc(db, 'check_status_app', email, 'bookmarks', grant.id);
    const next = !bookmarked[grant.id];

    setBookmarked((prev) => ({ ...prev, [grant.id]: next }));
    if (next) {
      await setDoc(ref, { ...grant, savedAt: serverTimestamp() }, { merge: true });
    } else {
      await deleteDoc(ref);
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">My Grants</h1>
        <p className="text-slate-500 text-sm font-medium">Your saved and matched grants.</p>
      </header>

      <div className="text-sm text-slate-600 mb-4">Please select the grants you are interested in.</div>

      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setView('all')}
          className={`px-3 py-1.5 rounded-md text-sm font-bold border ${
            view === 'all' ? 'bg-[#0F4DBA] text-white border-[#0F4DBA]' : 'bg-white text-[#1F315C] border-[#D4DEEF]'
          }`}
        >
          All Grants
        </button>
        <button
          type="button"
          onClick={() => setView('interested')}
          className={`px-3 py-1.5 rounded-md text-sm font-bold border ${
            view === 'interested'
              ? 'bg-[#0F4DBA] text-white border-[#0F4DBA]'
              : 'bg-white text-[#1F315C] border-[#D4DEEF]'
          }`}
        >
          Interested
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-600">Loading grants…</div>}

      {!isLoading && visible.length === 0 && (
        <div className="text-sm text-slate-600">No grants to show.</div>
      )}

      <div className="space-y-3">
        {visible.map((g) => (
          <div key={g.id} className="bg-white border border-[#D4DEEF] rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <label className="mt-1 flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={!!bookmarked[g.id]}
                  onChange={() => toggleBookmark(g)}
                  className="h-4 w-4 accent-[#0F4DBA]"
                />
                <span className="text-sm font-bold text-[#1F315C]">Interested</span>
              </label>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="font-bold text-[#0F4DBA] text-base leading-tight">{g.name}</div>
                  {g.type === 'state_match' && state ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EAF1FB] text-[#1F315C]">
                      Match{g.state ? ` · ${g.state}` : ''}
                    </span>
                  ) : null}
                  {g.type === 'upcoming_deadline' ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F7EAD0] text-[#1F315C]">
                      Deadline
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 text-sm text-[#3E5A8A] leading-snug">
                  {g.amount ? `${g.amount} · ` : ''}
                  {g.agency ? `${g.agency} · ` : ''}
                  {g.deadline ? `Deadline: ${g.deadline}` : ''}
                </div>

                {g.summary ? <div className="mt-2 text-sm text-slate-700">{g.summary}</div> : null}

                {g.url ? (
                  <div className="mt-3">
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-bold bg-[#0F4DBA] text-white"
                    >
                      Apply Directly
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
