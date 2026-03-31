'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { matchesCacheKeys } from '@/lib/grants-cache';
import Spinner from '@/components/ui/Spinner';

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

  const [isLoading, setIsLoading] = useState(true);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'all' | 'saved'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  const anyLoading = isLoading || bookmarksLoading;

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const ref = collection(db, 'check_status_app', email, 'bookmarks');
        const snap = await getDocs(ref);
        const next: Record<string, boolean> = {};
        snap.forEach((d) => {
          next[d.id] = true;
        });
        setBookmarked(next);
      } finally {
        setBookmarksLoading(false);
      }
    })();
  }, [email]);

  useEffect(() => {
    if (!state) return;

    const { firestoreDocId, localStorageKey: cacheKey, normalizedState } = matchesCacheKeys(state);

    function parseGrantRows(items: unknown[]): GrantRow[] {
      const rows: GrantRow[] = [];
      for (const item of items) {
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
      return rows;
    }

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as unknown[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const rows = parseGrantRows(parsed);
          const dedup = new Map<string, GrantRow>();
          for (const r of rows) dedup.set(r.id, r);
          setGrants(Array.from(dedup.values()));
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // ignore localStorage errors
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        // Try Firestore cache directly before calling the API
        try {
          const snap = await getDoc(doc(db, 'grants_cache', firestoreDocId));
          const fsData = snap.data() as { grants?: unknown[] } | undefined;
          if (fsData?.grants && fsData.grants.length > 0) {
            if (cancelled) return;
            const rows = parseGrantRows(fsData.grants);
            const dedup = new Map<string, GrantRow>();
            for (const r of rows) dedup.set(r.id, r);
            const result = Array.from(dedup.values());
            setGrants(result);
            try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* ignore */ }
            setIsLoading(false);
            return;
          }
        } catch { /* ignore firestore errors, fall through to API */ }

        const matchesData = await fetch(`/api/grants/matches?state=${encodeURIComponent(normalizedState)}`).then((r) => r.json());
        if (cancelled) return;

        const items = isRecord(matchesData) && Array.isArray(matchesData.grants) ? matchesData.grants : [];
        const rows = parseGrantRows(items);
        const dedup = new Map<string, GrantRow>();
        for (const r of rows) dedup.set(r.id, r);
        const result = Array.from(dedup.values());
        setGrants(result);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // ignore
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  const visible = useMemo(() => {
    if (view === 'saved') return grants.filter((g) => bookmarked[g.id]);
    return grants;
  }, [bookmarked, grants, view]);

  async function toggleBookmark(grant: GrantRow) {
    if (!email || savingId === grant.id) return;
    const ref = doc(db, 'check_status_app', email, 'bookmarks', grant.id);
    const next = !bookmarked[grant.id];
    setSavingId(grant.id);
    setBookmarked((prev) => ({ ...prev, [grant.id]: next }));
    try {
      if (next) {
        await setDoc(ref, { ...grant, savedAt: serverTimestamp() }, { merge: true });
      } else {
        await deleteDoc(ref);
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">My Grants</h1>
        <p className="text-slate-500 text-sm font-medium">Your saved and matched grants.</p>
      </header>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setView('all')}
          className={`px-4 py-2.5 rounded-md text-sm font-bold border ${
            view === 'all' ? 'bg-[#0F4DBA] text-white border-[#0F4DBA]' : 'bg-white text-[#1F315C] border-[#D4DEEF]'
          }`}
        >
          All Grants
        </button>
        <button
          type="button"
          onClick={() => setView('saved')}
          className={`px-4 py-2.5 rounded-md text-sm font-bold border ${
            view === 'saved'
              ? 'bg-[#0F4DBA] text-white border-[#0F4DBA]'
              : 'bg-white text-[#1F315C] border-[#D4DEEF]'
          }`}
        >
          Saved to Auto-Apply
        </button>
      </div>

      {anyLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size={36} />
          <span className="text-sm text-slate-400 font-medium">Loading grants…</span>
        </div>
      )}

      {!anyLoading && visible.length === 0 && (
        <div className="text-sm text-slate-600">Looks like you haven&apos;t selected any grants yet. Start exploring and add some to your list!</div>
      )}

      <div className="space-y-3">
        {!anyLoading && visible.map((g, i) => (
          <div key={g.id} className="bg-white border border-[#D4DEEF] rounded-xl p-4 shadow-sm animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
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

            <div className="text-sm text-[#3E5A8A] leading-snug">
              {g.amount ? `${g.amount} · ` : ''}
              {g.agency ? `${g.agency} · ` : ''}
              {g.deadline ? `Deadline: ${g.deadline}` : ''}
            </div>

            {g.summary ? <div className="mt-2 text-sm text-slate-700">{g.summary}</div> : null}

            <div className="mt-3 flex flex-col min-[480px]:flex-row items-stretch min-[480px]:items-center gap-2">
              <button
                type="button"
                onClick={() => toggleBookmark(g)}
                disabled={savingId === g.id}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold border transition-colors ${
                  bookmarked[g.id]
                    ? 'bg-[#67A955] text-white border-[#67A955]'
                    : 'bg-white text-[#1F315C] border-[#D4DEEF] hover:border-[#0F4DBA]'
                }`}
              >
                {savingId === g.id ? (
                  <><Spinner size={14} /> Saving…</>
                ) : bookmarked[g.id] ? '✓ SAVED TO AUTO-APPLY' : 'SAVE TO AUTO-APPLY'}
              </button>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(g.name + ' grant application')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-md text-sm font-bold bg-[#0F4DBA] text-white"
              >
                APPLY DIRECTLY
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
