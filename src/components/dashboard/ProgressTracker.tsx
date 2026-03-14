'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Check, Clock } from 'lucide-react';
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

const ProgressTracker = () => {
  const { user } = useAuth();

  const createdAtMs = useMemo(() => {
    const v = String(user?.createdAt ?? '');
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  }, [user]);

  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const [bankUploadedAtMs, setBankUploadedAtMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!email) return;
    (async () => {
      const ref = doc(db, 'check_status_app', email, 'documents', 'bank_statement');
      const snap = await getDoc(ref);
      const data = snap.data() as unknown;
      const uploadedAt = isRecord(data) ? data.uploadedAt : null;
      setBankUploadedAtMs(timestampToMs(uploadedAt));
    })();
  }, [email]);

  const steps = useMemo(() => {
    const created = createdAtMs ?? NOW_MS;

    const adminDone = NOW_MS >= created + 4 * 24 * 60 * 60 * 1000;

    const bankUploaded = typeof bankUploadedAtMs === 'number';
    const bankUploadMs = bankUploadedAtMs ?? null;
    const financeReady = adminDone && bankUploaded;
    const financeDone = financeReady && bankUploadMs !== null && NOW_MS >= bankUploadMs + 24 * 60 * 60 * 1000;

    const programmaticDone = financeDone && NOW_MS >= created + (4 + 3 + 5) * 24 * 60 * 60 * 1000;
    const grantMatchesDone = programmaticDone && NOW_MS >= created + (4 + 3 + 5 + 2) * 24 * 60 * 60 * 1000;
    const applicationsSentDone = grantMatchesDone && NOW_MS >= created + (4 + 3 + 5 + 2 + 2) * 24 * 60 * 60 * 1000;

    const list: Array<{ label: string; state: 'done' | 'pending' | 'needs_action'; tooltip?: string }> = [
      { label: 'Administrative Review', state: adminDone ? 'done' : 'pending', tooltip: undefined },
      {
        label: 'Finance Review',
        state: financeDone ? 'done' : adminDone && !bankUploaded ? 'needs_action' : 'pending',
        tooltip:
          adminDone && !bankUploaded
            ? 'Please upload your bank statement so we can complete the financial review portion of your application.'
            : undefined,
      },
      { label: 'Programmatic Review', state: programmaticDone ? 'done' : 'pending', tooltip: undefined },
      { label: 'Grant Matches', state: grantMatchesDone ? 'done' : 'pending', tooltip: undefined },
      {
        label: 'Applications Sent (awaiting reply)',
        state: applicationsSentDone ? 'done' : 'pending',
        tooltip: undefined,
      },
    ];

    return list;
  }, [bankUploadedAtMs, createdAtMs]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-[#D4DEEF] mt-2">
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-center shrink-0">
          <h2 className="text-base font-bold text-[#1F315C] xl:pr-6 xl:border-r border-[#DFE6F4] leading-tight">Progress Tracker</h2>
        </div>

        <div className="flex-1 flex flex-wrap xl:flex-nowrap items-center gap-3">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className="flex items-center gap-2">
                <div
                  title={step.tooltip}
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    step.state === 'done' ? 'bg-[#67A955]' : step.state === 'needs_action' ? 'bg-[#E8A22A]' : 'bg-[#E8A22A]'
                  }`}
                >
                  {step.state === 'done' && <Check size={13} strokeWidth={3} className="text-white" />}
                  {step.state === 'pending' && <Clock size={13} strokeWidth={2.5} className="text-white" />}
                  {step.state === 'needs_action' && <AlertTriangle size={13} strokeWidth={2.5} className="text-white" />}
                </div>
                <span className="text-[#344A77] font-bold text-sm leading-tight whitespace-nowrap">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="h-5 w-px bg-[#DFE6F4] mx-1"></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
