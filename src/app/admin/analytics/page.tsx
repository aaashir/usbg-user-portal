'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Spinner from '@/components/ui/Spinner';
import { Users2, TrendingUp, Zap, Infinity, MapPin, Calendar } from 'lucide-react';

type Contact = {
  id: string;
  firstname: string;
  lastname: string;
  company: string;
  email: string;
  state: string;
  industry: string;
  pr: string;
  createdate: string;
  zip: string;
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AnalyticsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const token = useRef('');
  useEffect(() => { token.current = window.localStorage.getItem('usbg:adminToken') ?? ''; }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/users?all=1', {
          headers: { Authorization: `Bearer ${token.current}` },
        });
        if (!res.ok) { setError('Failed to load.'); return; }
        const data = await res.json() as { contacts: Contact[] };
        setContacts(data.contacts);
      } catch { setError('Failed to load.'); }
      finally   { setLoading(false); }
    })();
  }, []);

  const stats = useMemo(() => {
    if (!contacts) return null;
    const sf = contacts.filter(c => c.pr === 'SF' || c.pr === 'TRUE').length;
    const ef = contacts.filter(c => c.pr === 'EF').length;
    const uf = contacts.filter(c => c.pr === 'UF').length;

    // State breakdown
    const stateMap: Record<string, number> = {};
    for (const c of contacts) if (c.state) stateMap[c.state] = (stateMap[c.state] ?? 0) + 1;
    const topStates = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Industry breakdown
    const indMap: Record<string, number> = {};
    for (const c of contacts) if (c.industry) indMap[c.industry] = (indMap[c.industry] ?? 0) + 1;
    const topIndustries = Object.entries(indMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Monthly signups (last 12 months)
    const now = new Date();
    const monthly: number[] = Array(12).fill(0);
    for (const c of contacts) {
      if (!c.createdate) continue;
      const d = new Date(c.createdate);
      if (!Number.isFinite(d.getTime())) continue;
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diff >= 0 && diff < 12) monthly[11 - diff]++;
    }
    const monthLabels = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return MONTH_LABELS[d.getMonth()];
    });

    return { total: contacts.length, sf, ef, uf, topStates, topIndustries, monthly, monthLabels };
  }, [contacts]);

  if (loading) return <div className="flex justify-center items-center py-40"><Spinner size={36} /></div>;
  if (error)   return <div className="m-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!stats)  return null;

  const maxMonthly = Math.max(...stats.monthly, 1);
  const maxState   = stats.topStates[0]?.[1] ?? 1;

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts',  value: stats.total, icon: Users2,    color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100' },
          { label: 'Standard',        value: stats.sf,    icon: TrendingUp, color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100' },
          { label: 'Expedited',       value: stats.ef,    icon: Zap,        color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100' },
          { label: 'Unlimited',       value: stats.uf,    icon: Infinity,   color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
              <div className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center`}>
                <Icon size={15} className={color} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">{value.toLocaleString()}</div>
            <div className="text-[12px] text-slate-400 mt-1">
              {label !== 'Total Contacts'
                ? `${stats.total > 0 ? ((value / stats.total) * 100).toFixed(1) : 0}% of total`
                : 'all time'
              }
            </div>
          </div>
        ))}
      </div>

      {/* ── Monthly signups chart + Top states ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Monthly bar chart */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Calendar size={15} className="text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-700">New Contacts — Last 12 Months</h2>
          </div>
          <div className="flex items-end gap-1.5 h-36">
            {stats.monthly.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end justify-center" style={{ height: '112px' }}>
                  <div
                    className="w-full rounded-t-sm bg-blue-500 transition-all"
                    style={{
                      height: `${Math.max(2, (val / maxMonthly) * 112)}px`,
                      opacity: i === 11 ? 1 : 0.55 + (i / 11) * 0.35,
                    }}
                    title={`${val} contacts`}
                  />
                </div>
                <span className="text-[9px] text-slate-400 font-medium">{stats.monthLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top states */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={15} className="text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-700">Top States</h2>
          </div>
          <div className="space-y-2.5">
            {stats.topStates.map(([state, count]) => (
              <div key={state} className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-600 w-7 flex-shrink-0">{state}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(count / maxState) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-400 w-10 text-right flex-shrink-0">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top Industries ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Top Industries</h2>
        <div className="grid grid-cols-4 gap-3">
          {stats.topIndustries.map(([ind, count]) => (
            <div key={ind} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
              <div className="text-[11px] font-semibold text-slate-500 truncate mb-0.5">{ind || 'Unknown'}</div>
              <div className="text-lg font-bold text-slate-800">{count.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">
                {((count / stats.total) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
