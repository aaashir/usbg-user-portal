'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Eye, Upload, Building2, Hash, Landmark, Receipt, TrendingUp, BookOpen, ShieldCheck, Bot, Trash2 } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

type DocItem = {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
};

type StoredDoc = {
  key: string;
  label?: string;
  filename?: string;
  url?: string;
  uploadedAt?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function timestampToText(ts: unknown): string | null {
  if (!ts) return null;
  let ms: number | null = null;
  if (isRecord(ts) && typeof ts.toMillis === 'function') {
    const v = (ts.toMillis as () => number)();
    ms = Number.isFinite(v) ? v : null;
  } else if (isRecord(ts) && typeof ts.seconds === 'number') {
    ms = ts.seconds * 1000;
  } else if (ts instanceof Date) {
    ms = ts.getTime();
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    const t = new Date(ts).getTime();
    ms = Number.isFinite(t) ? t : null;
  }
  if (ms === null) return null;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const requiredDocs = useMemo<DocItem[]>(
    () => [
      { key: 'certificate_of_formation', label: 'Business Registration (Certificate of Formation)', description: 'Confirms the legal existence of your business and verifies that it is properly registered to operate within the state. This ensures the grantor that funds are being provided to a legitimate entity.', icon: Building2, iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
      { key: 'ein_letter', label: 'EIN Confirmation Letter', description: 'Provides proof of your federal tax identification number, verifying your business\'s legal identity for tax purposes and ensuring compliance with federal requirements.', icon: Hash, iconBg: 'bg-violet-50', iconText: 'text-violet-600' },
      { key: 'bank_statement', label: 'Bank Statement', description: 'Demonstrates current financial standing and provides evidence of existing capital, cash flow, and the ability to manage grant funds responsibly.', icon: Landmark, iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
      { key: 'tax_return', label: 'Tax Return', description: 'Offers a comprehensive overview of your business\'s financial history and tax compliance, helping grantors assess stability and eligibility for funding.', icon: Receipt, iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
      { key: 'profit_and_loss', label: 'Profit & Loss Statement', description: 'Shows recent financial performance, including income and expenses, which supports the need for funding and the business\'s capacity to achieve proposed outcomes.', icon: TrendingUp, iconBg: 'bg-teal-50', iconText: 'text-teal-600' },
      { key: 'business_plan', label: 'Business Plan / Funding Use', description: 'Details your strategic vision, objectives, and how grant funds will be allocated, ensuring the grantor that funds will be used purposefully to support growth or community impact.', icon: BookOpen, iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
      { key: 'ownership_certification', label: 'Ownership Certification', description: 'Confirms the legal owners of the business, ensuring that grant funds are distributed to the correct individuals or entity and that ownership eligibility requirements are met.', icon: ShieldCheck, iconBg: 'bg-rose-50', iconText: 'text-rose-600' },
    ],
    []
  );

  const [docs, setDocs] = useState<Record<string, StoredDoc>>({});
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const refCol = collection(db, 'check_status_app', email, 'documents');
        const snap = await getDocs(refCol);
        const next: Record<string, StoredDoc> = {};
        snap.forEach((d) => {
          const data = d.data() as unknown;
          const record = isRecord(data) ? data : {};
          next[d.id] = {
            key: d.id,
            label: typeof record.label === 'string' ? record.label : undefined,
            filename: typeof record.filename === 'string' ? record.filename : undefined,
            url: typeof record.url === 'string' ? record.url : undefined,
            uploadedAt: record.uploadedAt,
          };
        });
        setDocs(next);
      } finally {
        setDocsLoading(false);
      }
    })();
  }, [email]);

  function handleUpload(key: string, file: File) {
    if (!email) return;
    setUploadingKey(key);
    setUploadProgress(0);
    setError('');

    const label = requiredDocs.find((d) => d.key === key)?.label ?? key;
    const form = new FormData();
    form.append('email', email);
    form.append('key', key);
    form.append('label', label);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documents/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as unknown;
        if (xhr.status < 200 || xhr.status >= 300) {
          const msg =
            isRecord(data) && typeof data.message === 'string' ? data.message : 'Upload failed.';
          setError(msg);
          return;
        }
        const url = isRecord(data) && typeof data.url === 'string' ? data.url : '';
        const filename = isRecord(data) && typeof data.filename === 'string' ? data.filename : file.name;
        setDocs((prev) => ({
          ...prev,
          [key]: { ...(prev[key] ?? { key }), key, label, filename, url, uploadedAt: new Date() },
        }));
      } finally {
        setUploadingKey(null);
        setUploadProgress(0);
      }
    };

    xhr.onerror = () => {
      setError('Upload failed. Please try again.');
      setUploadingKey(null);
      setUploadProgress(0);
    };

    xhr.send(form);
  }

  async function deleteAiDoc(key: string) {
    if (!email) return;
    setDeletingKey(key);
    try {
      await deleteDoc(doc(db, 'check_status_app', email, 'documents', key));
      setDocs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setDeletingKey(null);
    }
  }

  function openFilePicker(key: string) {
    setPendingKey(key);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    const key = pendingKey;
    e.target.value = '';
    setPendingKey(null);
    if (!file || !key) return;
    void handleUpload(key, file);
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-1">Upload Your Documents</h1>
        <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-2xl">
          To apply for grants, you&apos;ll need key business documents like financial statements, licenses, and tax forms. Upload them here once, and they&apos;ll be ready whenever you need them—making your grant applications faster, easier, and more organized.
        </p>
        <p className="text-slate-400 text-sm font-semibold mt-1">Secure. Simple. Ready when you are.</p>
      </header>

      {error ? (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 max-w-[880px]">
          {error}
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />

      {docsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={36} />
        </div>
      ) : (
      <>
      <div className="space-y-2.5 max-w-[880px]">
        {requiredDocs.map((d, i) => {
          const existing = docs[d.key];
          const hasUrl = !!existing?.url;
          const uploading = uploadingKey === d.key;
          const dateText = timestampToText(existing?.uploadedAt);
          return (
            <div key={d.key} className={`bg-white border rounded-xl p-4 shadow-sm transition-colors animate-fade-up ${uploading ? 'border-[#3A8CF6]' : hasUrl ? 'border-[#C3D8A8]' : 'border-[#D4DEEF]'}`} style={{ animationDelay: `${i * 55}ms` }}>
              {uploading && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#3A8CF6]">Uploading…</span>
                    <span className="text-xs font-bold text-[#3A8CF6]">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#E7EEF4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#5BA3D0] to-[#3A8CF6] rounded-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${d.iconBg}`}>
                  <d.icon size={20} className={d.iconText} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#1F315C] leading-tight">{d.label}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{d.description}</div>
                  <div className="text-xs mt-1.5">
                    {hasUrl ? (
                      <span className="text-emerald-600 font-semibold">
                        Uploaded{dateText ? `: ${dateText}` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">Not yet uploaded</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={!hasUrl}
                    onClick={() => {
                      if (existing?.url) window.open(existing.url, '_blank', 'noreferrer');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                      hasUrl
                        ? 'bg-white text-[#1F315C] border-[#D4DEEF] hover:bg-slate-50'
                        : 'bg-slate-50 text-slate-300 border-[#E5E9F1] cursor-not-allowed'
                    }`}
                  >
                    <Eye size={15} />
                    View
                  </button>

                  <button
                    type="button"
                    disabled={uploading || !email}
                    onClick={() => openFilePicker(d.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white shadow-sm disabled:opacity-60 hover:from-[#2F7FE8] hover:to-[#245DC0] transition-all"
                  >
                    <Upload size={15} />
                    {uploading ? `${uploadProgress}%` : hasUrl ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Previously uploaded / HubSpot-synced docs not in the 7 slots above */}
      {(() => {
        const knownKeys = new Set(requiredDocs.map((d) => d.key));
        const extraDocs = Object.values(docs).filter(
          (d) => !knownKeys.has(d.key) && !d.key.startsWith('ai_') && !!d.url
        );
        if (extraDocs.length === 0) return null;
        return (
          <div className="mt-6 max-w-[880px]">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Previously Uploaded</h2>
            <div className="space-y-2.5">
              {extraDocs.map((d, i) => {
                const dateText = timestampToText(d.uploadedAt);
                return (
                  <div
                    key={d.key}
                    className="bg-white border border-[#D4DEEF] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-up"
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50">
                      <Landmark size={20} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#1F315C] leading-tight">{d.label ?? d.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                      <div className="text-xs mt-0.5 text-slate-400 font-medium">
                        {d.filename ?? ''}
                        {dateText ? ` · ${dateText}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => { if (d.url) window.open(d.url, '_blank', 'noreferrer'); }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border bg-white text-[#1F315C] border-[#D4DEEF] hover:bg-slate-50 transition-colors"
                      >
                        <Eye size={15} />
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* AI Generated Documents */}
      {(() => {
        const aiDocs = Object.values(docs).filter((d) => d.key.startsWith('ai_'));
        return (
          <div className="mt-8 max-w-[880px]">
            <h2 className="text-base font-bold text-[#1F315C] mb-3 flex items-center gap-2">
              <Bot size={18} className="text-[#3A8CF6]" />
              AI Generated Documents
            </h2>
            {aiDocs.length === 0 ? (
              <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm text-sm text-slate-400 font-medium">
                No AI documents yet. Use the <span className="text-[#3A8CF6] font-semibold">AI Writing Assistant</span> to generate and save content here.
              </div>
            ) : (
              <div className="space-y-2.5">
                {aiDocs.map((d, i) => {
                  const dateText = timestampToText(d.uploadedAt);
                  return (
                    <div
                      key={d.key}
                      className="bg-white border border-[#D4DEEF] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-up"
                      style={{ animationDelay: `${i * 55}ms` }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                        <Bot size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#1F315C] leading-tight">{d.label ?? d.key}</div>
                        <div className="text-xs mt-0.5 text-slate-400 font-medium">
                          {d.filename ?? ''}
                          {dateText ? ` · ${dateText}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={!d.url}
                          onClick={() => { if (d.url) window.open(d.url, '_blank', 'noreferrer'); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                            d.url
                              ? 'bg-white text-[#1F315C] border-[#D4DEEF] hover:bg-slate-50'
                              : 'bg-slate-50 text-slate-300 border-[#E5E9F1] cursor-not-allowed'
                          }`}
                        >
                          <Eye size={15} />
                          View
                        </button>
                        <button
                          type="button"
                          disabled={deletingKey === d.key}
                          onClick={() => void deleteAiDoc(d.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          {deletingKey === d.key ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
      </>
      )}
    </div>
  );
}
