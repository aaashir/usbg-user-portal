'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, Settings, LogOut, ChevronRight, Search, X, ChevronUp, Bookmark, Database, Megaphone, PanelLeftClose, PanelLeftOpen, Zap } from 'lucide-react';
import { CrmSearchProvider, useCrmSearch } from './_crm-context';
import { ToastProvider } from './_toast-context';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SubItem  = { label: string; href: string };
type NavGroup = { label: string; icon: LucideIcon; children: SubItem[] };
type NavLeaf  = { label: string; href: string; icon: LucideIcon };
type NavEntry = NavGroup | NavLeaf;

const NAV: NavEntry[] = [
  {
    label: 'CRM',
    icon: Database,
    children: [
      { label: 'Contacts', href: '/admin/contacts' },
      { label: 'Lists',    href: '/admin/contacts/lists' },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { label: 'Forms',   href: '/admin/forms' },
      { label: 'Emails',  href: '/admin/marketing/emails' },
    ],
  },
  {
    label: 'Automations',
    icon: Zap,
    children: [
      { label: 'Bulk Email', href: '/admin/automations/bulk-email' },
    ],
  },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'General',        href: '/admin/settings' },
      { label: 'Users & Access', href: '/admin/settings/users' },
    ],
  },
];

// Flat list for pinned flyout
const ALL_FLAT_NAV: { label: string; href: string }[] = [
  { label: 'Contacts',   href: '/admin/contacts'                },
  { label: 'Lists',      href: '/admin/contacts/lists'          },
  { label: 'Forms',      href: '/admin/forms'                   },
  { label: 'Emails',     href: '/admin/marketing/emails'        },
  { label: 'Bulk Email', href: '/admin/automations/bulk-email'  },
  { label: 'Analytics',  href: '/admin/analytics'               },
  { label: 'Settings',        href: '/admin/settings'               },
  { label: 'Users & Access', href: '/admin/settings/users'        },
];

// ── User dropdown (bottom of sidebar) ────────────────────────────────────────
function UserMenu({ onLogout, displayName, email }: { onLogout: () => void; displayName?: string; email?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = displayName || email?.split('@')[0] || 'Admin';
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} className="relative px-3 pb-3 pt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-[#ff7a59] flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-semibold text-white/90 leading-tight truncate">{name}</div>
          <div className="text-[11px] text-white/35 leading-tight truncate">{email || 'US Business Grants'}</div>
        </div>
        <ChevronUp
          size={13}
          className={`text-white/25 group-hover:text-white/50 transition-all ${open ? '' : 'rotate-180'}`}
        />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-3 right-3 rounded-xl py-1 shadow-2xl z-50"
          style={{ background: '#243447', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Link
            href="/admin/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors rounded-lg mx-1"
          >
            <Settings size={14} className="text-slate-400" /> Settings
          </Link>
          <div className="mx-3 my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <button
            onClick={onLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] font-medium text-slate-300 hover:bg-white/[0.06] hover:text-red-400 transition-colors rounded-lg mx-1"
            style={{ width: 'calc(100% - 8px)' }}
          >
            <LogOut size={14} className="text-slate-400" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inner shell ───────────────────────────────────────────────────────────────
function AdminShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { search, setSearch } = useCrmSearch();
  const [currentUser, setCurrentUser] = useState<{ displayName?: string | null; email?: string | null }>({});

  useEffect(() => {
    void (async () => {
      const { auth } = await import('@/lib/firebase');
      const { onAuthStateChanged } = await import('firebase/auth');
      const unsub = onAuthStateChanged(auth, user => {
        if (user) setCurrentUser({ displayName: user.displayName, email: user.email });
      });
      return () => unsub();
    })();
  }, []);
  const isDetail       = pathname?.startsWith('/admin/contacts/') && pathname !== '/admin/contacts';
  const isContactsPage = pathname?.startsWith('/admin/contacts');
  const searchRef = useRef<HTMLInputElement>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('usbg:sidebarCollapsed') === '1';
  });
  function toggleSidebar() {
    setSidebarCollapsed(v => {
      const next = !v;
      window.localStorage.setItem('usbg:sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  }

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['CRM']));

  // Auto-expand group that contains the active route
  useEffect(() => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      NAV.forEach(entry => {
        if ('children' in entry) {
          const hasActive = entry.children.some(c => pathname?.startsWith(c.href));
          if (hasActive) next.add(entry.label);
        }
      });
      return next;
    });
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  const [pinnedItems, setPinnedItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(window.localStorage.getItem('usbg:pinned') ?? '[]') as string[]); }
    catch { return new Set(); }
  });
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinnedPos,  setPinnedPos]  = useState({ top: 0, left: 0 });
  const pinnedBtnRef = useRef<HTMLButtonElement>(null);
  const pinnedFlyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        pinnedBtnRef.current && !pinnedBtnRef.current.contains(e.target as Node) &&
        pinnedFlyRef.current && !pinnedFlyRef.current.contains(e.target as Node)
      ) setPinnedOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function openPinned() {
    if (pinnedBtnRef.current) {
      const r = pinnedBtnRef.current.getBoundingClientRect();
      setPinnedPos({ top: r.top, left: r.right + 8 });
    }
    setPinnedOpen(v => !v);
  }

  function togglePin(href: string) {
    setPinnedItems(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      window.localStorage.setItem('usbg:pinned', JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function handleLogout() {
    void (async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
      } catch { /* ignore */ }
      window.localStorage.removeItem('usbg:adminToken');
      router.replace('/admin/login');
    })();
  }

  function handleSearch(val: string) {
    setSearch(val);
    if (!isContactsPage && val.trim()) router.push('/admin/contacts');
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Derive current section label from active route
  let section = '';
  for (const entry of NAV) {
    if ('children' in entry) {
      const hit = entry.children.find(c => pathname?.startsWith(c.href));
      if (hit) { section = hit.label; break; }
    } else if (pathname?.startsWith(entry.href)) {
      section = entry.label; break;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Full-width dark top bar ── */}
      <header className="flex-shrink-0 bg-[#1d2d3e] flex items-center z-30 px-5 gap-4" style={{ height: '60px' }}>

        {/* Logo */}
        <div className="flex-shrink-0 flex items-center" style={{ width: '220px' }}>
          <Image
            src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
            alt="US Business Grants"
            width={160} height={36}
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        {/* Search — HubSpot style, full width */}
        <div className="flex-1">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full pl-10 pr-24 py-2.5 text-[14px] rounded-lg outline-none font-medium placeholder-white/75 transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: 'white', WebkitTextFillColor: 'white', caretColor: 'white' }}
              onFocus={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.08)'; }}
              onBlur={e =>  { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {/* ⌘K hint */}
            {!search && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <kbd className="flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white/80 border border-white/40" style={{ lineHeight: 1.4 }}>⌘</kbd>
                <kbd className="flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white/80 border border-white/40" style={{ lineHeight: 1.4 }}>K</kbd>
              </div>
            )}
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right: breadcrumb */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {isDetail && (
            <div className="flex items-center gap-1.5 text-[12px]">
              <Link href="/admin/contacts" className="text-white/35 hover:text-white/65 transition-colors font-medium">Contacts</Link>
              <ChevronRight size={12} className="text-white/20" />
              <span className="text-white/55 font-medium">Detail</span>
            </div>
          )}
          {!isDetail && section && (
            <span className="text-[12px] font-semibold text-white/35">{section}</span>
          )}
        </div>
      </header>

      {/* ── Body row ── */}
      <div className="flex flex-1 overflow-hidden bg-[#1d2d3e]">

        {/* Sidebar */}
        <aside className="flex flex-col bg-[#1d2d3e] text-white overflow-y-auto flex-shrink-0 transition-all duration-200" style={{ width: sidebarCollapsed ? '60px' : '240px' }}>

          {/* Nav */}
          <nav className="flex-1 px-3 pt-4 space-y-0.5">

            {/* Collapse toggle */}
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`w-full flex items-center gap-3.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors mb-1 ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'}`}
            >
              {sidebarCollapsed
                ? <PanelLeftOpen size={18} className="flex-shrink-0" />
                : <><PanelLeftClose size={18} className="flex-shrink-0" /><span className="text-[13px] font-medium">Collapse</span></>
              }
            </button>

            {sidebarCollapsed ? (
              /* ── Icon-only collapsed nav ── */
              <div className="flex flex-col items-center gap-1 pt-1">
                {NAV.map(entry => {
                  if ('children' in entry) {
                    const anyActive = entry.children.some(c => pathname?.startsWith(c.href));
                    const firstChild = entry.children[0];
                    return (
                      <Link key={entry.label} href={firstChild.href} title={firstChild.label}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                          anyActive ? 'bg-white/[0.12] text-white' : 'text-white/40 hover:bg-white/[0.06] hover:text-white/80'
                        }`}>
                        <entry.icon size={20} className={anyActive ? 'text-blue-400' : ''} />
                      </Link>
                    );
                  } else {
                    const active = pathname?.startsWith(entry.href) ?? false;
                    return (
                      <Link key={entry.label} href={entry.href} title={entry.label}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                          active ? 'bg-white/[0.12] text-white' : 'text-white/40 hover:bg-white/[0.06] hover:text-white/80'
                        }`}>
                        <entry.icon size={20} className={active ? 'text-blue-400' : ''} />
                      </Link>
                    );
                  }
                })}
              </div>
            ) : (
              /* ── Full expanded nav ── */
              <>
                {/* Pinned — flyout trigger */}
                <motion.button
                  ref={pinnedBtnRef}
                  onClick={openPinned}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl text-[15px] font-semibold transition-colors
                    ${pinnedOpen ? 'bg-white/[0.10] text-white/80' : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90'}`}
                >
                  <Bookmark size={22} className="flex-shrink-0 text-white/40" />
                  <span className="flex-1 text-left">Pinned</span>
                  <motion.div animate={{ rotate: pinnedOpen ? 90 : 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                    <ChevronRight size={16} className="text-white/25" />
                  </motion.div>
                </motion.button>

                {/* Separator */}
                <div className="py-1.5 mx-1">
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                </div>

                {/* Main nav — grouped accordion */}
                {NAV.map((entry, entryIdx) => {
                  if ('children' in entry) {
                    const GroupIcon = entry.icon;
                    const isOpen    = openGroups.has(entry.label);
                    const anyActive = entry.children.some(c => pathname?.startsWith(c.href));
                    return (
                      <motion.div
                        key={entry.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: entryIdx * 0.06, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <motion.button
                          onClick={() => toggleGroup(entry.label)}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-semibold transition-colors
                            ${anyActive ? 'text-white' : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90'}`}
                        >
                          <GroupIcon size={22} className={`flex-shrink-0 ${anyActive ? 'text-blue-400' : 'text-white/40'}`} />
                          <span className="flex-1 text-left">{entry.label}</span>
                          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}>
                            <ChevronRight size={16} className="text-white/25" />
                          </motion.div>
                        </motion.button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key="sub"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-0.5 mb-1 ml-[13px] pl-[18px]" style={{ borderLeft: '1px solid rgba(255,255,255,0.10)' }}>
                                {entry.children.map((child, idx) => {
                                  const active = pathname?.startsWith(child.href) ?? false;
                                  const pinned = pinnedItems.has(child.href);
                                  return (
                                    <motion.div
                                      key={child.href}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.045, duration: 0.2, ease: 'easeOut' }}
                                      className="group/nav relative"
                                    >
                                      {active && (
                                        <motion.div
                                          layoutId="nav-active-sub"
                                          className="absolute inset-0 rounded-lg"
                                          style={{ background: 'rgba(255,255,255,0.12)' }}
                                          transition={{ type: 'spring', bounce: 0.18, duration: 0.38 }}
                                        />
                                      )}
                                      <Link
                                        href={child.href}
                                        className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors
                                          ${active ? 'text-white' : 'text-white/50 hover:bg-white/[0.06] hover:text-white/85'}`}
                                      >
                                        <span className="flex-1">{child.label}</span>
                                      </Link>
                                      <button
                                        onClick={() => togglePin(child.href)}
                                        title={pinned ? 'Unpin' : 'Pin'}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all
                                          ${pinned ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/nav:opacity-100 text-white/30 hover:text-white/70'}`}
                                      >
                                        <Bookmark size={12} className={pinned ? 'fill-blue-400' : ''} />
                                      </button>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  } else {
                    const LeafIcon = entry.icon;
                    const active   = pathname?.startsWith(entry.href) ?? false;
                    const pinned   = pinnedItems.has(entry.href);
                    return (
                      <motion.div
                        key={entry.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: entryIdx * 0.06, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="group/nav relative"
                      >
                        {active && (
                          <motion.div
                            layoutId="nav-active-leaf"
                            className="absolute inset-0 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.12)' }}
                            transition={{ type: 'spring', bounce: 0.18, duration: 0.38 }}
                          />
                        )}
                        <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                          <Link
                            href={entry.href}
                            className={`relative flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-semibold transition-colors
                              ${active ? 'text-white' : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90'}`}
                          >
                            <LeafIcon size={22} className={`flex-shrink-0 ${active ? 'text-blue-400' : 'text-white/40'}`} />
                            <span className="flex-1">{entry.label}</span>
                          </Link>
                        </motion.div>
                        <button
                          onClick={() => togglePin(entry.href)}
                          title={pinned ? 'Unpin' : 'Pin'}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all
                            ${pinned ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/nav:opacity-100 text-white/30 hover:text-white/70'}`}
                        >
                          <Bookmark size={13} className={pinned ? 'fill-blue-400' : ''} />
                        </button>
                      </motion.div>
                    );
                  }
                })}
              </>
            )}
          </nav>

          {/* Pinned flyout — fixed + animated */}
          <AnimatePresence>
            {pinnedOpen && (
              <motion.div
                ref={pinnedFlyRef}
                initial={{ opacity: 0, scale: 0.94, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -6 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className="fixed z-[100] rounded-xl shadow-2xl overflow-hidden"
                style={{ top: pinnedPos.top, left: pinnedPos.left, background: '#243447', border: '1px solid rgba(255,255,255,0.12)', minWidth: '210px', transformOrigin: 'top left' }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/35">Pinned</span>
                </div>
                {pinnedItems.size === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
                    className="px-4 py-5 text-[13px] text-white/30 text-center leading-relaxed"
                  >
                    No pinned items yet.<br />
                    <span className="text-[11px]">Hover a nav item and click 🔖</span>
                  </motion.div>
                ) : (
                  <div className="py-1">
                    {ALL_FLAT_NAV.filter(n => pinnedItems.has(n.href)).map(({ label, href }, i) => {
                      const active = pathname?.startsWith(href) ?? false;
                      return (
                        <motion.div
                          key={href}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.18 }}
                        >
                          <Link href={href} onClick={() => setPinnedOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors
                              ${active ? 'bg-white/[0.10] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'}`}>
                            {label}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Version + User — hidden when collapsed */}
          {!sidebarCollapsed && (
            <>
              <div className="px-4 py-2 mx-3 mb-1 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">CRM Version</div>
                <div className="text-[13px] font-semibold text-white/70">v0.6.0</div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <UserMenu onLogout={handleLogout} displayName={currentUser.displayName ?? ''} email={currentUser.email ?? ''} />
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 bg-[#f4f6f8] rounded-tl-[20px]">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Outer layout ──────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoginPage) { setChecked(true); return; }
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const { auth } = await import('@/lib/firebase');
      const { onAuthStateChanged } = await import('firebase/auth');
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          window.localStorage.removeItem('usbg:adminToken');
          router.replace('/admin/login');
          return;
        }
        // Refresh token (handles expiry automatically)
        const token = await user.getIdToken();
        window.localStorage.setItem('usbg:adminToken', token);
        setChecked(true);
      });
    })();
    return () => unsubscribe?.();
  }, [isLoginPage, router]);

  if (!checked) return null;
  if (isLoginPage) return <>{children}</>;

  return (
    <ToastProvider>
      <CrmSearchProvider>
        <AdminShell>{children}</AdminShell>
      </CrmSearchProvider>
    </ToastProvider>
  );
}
