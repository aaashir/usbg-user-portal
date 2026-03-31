'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

const LOGO_URL = 'https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75';

export default function UnsubscribePage() {
  const params  = useSearchParams();
  const success = params.get('success') === '1';
  const token   = params.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(success ? 'done' : 'idle');

  useEffect(() => {
    if (!success && token) {
      setStatus('loading');
      fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
        .then(r => { setStatus(r.ok ? 'done' : 'error'); })
        .catch(() => setStatus('error'));
    }
  }, [token, success]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f6f8] px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md w-full p-8 text-center">
        <Image src={LOGO_URL} alt="US Business Grants" width={180} height={40} className="h-10 w-auto mx-auto mb-6" unoptimized />

        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-4 border-[#0E468F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Processing your request…</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1d2d3e] mb-2">You&apos;ve been unsubscribed</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              You will no longer receive marketing emails from US Business Grants.<br />
              You can still log in to your portal to manage your application.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1d2d3e] mb-2">Invalid link</h1>
            <p className="text-slate-500 text-sm">This unsubscribe link is invalid or has already been used.</p>
          </>
        )}

        {status === 'idle' && (
          <p className="text-slate-400 text-sm">No token provided.</p>
        )}

        <a href="https://usbusinessgrants.org" className="mt-6 inline-block text-xs text-slate-400 hover:text-slate-600 transition-colors">
          usbusinessgrants.org
        </a>
      </div>
    </div>
  );
}
