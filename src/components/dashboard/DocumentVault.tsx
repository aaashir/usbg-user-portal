'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Files, FileSpreadsheet, FileImage, FileCode, Presentation, File } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Spinner from '@/components/ui/Spinner';

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

type FileStyle = { icon: React.ElementType; bg: string; text: string; badge: string };

function getFileStyle(filename: string | undefined): FileStyle {
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { icon: FileText, bg: 'bg-red-50', text: 'text-red-600', badge: 'PDF' };
  if (ext === 'doc' || ext === 'docx') return { icon: FileText, bg: 'bg-blue-50', text: 'text-blue-600', badge: ext.toUpperCase() };
  if (ext === 'xls' || ext === 'xlsx') return { icon: FileSpreadsheet, bg: 'bg-emerald-50', text: 'text-emerald-600', badge: ext.toUpperCase() };
  if (ext === 'csv') return { icon: FileSpreadsheet, bg: 'bg-teal-50', text: 'text-teal-600', badge: 'CSV' };
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp') return { icon: FileImage, bg: 'bg-purple-50', text: 'text-purple-600', badge: ext.toUpperCase() };
  if (ext === 'ppt' || ext === 'pptx') return { icon: Presentation, bg: 'bg-orange-50', text: 'text-orange-600', badge: ext.toUpperCase() };
  if (ext === 'txt') return { icon: FileCode, bg: 'bg-slate-50', text: 'text-slate-500', badge: 'TXT' };
  return { icon: File, bg: 'bg-[#EAF1FB]', text: 'text-[#0F4DBA]', badge: ext ? ext.toUpperCase() : 'DOC' };
}

const DocumentVault = () => {
  const router = useRouter();
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    setIsLoading(true);
    (async () => {
      try {
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
      } finally {
        setIsLoading(false);
      }
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

      <p className="mt-3 text-xs text-[#3E5A8A] leading-snug">
        Uploading supporting business documents helps verify your eligibility and can improve the review process. Consider adding items such as business licenses, tax documents, financial statements, or proof of operations.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            router.push('/documents');
          }}
          className="w-full bg-white border border-[#D4DEEF] text-[#1F315C] py-2.5 rounded-md text-sm font-semibold shadow-sm hover:bg-slate-50 cursor-pointer"
        >
          View
        </button>
        <button
          type="button"
          onClick={() => {
            router.push('/documents');
          }}
          className="w-full bg-gradient-to-r from-[#4D648E] to-[#3E5279] text-white py-2.5 rounded-md text-sm font-bold shadow-sm cursor-pointer"
        >
          Upload Files
        </button>
      </div>

      <div className="mt-4 flex-1">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={16} /> Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No documents uploaded yet.</div>
        ) : (
          <div className="space-y-2">
            {docs.slice(0, 4).map((d, i) => {
              const { icon: Icon, bg, text } = getFileStyle(d.filename);
              const title = d.label ?? d.filename ?? d.key;
              return (
                <div
                  key={d.key}
                  className="flex items-center gap-2.5 border border-[#D4DEEF] rounded-lg px-3 py-2 bg-white hover:bg-[#F7FAFF] transition-colors animate-slide-right"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className={text} />
                  </div>
                  <span className="text-xs font-semibold text-[#1F315C] truncate">{title}</span>
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
