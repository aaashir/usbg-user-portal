'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';

const ReadinessChecklist = () => {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const [uploadedKeys, setUploadedKeys] = useState<Record<string, boolean>>({});

  const items = useMemo(
    () => [
      { key: 'certificate_of_formation', label: 'Business Registration' },
      { key: 'ein_letter', label: 'EIN Confirmation' },
      { key: 'bank_statement', label: 'Bank Statement' },
      { key: 'tax_return', label: 'Tax Return' },
      { key: 'profit_and_loss', label: 'Profit & Loss Statement' },
      { key: 'business_plan', label: 'Business Plan / Funding Use' },
      { key: 'ownership_certification', label: 'Ownership Certification' },
    ],
    []
  );

  useEffect(() => {
    if (!email) return;
    (async () => {
      const ref = collection(db, 'check_status_app', email, 'documents');
      const snap = await getDocs(ref);
      const next: Record<string, boolean> = {};
      snap.forEach((docSnap) => {
        next[docSnap.id] = true;
      });
      setUploadedKeys(next);
    })();
  }, [email]);

  const doneCount = useMemo(() => items.filter((i) => !!uploadedKeys[i.key]).length, [items, uploadedKeys]);
  const pct = useMemo(() => {
    if (!items.length) return 0;
    return Math.round((doneCount / items.length) * 100);
  }, [doneCount, items.length]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#1F315C] leading-tight">Grant Readiness Checklist</h2>

      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center justify-center md:justify-start">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(#7EA9B3 0% ${pct}%, #E7EEF4 ${pct}% 100%)`,
            }}
          >
            <div className="w-[92px] h-[92px] rounded-full bg-white flex items-center justify-center text-center border border-[#E5E9F1]">
              <div className="text-[#1F315C] leading-tight">
                <div className="text-xs font-semibold text-slate-500">Overall</div>
                <div className="text-xs font-semibold text-slate-500">Readiness:</div>
                <div className="text-lg font-extrabold">{pct}%</div>
                <div className="text-xs font-semibold text-slate-500">Complete</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {items.map((item) => {
            const done = !!uploadedKeys[item.key];
            return (
              <div key={item.key} className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    done ? 'bg-[#E9F5E6]' : 'bg-[#F7EAD0]'
                  }`}
                >
                  {done ? (
                    <Check size={14} className="text-[#4F9A44]" strokeWidth={3} />
                  ) : (
                    <AlertTriangle size={14} className="text-[#C47A11]" />
                  )}
                </div>
                <div className="text-sm font-semibold text-[#273A66] leading-tight">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Link href="/documents" className="mt-4 w-full bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-2.5 rounded-md text-sm font-bold shadow-sm text-center">
        Complete
      </Link>
    </div>
  );
};

export default ReadinessChecklist;
