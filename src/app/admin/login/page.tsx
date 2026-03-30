'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const router  = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();
      window.localStorage.setItem('usbg:adminToken', idToken);
      router.replace('/admin/contacts');
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? (err as { code: string }).code : '';
      if (['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(code)) {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Left: matches CRM sidebar color ── */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: '#1d2d3e' }}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Vignette so grid fades at edges */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 50%, #1d2d3e 100%)' }}
        />
        {/* Subtle top accent glow */}
        <div
          className="absolute top-0 left-0 right-0 h-64"
          style={{ background: 'linear-gradient(180deg, rgba(255,122,89,0.06) 0%, transparent 100%)' }}
        />

        {/* Logo + label */}
        <div className="relative z-10 flex flex-col items-center gap-5">
          <Image
            src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
            alt="US Business Grants"
            width={160} height={160}
            className="w-36 h-auto"
            style={{ filter: 'brightness(0) invert(1) drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }}
          />
          <div className="flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 bg-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold text-white/50 tracking-[0.18em] uppercase">CRM Admin Portal</span>
          </div>
        </div>
      </div>

      {/* ── Right: matches CRM content area ── */}
      <div className="flex-1 flex items-center justify-center" style={{ background: '#f4f6f8' }}>
        <div className="w-full max-w-[400px] px-6">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
              alt="US Business Grants"
              width={160} height={40}
              className="h-9 w-auto"
            />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#1d2d3e' }}>Welcome back</h2>
            <p className="text-sm text-slate-500">Sign in to continue to the admin panel</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@usbusinessgrants.org"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 outline-none transition-all"
                  style={{ caretColor: '#1d2d3e' }}
                  onFocus={e => { e.target.style.borderColor = '#1d2d3e'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 pr-10 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 outline-none transition-all"
                    style={{ caretColor: '#1d2d3e' }}
                    onFocus={e => { e.target.style.borderColor = '#1d2d3e'; e.target.style.background = '#fff'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                  <span className="w-4 h-4 flex-shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                style={{
                  background: '#1d2d3e',
                  boxShadow: loading ? 'none' : '0 2px 8px rgba(29,45,62,0.3)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>

            </form>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-5">
            US Business Grants · Admin CRM
          </p>
        </div>
      </div>
    </div>
  );
}
