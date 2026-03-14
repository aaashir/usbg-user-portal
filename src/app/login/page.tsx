'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

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
    <div className="w-full">
      <div className="mb-8 flex justify-center">
        <Image
          src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
          alt="US Business Grants"
          width={220}
          height={40}
          className="h-10 w-auto"
          priority
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold text-slate-900">Login</h1>
        <p className="mt-1 text-sm text-slate-600">Enter your email and zip code to continue.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700" htmlFor="zip">
              Zip Code
            </label>
            <input
              id="zip"
              name="zip"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              required
              autoComplete="postal-code"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-md bg-blue-600 text-white py-2 text-sm font-semibold disabled:opacity-60"
          >
            {isSubmitting ? 'Checking…' : 'Continue'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {error === 'No permission to access file. Reason: Non-payment.' && (
          <p className="mt-4 text-sm text-slate-700">
            If you believe this is an error, please go{' '}
            <a
              className="font-semibold underline text-blue-700"
              href="https://usbusinessgrants.org/update-payment.html"
              target="_blank"
              rel="noreferrer"
            >
              here
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
