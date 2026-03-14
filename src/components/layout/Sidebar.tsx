'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileCheck,
  Sparkles,
  FolderOpen,
  MessageSquare,
  UserRound,
  LifeBuoy,
  LogOut,
  X
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

type SidebarProps = {
  mode?: 'desktop' | 'mobile';
  isOpen?: boolean;
  onClose?: () => void;
};

function SidebarShell({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div
      className={`${className} flex flex-col h-screen w-72 bg-gradient-to-b from-[#0E468F] via-[#0A3D83] to-[#032D67] text-white shadow-xl overflow-hidden`}
    >
      {children}
    </div>
  );
}

const Sidebar = ({ mode = 'desktop', isOpen = false, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const activePath = pathname || '/';

  const primaryItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { name: 'My Grants', icon: FileCheck, href: '/grants' },
    { name: 'Messages', icon: MessageSquare, href: '/messages' },
    { name: 'AI Writing Assistant', icon: Sparkles, href: '/ai-assistant' },
    { name: 'Documents', icon: FolderOpen, href: '/documents' },
  ];

  const secondaryItems = [
    { name: 'Account', icon: UserRound, href: '/account' },
    { name: 'Get Help', icon: LifeBuoy, href: '/help' },
  ];

  const content = (
    <>
      <div className="h-[92px] flex items-center justify-between px-6 border-b border-slate-200 bg-slate-50">
        <Image
          src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
          alt="US Business Grants"
          width={240}
          height={44}
          className="h-11 w-auto"
          priority
        />
        {mode === 'mobile' ? (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-200 bg-white text-slate-700"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 px-0 py-2 space-y-1 overflow-y-auto">
        {primaryItems.map((item) => {
          const isActive = activePath === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={mode === 'mobile' ? onClose : undefined}
              className={`flex items-center gap-3 px-6 py-3 min-h-[52px] text-base font-semibold transition-all duration-200
                ${
                  isActive
                    ? 'bg-gradient-to-r from-[#2F67AE]/90 to-[#255796]/90 border-l-[3px] border-[#9CCBFF] text-white'
                    : 'text-[#F1F6FF] hover:bg-[#2F6AB4]/30'
                }`}
            >
              <item.icon size={18} className={isActive ? 'text-white' : 'text-[#D2E4FF]'} />
              <span className="max-w-[170px] leading-tight">{item.name}</span>
            </Link>
          );
        })}

        <div className="my-2 h-px bg-white/15 mx-6"></div>

        {secondaryItems.map((item) => {
          const isActive = activePath === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={mode === 'mobile' ? onClose : undefined}
              className={`flex items-center gap-3 px-6 py-3 min-h-[48px] text-sm font-semibold transition-all duration-200
                ${
                  isActive
                    ? 'bg-white/10 border-l-[3px] border-[#9CCBFF] text-white'
                    : 'text-[#D9E7FF] hover:bg-[#2F6AB4]/30'
                }`}
            >
              <item.icon size={16} className={isActive ? 'text-white' : 'text-[#D2E4FF]'} />
              <span className="max-w-[170px] leading-tight">{item.name}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            logout();
            onClose?.();
            router.replace('/login');
          }}
          className="w-full flex items-center gap-3 px-6 py-3 min-h-[48px] text-sm font-semibold transition-all duration-200 text-[#D9E7FF] hover:bg-[#2F6AB4]/30"
        >
          <LogOut size={16} className="text-[#D2E4FF]" />
          <span className="max-w-[170px] leading-tight">Logout</span>
        </button>
      </nav>

      <div className="absolute inset-x-0 bottom-0 top-[92px] pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_80%_100%,rgba(60,124,202,0.35)_0%,transparent_60%)]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#102C5C]/30"></div>
      </div>

      <div className="absolute bottom-4 left-4 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/30 shadow-lg ring-1 ring-black/10 flex items-center justify-center text-white text-sm font-semibold">
        {String(user?.properties?.['company'] ?? user?.properties?.['email'] ?? 'N')
          .trim()
          .slice(0, 1)
          .toUpperCase()}
      </div>
    </>
  );

  if (mode === 'mobile') {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[60] md:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40"
          aria-label="Close menu backdrop"
          onClick={onClose}
        />
        <div className="absolute inset-y-0 left-0">
          <SidebarShell className="relative">{content}</SidebarShell>
        </div>
      </div>
    );
  }

  return <SidebarShell className="fixed left-0 top-0 z-50 hidden md:flex">{content}</SidebarShell>;
};

export default Sidebar;
