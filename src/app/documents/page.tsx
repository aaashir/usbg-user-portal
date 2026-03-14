'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Eye, Upload } from 'lucide-react';

type DocItem = {
  key: string;
  label: string;
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

export default function DocumentsPage() {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const requiredDocs = useMemo<DocItem[]>(
    () => [
      { key: 'certificate_of_formation', label: 'Business Registration (Certificate of Formation)' },
      { key: 'ein_letter', label: 'EIN Confirmation Letter' },
      { key: 'bank_statement', label: 'Bank Statement' },
      { key: 'tax_return', label: 'Tax Return' },
      { key: 'profit_and_loss', label: 'Profit & Loss Statement' },
      { key: 'business_plan', label: 'Business Plan / Funding Use' },
      { key: 'ownership_certification', label: 'Ownership Certification' },
    ],
    []
  );

  const [docs, setDocs] = useState<Record<string, StoredDoc>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    (async () => {
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
    })();
  }, [email]);

  async function handleUpload(key: string, file: File) {
    if (!email) return;
    setUploadingKey(key);
    setError('');
    try {
      const label = requiredDocs.find((d) => d.key === key)?.label ?? key;
      const form = new FormData();
      form.append('email', email);
      form.append('key', key);
      form.append('label', label);
      form.append('file', file);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && typeof (data as Record<string, unknown>).message === 'string'
            ? String((data as Record<string, unknown>).message)
            : 'Upload failed.';
        throw new Error(msg);
      }
      const url =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).url === 'string'
          ? String((data as Record<string, unknown>).url)
          : '';
      const filename =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).filename === 'string'
          ? String((data as Record<string, unknown>).filename)
          : file.name;

      setDocs((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? { key }), key, label, filename, url, uploadedAt: new Date() },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      setError(msg);
    } finally {
      setUploadingKey(null);
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
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">Documents</h1>
        <p className="text-slate-500 text-sm font-medium">View or upload documents for your application.</p>
      </header>

      {error ? (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 max-w-[880px]">
          {error}
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />

      <div className="space-y-3 max-w-[880px]">
        {requiredDocs.map((d) => {
          const existing = docs[d.key];
          const hasUrl = !!existing?.url;
          const uploading = uploadingKey === d.key;
          return (
            <div key={d.key} className="bg-white border border-[#D4DEEF] rounded-xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="font-bold text-[#1F315C]">{d.label}</div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    {hasUrl ? `Uploaded: ${existing?.filename ?? 'File'}` : 'Missing'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasUrl}
                    onClick={() => {
                      if (existing?.url) window.open(existing.url, '_blank', 'noreferrer');
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold border ${
                      hasUrl ? 'bg-white text-[#1F315C] border-[#D4DEEF]' : 'bg-slate-50 text-slate-400 border-[#E5E9F1]'
                    }`}
                  >
                    <Eye size={16} />
                    View
                  </button>

                  <button
                    type="button"
                    disabled={uploading || !email}
                    onClick={() => openFilePicker(d.key)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white shadow-sm disabled:opacity-60"
                  >
                    <Upload size={16} />
                    {uploading ? 'Uploading…' : hasUrl ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
