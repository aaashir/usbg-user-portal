'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Lock, Mail, MapPin } from 'lucide-react';
import packageJson from '../../../package.json';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmailZip } = useAuth();

  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => {
    const z = zipCode.trim();
    return email.trim().length > 0 && z.length === 5 && /^\d{5}$/.test(z);
  }, [email, zipCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    const result = await loginWithEmailZip(email, zipCode);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace('/');
  }

  return (
    <div className="w-full animate-fade-up delay-0">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <Image
          src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
          alt="US Business Grants"
          width={240}
          height={44}
          className="h-11 w-auto"
          priority
        />
        <p className="text-slate-500 text-sm font-medium tracking-wide">Member Grant Portal</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#3A8CF6] via-[#2F72D8] to-[#1A5BBF]" />

        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#EAF1FB] flex items-center justify-center">
              <Lock size={18} className="text-[#0F4DBA]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1E293B] leading-tight">Sign In to Your Account</h1>
              <p className="text-xs text-slate-500 font-medium">Enter your credentials to access your portal</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3A8CF6] focus:bg-white transition-colors"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide" htmlFor="zip">
                Zip Code
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="zip"
                  name="zip"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3A8CF6] focus:bg-white transition-colors"
                  placeholder="5-digit zip"
                  required
                  autoComplete="postal-code"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {error}
                {error === 'No permission to access file. Reason: Non-payment.' && (
                  <p className="mt-1.5">
                    Please{' '}
                    <a
                      className="font-semibold underline text-red-800"
                      href="https://usbusinessgrants.org/update-payment.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      update your payment
                    </a>{' '}
                    to regain access.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="w-full rounded-lg bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-3 text-sm font-bold shadow-md disabled:opacity-50 hover:from-[#2F7FE8] hover:to-[#245DC0] transition-all mt-2"
            >
              {isSubmitting ? 'Verifying…' : 'Access My Portal'}
            </button>
          </form>
        </div>

        <div className="px-8 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Secure member access</span>
          <span className="text-[11px] text-slate-400 font-medium">v{packageJson.version}</span>
        </div>
      </div>

      <p className="mt-5 text-center text-slate-400 text-xs">
        © {new Date().getFullYear()} US Business Grants. All rights reserved.
      </p>
    </div>
  );
}
