'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';

const ReadinessChecklist = () => {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const [uploadedKeys, setUploadedKeys] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Each item can match multiple Firestore document keys — handles both user uploads
  // and HubSpot-synced documents (which use different key names).
  const items = useMemo(
    () => [
      { key: 'certificate_of_formation', label: 'Business Registration',     matchKeys: ['certificate_of_formation'] },
      { key: 'ein_letter',               label: 'EIN Confirmation',          matchKeys: ['ein_letter'] },
      { key: 'bank_statement',           label: 'Bank Statement',            matchKeys: ['bank_statement', 'bank_statement_1', 'bank_statement_2', 'bank_statement_3'] },
      { key: 'tax_return',               label: 'Tax Return',                matchKeys: ['tax_return'] },
      { key: 'profit_and_loss',          label: 'Profit & Loss Statement',   matchKeys: ['profit_and_loss', 'profitlossstatement', 'business_plan'] },
      { key: 'business_plan',            label: 'Business Plan / Funding Use', matchKeys: ['business_plan', 'ai_business_plan'] },
      { key: 'ownership_certification',  label: 'Ownership Certification',   matchKeys: ['ownership_certification'] },
    ],
    []
  );

  useEffect(() => {
    if (!email) return;
    setIsLoading(true);
    (async () => {
      try {
        const ref = collection(db, 'check_status_app', email, 'documents');
        const snap = await getDocs(ref);
        const next: Record<string, boolean> = {};
        snap.forEach((docSnap) => { next[docSnap.id] = true; });
        setUploadedKeys(next);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [email]);

  const doneCount = useMemo(() => items.filter((i) => i.matchKeys.some(k => !!uploadedKeys[k])).length, [items, uploadedKeys]);
  const pct = useMemo(() => {
    if (!items.length) return 0;
    return Math.round((doneCount / items.length) * 100);
  }, [doneCount, items.length]);

  // Animated percentage counter
  const [animatedPct, setAnimatedPct] = useState(0);
  useEffect(() => {
    if (pct === 0) { setAnimatedPct(0); return; }
    let rafId: number;
    let startTime: number | null = null;
    const duration = 1000;
    function step(ts: number) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPct(Math.round(pct * eased));
      if (progress < 1) rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [pct]);

  // SVG ring
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - animatedPct / 100);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#1F315C] leading-tight">Grant Readiness Checklist</h2>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-4">
          <Spinner size={24} />
        </div>
      ) : (
      <div className="flex-1 flex flex-row items-center gap-4 md:gap-6">
        {/* Donut — compact on mobile, larger on desktop */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <div className="relative w-24 h-24 md:w-44 md:h-44 animate-scale-in delay-75">
            <svg width="100%" height="100%" viewBox="0 0 176 176" className="block">
              <circle cx="88" cy="88" r={radius} fill="none" stroke="#E7EEF4" strokeWidth="14" />
              <circle
                cx="88" cy="88" r={radius}
                fill="none"
                stroke="url(#donutGrad)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.05s linear' }}
              />
              <defs>
                <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#5BA3D0" />
                  <stop offset="100%" stopColor="#3A8CF6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div className="text-[#1F315C] leading-tight">
                <div className="hidden md:block text-xs font-semibold text-slate-400">Overall</div>
                <div className="hidden md:block text-xs font-semibold text-slate-400">Readiness</div>
                <div className="text-lg md:text-3xl font-extrabold text-[#1F315C]">{animatedPct}%</div>
                <div className="text-[10px] md:text-xs font-semibold text-slate-400">Done</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2 md:space-y-3">
          {items.map((item, i) => {
            const done = item.matchKeys.some(k => !!uploadedKeys[k]);
            return (
              <div key={item.key} className="flex items-center gap-2 md:gap-3 animate-slide-right" style={{ animationDelay: `${i * 55}ms` }}>
                <div
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center flex-shrink-0 animate-scale-in ${
                    done ? 'bg-[#E9F5E6]' : 'bg-[#F7EAD0]'
                  }`}
                  style={{ animationDelay: `${i * 55 + 200}ms` }}
                >
                  {done ? (
                    <Check size={12} className="text-[#4F9A44]" strokeWidth={3} />
                  ) : (
                    <AlertTriangle size={12} className="text-[#C47A11]" />
                  )}
                </div>
                <div className="text-xs md:text-sm font-semibold text-[#273A66] leading-tight truncate">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <Link href="/documents" className="mt-4 w-full bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-2.5 rounded-md text-sm font-bold shadow-sm text-center">
        Complete
      </Link>
    </div>
  );
};

export default ReadinessChecklist;
