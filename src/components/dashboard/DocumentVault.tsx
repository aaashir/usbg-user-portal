'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Files, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

type StoredDoc = {
  key: string;
  label?: string;
  filename?: string;
  uploadedAt?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function timestampToMs(ts: unknown) {
  if (!ts) return null;
  if (isRecord(ts) && typeof ts.toMillis === 'function') {
    const ms = ts.toMillis();
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
  }
  if (isRecord(ts) && typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null;
  }
  if (ts instanceof Date && Number.isFinite(ts.getTime())) return ts.getTime();
  if (isRecord(ts) && typeof ts.seconds === 'number') {
    const ms = ts.seconds * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function timestampToText(ts: unknown) {
  const ms = timestampToMs(ts);
  if (ms === null) return null;
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString();
}

function pickIcon(filename: string | undefined) {
  const name = (filename ?? '').toLowerCase();
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return FileSpreadsheet;
  return FileText;
}

const DocumentVault = () => {
  const router = useRouter();
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const [docs, setDocs] = useState<StoredDoc[]>([]);

  useEffect(() => {
    if (!email) return;
    (async () => {
      const refCol = collection(db, 'check_status_app', email, 'documents');
      const snap = await getDocs(refCol);
      const next: StoredDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as unknown;
        const record = isRecord(data) ? data : {};
        next.push({
          key: d.id,
          label: typeof record.label === 'string' ? record.label : undefined,
          filename: typeof record.filename === 'string' ? record.filename : undefined,
          uploadedAt: record.uploadedAt,
        });
      });
      next.sort((a, b) => {
        const aMs = timestampToMs(a.uploadedAt) ?? 0;
        const bMs = timestampToMs(b.uploadedAt) ?? 0;
        return bMs - aMs;
      });
      setDocs(next);
    })();
  }, [email]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <div className="flex items-center gap-3 pb-3 border-b border-[#DFE6F4]">
        <div className="w-9 h-9 bg-[#6FA9F8] rounded-sm flex items-center justify-center text-white">
          <Files size={18} />
        </div>
        <h2 className="text-xl font-bold text-[#1F315C] leading-tight">Document Vault</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            router.push('/documents');
          }}
          className="w-full bg-white border border-[#D4DEEF] text-[#1F315C] py-2.5 rounded-md text-sm font-semibold shadow-sm hover:bg-slate-50"
        >
          View
        </button>
        <button
          type="button"
          onClick={() => {
            router.push('/documents');
          }}
          className="w-full bg-gradient-to-r from-[#4D648E] to-[#3E5279] text-white py-2.5 rounded-md text-sm font-bold shadow-sm"
        >
          Upload Files
        </button>
      </div>

      <div className="mt-4">
        {docs.length === 0 ? (
          <div className="text-sm text-slate-600">No documents uploaded yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {docs.slice(0, 4).map((d) => {
              const Icon = pickIcon(d.filename);
              const title = d.label ?? d.filename ?? d.key;
              const dateText = timestampToText(d.uploadedAt);
              const typeText = (d.filename ?? '').toLowerCase().endsWith('.pdf') ? 'PDF' : (d.filename ?? '').split('.').pop()?.toUpperCase();
              return (
                <div
                  key={d.key}
                  className="border border-[#D4DEEF] rounded-lg p-3 bg-white shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#EAF1FB] flex items-center justify-center text-[#0F4DBA]">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1F315C] truncate">{title}</div>
                      <div className="text-xs text-slate-500 font-medium">
                        {typeText ? `${typeText}` : 'Document'}
                        {dateText ? ` · ${dateText}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentVault;
