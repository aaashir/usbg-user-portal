'use client';

import React, { useMemo } from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const NOW_MS = Date.now();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function timestampToMs(value: unknown) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (isRecord(value)) {
    const toMillis = value.toMillis;
    if (typeof toMillis === 'function') {
      const ms = toMillis.call(value);
      return typeof ms === 'number' ? ms : null;
    }
  }
  return null;
}

type StepState = 'done' | 'warning' | 'pending';
type Step = { label: string; state: StepState; tooltip?: string };

const ProgressTracker = () => {
  const { user } = useAuth();

  const createdAtMs = useMemo(() => {
    const v = String(user?.createdAt ?? '');
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  }, [user]);

  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const [bankUploadedAtMs, setBankUploadedAtMs] = React.useState<number | null | undefined>(undefined);
  const [adminOverride, setAdminOverride] = React.useState<{ progressStep?: number; financeWarning?: boolean } | null | undefined>(undefined);

  React.useEffect(() => {
    if (!email) return;
    (async () => {
      const [bankSnap, overrideSnap] = await Promise.all([
        getDoc(doc(db, 'check_status_app', email, 'documents', 'bank_statement')),
        getDoc(doc(db, 'check_status_app', email, 'admin', 'settings')),
      ]);
      const bankData = bankSnap.data() as unknown;
      const uploadedAt = isRecord(bankData) ? bankData.uploadedAt : null;
      setBankUploadedAtMs(timestampToMs(uploadedAt) ?? null);

      if (overrideSnap.exists()) {
        const od = overrideSnap.data() as Record<string, unknown>;
        setAdminOverride({
          progressStep: typeof od.progressStep === 'number' ? od.progressStep : undefined,
          financeWarning: od.financeWarning === true,
        });
      } else {
        setAdminOverride(null);
      }
    })();
  }, [email]);

  const steps = useMemo<Step[]>(() => {
    // If admin has set an override step, use that
    if (adminOverride && typeof adminOverride.progressStep === 'number' && adminOverride.progressStep >= 0) {
      const overrideStep = adminOverride.progressStep;
      const showFinanceWarning = adminOverride.financeWarning === true;
      return [
        { label: 'Received', state: overrideStep >= 0 ? 'done' : 'pending' },
        { label: 'Administrative Review', state: overrideStep >= 1 ? 'done' : 'pending' },
        {
          label: 'Finance Review',
          state: overrideStep >= 2 ? 'done' : showFinanceWarning ? 'warning' : 'pending',
          tooltip: showFinanceWarning && overrideStep < 2
            ? 'Please upload your bank statement so we can complete the financial review portion of your application.'
            : undefined,
        },
        { label: 'Programmatic Review', state: overrideStep >= 3 ? 'done' : 'pending' },
        { label: 'Grant Matches', state: overrideStep >= 4 ? 'done' : 'pending' },
        { label: 'Sent', state: overrideStep >= 5 ? 'done' : 'pending' },
      ];
    }

    const created = createdAtMs ?? NOW_MS;

    const receivedDone = true; // Always done — if user is logged in, they've been received
    const adminDone = NOW_MS >= created + 4 * 24 * 60 * 60 * 1000;

    const bankUploaded = typeof bankUploadedAtMs === 'number';
    const bankUploadMs = bankUploadedAtMs ?? null;
    const financeDone = adminDone && bankUploaded && bankUploadMs !== null && NOW_MS >= bankUploadMs + 24 * 60 * 60 * 1000;
    const financeWarning = (adminOverride?.financeWarning === true) || (adminDone && !bankUploaded);

    const programmaticDone = NOW_MS >= created + 12 * 24 * 60 * 60 * 1000; // 4+3+5 days
    const grantMatchesDone = NOW_MS >= created + 14 * 24 * 60 * 60 * 1000; // 4+3+5+2 days
    const applicationsSentDone = NOW_MS >= created + 16 * 24 * 60 * 60 * 1000; // 4+3+5+2+2 days

    return [
      { label: 'Received', state: receivedDone ? 'done' : 'pending' },
      { label: 'Administrative Review', state: adminDone ? 'done' : 'pending' },
      {
        label: 'Finance Review',
        state: financeDone ? 'done' : financeWarning ? 'warning' : 'pending',
        tooltip: financeWarning
          ? 'Please upload your bank statement so we can complete the financial review portion of your application.'
          : undefined,
      },
      { label: 'Programmatic Review', state: programmaticDone ? 'done' : 'pending' },
      { label: 'Grant Matches', state: grantMatchesDone ? 'done' : 'pending' },
      { label: 'Sent', state: applicationsSentDone ? 'done' : 'pending' },
    ];
  }, [bankUploadedAtMs, createdAtMs, adminOverride]);

  // Don't render until both fetches resolve to avoid flicker
  if (bankUploadedAtMs === undefined || adminOverride === undefined) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-[#D4DEEF] mt-2">
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-[#1F315C] leading-tight">Progress Tracker</h2>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div
                className="flex items-center gap-2 animate-fade-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="relative group">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center animate-scale-in flex-shrink-0 ${
                      step.state === 'done'
                        ? 'bg-[#67A955]'
                        : step.state === 'warning'
                        ? 'bg-[#E8A22A]'
                        : 'bg-[#CBD5E1]'
                    }`}
                    style={{ animationDelay: `${index * 70 + 100}ms` }}
                  >
                    {step.state === 'done' && <Check size={13} strokeWidth={3} className="text-white" />}
                    {step.state === 'warning' && <AlertTriangle size={12} strokeWidth={2.5} className="text-white" />}
                    {step.state === 'pending' && <Clock size={13} strokeWidth={2.5} className="text-white" />}
                  </div>

                  {step.tooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block w-64">
                      <div className="bg-[#1F315C] text-white text-xs rounded-lg px-3 py-2 leading-snug shadow-lg">
                        {step.tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1F315C]" />
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[#344A77] font-bold text-xs sm:text-sm leading-tight whitespace-nowrap">
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className="hidden sm:block h-5 w-px bg-[#DFE6F4] animate-fade-in"
                  style={{ animationDelay: `${index * 70 + 150}ms` }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
