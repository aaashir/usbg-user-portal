'use client';

import React, { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/components/auth/AuthProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isLoginRoute = pathname === '/login';
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
  const isPublicRoute = pathname?.startsWith('/f/') ?? false;
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAdminRoute || isPublicRoute) return;
    if (!isLoginRoute && !user) router.replace('/login');
    if (isLoginRoute && user) router.replace('/');
  }, [isLoading, isLoginRoute, isAdminRoute, isPublicRoute, router, user]);

  if (!isAdminRoute && !isPublicRoute && !isLoginRoute && !user) return null;

  if (isPublicRoute) {
    return <main className="flex-1 min-h-screen">{children}</main>;
  }

  if (isAdminRoute) {
    return <main className="flex-1 min-h-screen bg-slate-100">{children}</main>;
  }

  if (isLoginRoute) {
    return (
      <main className="flex-1 min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    );
  }

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4">
        <button
          type="button"
          className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-slate-200 bg-white text-slate-700"
          aria-label="Open menu"
          onClick={() => setIsMobileNavOpen(true)}
        >
          <Menu size={18} />
        </button>
        <Image
          src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
          alt="US Business Grants"
          width={180}
          height={32}
          className="h-8 w-auto"
          priority
        />
        <div className="w-10" />
      </header>

      <Sidebar mode="mobile" isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
      <Sidebar mode="desktop" />

      <main className="flex-1 md:ml-72 px-4 sm:px-6 lg:px-10 pt-20 pb-8 md:pt-8 md:py-8 transition-all duration-300">
        <div className="max-w-[1600px] mx-auto">{children}</div>
      </main>
    </>
  );
}
