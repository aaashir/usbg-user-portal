'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlignJustify } from 'lucide-react';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

const ApplicationsInProgress = () => {
  const [grants, setGrants] = useState<Array<{ id: string; name: string; deadline?: string; summary?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/grants/deadlines');
        const data = (await res.json()) as unknown;
        if (!res.ok) {
          const msg =
            isRecord(data) && typeof data.message === 'string' ? data.message : 'Unable to load deadlines.';
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
            const deadline = typeof g.deadline === 'string' ? g.deadline : undefined;
            const summary = typeof g.summary === 'string' ? g.summary : undefined;
            return { id, name, deadline, summary };
          })
          .filter((g) => g.id.trim().length > 0 && g.name.trim().length > 0);
        setGrants(parsed);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const top3 = useMemo(() => grants.slice(0, 3), [grants]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#1F315C] leading-tight">Grants With Upcoming Deadlines</h2>
      <div className="space-y-5">
        {isLoading && <div className="text-sm text-slate-600">Loading deadlines…</div>}

        {!isLoading && error && <div className="text-sm text-slate-600">{error}</div>}

        {!isLoading && !error && top3.length === 0 && <div className="text-sm text-slate-600">No upcoming deadlines yet.</div>}

        {!isLoading &&
          top3.map((g, index) => (
            <div key={g.id} className={`${index !== top3.length - 1 ? 'border-b border-[#DFE6F4] pb-4' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-white flex-shrink-0 bg-blue-600">
                  <AlignJustify size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <div className="leading-tight text-[#1F315C]">
                    <span className="font-bold text-[#0F4DBA] text-base">{g.name}</span>
                    {g.deadline ? <span className="text-[#3E5A8A] text-sm"> - {g.deadline}</span> : null}
                  </div>
                  {g.summary ? <div className="mt-2 text-sm text-[#3E5A8A]">{g.summary}</div> : null}
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Link href="/grants" className="text-[#3A8CF6] text-sm font-bold hover:text-[#1D73E8] inline-flex items-center gap-1">
          View All
          <span>›</span>
        </Link>
      </div>
    </div>
  );
};

export default ApplicationsInProgress;
