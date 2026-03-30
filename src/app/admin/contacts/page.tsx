'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import CustomSelect from '@/components/ui/CustomSelect';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
         SlidersHorizontal, X, Download, ChevronDown as TierChevron,
         Columns3, Check, Pencil, Trash2, RefreshCw } from 'lucide-react';

function HubSpotSyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center w-5 h-5">
      <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FF7A59" d="M22.447 11.267a5.47 5.47 0 0 0-4.077-4.25V5.277a1.87 1.87 0 0 0 1.08-1.685v-.055a1.87 1.87 0 0 0-1.87-1.87h-.056a1.87 1.87 0 0 0-1.87 1.87v.055a1.87 1.87 0 0 0 1.08 1.685v1.74a5.47 5.47 0 0 0-2.59 1.085L7.28 4.507a2.05 2.05 0 1 0-.912 1.23l6.63 3.7a5.5 5.5 0 0 0-.73 2.724 5.47 5.47 0 0 0 2.685 4.72l-.828 1.147a1.69 1.69 0 1 0 1.255.57l.905-1.255a5.48 5.48 0 0 0 6.162-6.076zm-5.474 4.3a3.106 3.106 0 1 1 0-6.213 3.106 3.106 0 0 1 0 6.213z"/>
      </svg>
      <span className={`absolute -bottom-0.5 -right-0.5 bg-white rounded-full ${spinning ? 'animate-spin' : ''}`}>
        <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
          <path d="M10.5 6A4.5 4.5 0 1 1 6 1.5" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round"/>
          <path d="M5 0l2.5 2L5 4" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </span>
  );
}

function BrevoSyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center w-5 h-5">
      {/* Official Brevo SVG icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#0B996E" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0M7.2 4.8h5.747c2.34 0 3.895 1.406 3.895 3.516c0 1.022-.348 1.862-1.09 2.588C17.189 11.812 18 13.22 18 14.785c0 2.86-2.64 5.016-6.164 5.016H7.199v-15zm2.085 1.952v5.537h.07c.233-.432.858-.796 2.249-1.226c2.039-.659 3.037-1.52 3.037-2.655c0-.998-.766-1.656-1.924-1.656zm4.87 5.266c-.766.385-1.67.748-2.76 1.11c-1.229.387-2.11 1.386-2.11 2.407v2.315h2.365c2.387 0 4.149-1.34 4.149-3.155c0-1.067-.625-2.087-1.645-2.677z"/>
      </svg>
      {/* Sync badge */}
      <span className={`absolute -bottom-0.5 -right-0.5 bg-white rounded-full ${spinning ? 'animate-spin' : ''}`}>
        <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
          <path d="M10.5 6A4.5 4.5 0 1 1 6 1.5" stroke="#0B996E" strokeWidth="2" strokeLinecap="round"/>
          <path d="M5 0l2.5 2L5 4" stroke="#0B996E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </span>
  );
}
import { useCrmSearch } from '../_crm-context';
import { useToast } from '../_toast-context';

// ── Types ─────────────────────────────────────────────────────────────────────
type Contact = {
  id: string; firstname: string; lastname: string; company: string;
  email: string; phone: string; state: string; industry: string; pr: string; createdate: string; zip: string; fundingUse: string;
};
type ApiResponse  = { contacts: Contact[]; total: number; page?: number; totalPages?: number; counts?: { sf: number; ef: number; uf: number }; };
type SortKey      = 'name' | 'email' | 'pr' | 'state' | 'createdate';
type SortDir      = 'asc' | 'desc';
type TabKey       = '' | 'SF' | 'EF' | 'UF';
type ColKey       = 'company' | 'email' | 'phone' | 'type' | 'state' | 'industry' | 'createdate' | 'zip' | 'fundinguse';
type EditableCol  = 'company' | 'type' | 'state' | 'industry' | 'zip';

const ALL_COLS: { key: ColKey; label: string; defaultOn: boolean }[] = [
  { key: 'company',    label: 'Company',      defaultOn: false },
  { key: 'email',      label: 'Email',        defaultOn: true  },
  { key: 'phone',      label: 'Phone',        defaultOn: false },
  { key: 'type',       label: 'Type',         defaultOn: true  },
  { key: 'state',      label: 'State',        defaultOn: true  },
  { key: 'industry',   label: 'Industry',     defaultOn: true  },
  { key: 'createdate', label: 'Create Date',  defaultOn: true  },
  { key: 'zip',        label: 'Zip Code',     defaultOn: false },
  { key: 'fundinguse', label: 'Funding Use',  defaultOn: false },
];

const EDITABLE_COLS: EditableCol[] = ['company', 'type', 'state', 'industry', 'zip'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function prMeta(pr: string) {
  if (pr === 'SF' || pr === 'TRUE') return { label: 'Starter',  color: 'bg-blue-50   text-blue-700  border border-blue-200',   dot: 'bg-blue-400'   };
  if (pr === 'EF')                  return { label: 'Growth',   color: 'bg-amber-50  text-amber-700 border border-amber-200',  dot: 'bg-amber-400'  };
  if (pr === 'UF')                  return { label: 'Unlimited',      color: 'bg-purple-50 text-purple-700 border border-purple-200', dot: 'bg-purple-500' };
  return { label: pr || '—', color: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-300' };
}
function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toString();
}
function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';

  const now      = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);

  const offsetMins = -d.getTimezoneOffset();
  const sign       = offsetMins >= 0 ? '+' : '-';
  const absH       = Math.floor(Math.abs(offsetMins) / 60);
  const absM       = Math.abs(offsetMins) % 60;
  const tz         = absM === 0
    ? `GMT${sign}${absH}`
    : `GMT${sign}${absH}:${String(absM).padStart(2, '0')}`;

  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffDays === 0) return `Today at ${timeStr} ${tz}`;
  if (diffDays === 1) return `Yesterday at ${timeStr} ${tz}`;
  if (diffDays < 7)   return `${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${timeStr} ${tz}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(c: Contact) {
  const f = c.firstname?.[0] ?? ''; const l = c.lastname?.[0] ?? '';
  return (f + l).toUpperCase() || c.email[0].toUpperCase();
}
const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-rose-500','bg-emerald-500','bg-amber-500','bg-cyan-500','bg-pink-500','bg-indigo-500'];
function avatarColor(email: string) { let n = 0; for (const ch of email) n += ch.charCodeAt(0); return AVATAR_COLORS[n % AVATAR_COLORS.length]; }

// ── Custom Checkbox ───────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange, className = '' }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate ?? false; }, [indeterminate]);
  return (
    <label className={`relative cursor-pointer inline-flex items-center justify-center ${className}`}>
      <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div className={`w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center transition-all flex-shrink-0
        ${checked || indeterminate
          ? 'bg-[#0F4DBA] border-[#0F4DBA]'
          : 'bg-white border-slate-300 hover:border-blue-400'
        }`}>
        {checked     && <Check size={11} className="text-white" strokeWidth={3} />}
        {indeterminate && !checked && <div className="w-[8px] h-[2px] bg-white rounded" />}
      </div>
    </label>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-3 pl-4 pr-2 w-10">
        <div className="w-[18px] h-[18px] rounded-[4px] bg-slate-200 animate-pulse" />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-slate-200 animate-pulse rounded-md" />
            <div className="h-2.5 w-36 bg-slate-100 animate-pulse rounded-md" />
          </div>
        </div>
      </td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-3 bg-slate-200 animate-pulse rounded-md" style={{ width: `${55 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

const DEFAULT_PAGE_SIZE = 25;
const COLS_STORAGE_KEY  = 'usbg:cols:visible';

function loadPageSize(): number {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  const v = window.localStorage.getItem('usbg:pref:rows');
  const n = parseInt(v ?? '', 10);
  return [25, 50, 100].includes(n) ? n : DEFAULT_PAGE_SIZE;
}

function loadSortPref(): { key: SortKey; dir: SortDir } {
  if (typeof window === 'undefined') return { key: 'createdate', dir: 'desc' };
  const v = window.localStorage.getItem('usbg:pref:sort') ?? 'Newest first';
  if (v === 'Oldest first') return { key: 'createdate', dir: 'asc' };
  if (v === 'Name A–Z')     return { key: 'name',       dir: 'asc' };
  return { key: 'createdate', dir: 'desc' };
}

function loadVisibleCols(): Set<ColKey> {
  if (typeof window === 'undefined') return new Set(ALL_COLS.filter(c => c.defaultOn).map(c => c.key));
  try {
    const raw = window.localStorage.getItem(COLS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ColKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch { /* ignore */ }
  return new Set(ALL_COLS.filter(c => c.defaultOn).map(c => c.key));
}

// ── Editable cell — standalone so it never remounts on parent re-render ───────
type EditableCellProps = {
  c: Contact;
  col: EditableCol;
  displayContent: React.ReactNode;
  editCell: { id: string; col: EditableCol } | null;
  editDefaultVal: string;
  savingCell: string | null;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onStartEdit: (id: string, col: EditableCol, currentVal: string) => void;
  onTypeChange: (c: Contact, val: string) => void;
};

function EditableCell({
  c, col, displayContent,
  editCell, editDefaultVal, savingCell,
  editInputRef, onKeyDown, onBlur, onStartEdit, onTypeChange,
}: EditableCellProps) {
  const isEditing = editCell?.id === c.id && editCell?.col === col;
  const isSaving  = savingCell === `${c.id}:${col}`;

  if (isEditing) {
    if (col === 'type') {
      return (
        <div className="w-36">
          <CustomSelect
            value={c.pr}
            onChange={val => onTypeChange(c, val)}
            options={[
              { value: 'SF', label: 'Starter' },
              { value: 'EF', label: 'Growth'  },
              { value: 'UF', label: 'Unlimited'     },
            ]}
          />
        </div>
      );
    }
    return (
      <input
        ref={editInputRef}
        key={`${c.id}:${col}`}
        type="text"
        defaultValue={editDefaultVal}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="w-full text-[12px] border border-blue-400 rounded-md px-2 py-1 bg-white text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-blue-200"
        style={{ minWidth: 80 }}
      />
    );
  }

  return (
    <div
      className="group/cell relative flex items-center gap-1 cursor-pointer rounded-md px-1 -mx-1 py-0.5 hover:bg-blue-50/60 transition-colors"
      onClick={() => {
        const currentVal = col === 'company' ? c.company
          : col === 'type' ? c.pr
          : col === 'state' ? c.state
          : col === 'industry' ? c.industry
          : c.zip;
        onStartEdit(c.id, col, currentVal || '');
      }}
      title="Click to edit"
    >
      {isSaving ? (
        <span className="flex items-center gap-1 text-slate-400"><Spinner size={11} /> Saving…</span>
      ) : (
        <>
          {displayContent}
          <Pencil size={10} className="opacity-0 group-hover/cell:opacity-40 text-blue-500 flex-shrink-0 transition-opacity" />
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminContactsPage() {
  const { success, error: toastError } = useToast();
  const [pageSize,         setPageSize]         = useState(DEFAULT_PAGE_SIZE);
  const [contacts,         setContacts]         = useState<Contact[]>([]);
  const [serverTotal,      setServerTotal]      = useState(0);
  const [serverPage,       setServerPage]       = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverLoading,    setServerLoading]    = useState(true);
  const [tierCounts,       setTierCounts]       = useState<{ sf: number; ef: number; uf: number } | null>(null);
  const [error,            setError]            = useState('');
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [bulkLoading,      setBulkLoading]      = useState(false);
  const [tierMenuOpen,     setTierMenuOpen]     = useState(false);
  const [colMenuOpen,      setColMenuOpen]      = useState(false);
  const [visibleCols,      setVisibleCols]      = useState<Set<ColKey>>(
    new Set(ALL_COLS.filter(c => c.defaultOn).map(c => c.key))
  );

  // Load persisted settings on mount
  useEffect(() => {
    setPageSize(loadPageSize());
    const { key, dir } = loadSortPref();
    setSortKey(key);
    setSortDir(dir);
    setVisibleCols(loadVisibleCols());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Inline edit state ─────────────────────────────────────────────────────
  // Use a ref for the input value to avoid re-renders on each keystroke
  const [editCell,    setEditCell]    = useState<{ id: string; col: EditableCol } | null>(null);
  const [savingCell,  setSavingCell]  = useState<string | null>(null);
  const editInputRef   = useRef<HTMLInputElement | null>(null);
  const editDefaultRef = useRef(''); // holds initial value for uncontrolled input

  const tierMenuRef = useRef<HTMLDivElement>(null);
  const colMenuRef  = useRef<HTMLDivElement>(null);

  const { search, setSearch } = useCrmSearch();

  const [brevoSyncing,   setBrevoSyncing]   = useState<string | null>(null);
  const [brevoSyncedSet, setBrevoSyncedSet] = useState<Set<string>>(new Set());
  const [hsSyncingRow,   setHsSyncingRow]   = useState<string | null>(null);
  const [hsSyncedSet,    setHsSyncedSet]    = useState<Set<string>>(new Set());

  async function syncToBrevo(e: React.MouseEvent, email: string) {
    e.preventDefault(); e.stopPropagation();
    if (brevoSyncedSet.has(email)) {
      success('Already synced to Brevo', email);
      return;
    }
    setBrevoSyncing(email);
    try {
      const res = await fetch('/api/admin/brevo-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        setBrevoSyncedSet(prev => new Set(prev).add(email));
        success('Synced to Brevo', email,
          <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#0B996E" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0M7.2 4.8h5.747c2.34 0 3.895 1.406 3.895 3.516c0 1.022-.348 1.862-1.09 2.588C17.189 11.812 18 13.22 18 14.785c0 2.86-2.64 5.016-6.164 5.016H7.199v-15zm2.085 1.952v5.537h.07c.233-.432.858-.796 2.249-1.226c2.039-.659 3.037-1.52 3.037-2.655c0-.998-.766-1.656-1.924-1.656zm4.87 5.266c-.766.385-1.67.748-2.76 1.11c-1.229.387-2.11 1.386-2.11 2.407v2.315h2.365c2.387 0 4.149-1.34 4.149-3.155c0-1.067-.625-2.087-1.645-2.677z"/></svg>
        );
      } else {
        toastError('Brevo sync failed', d.error ?? 'Unknown error');
      }
    } catch {
      toastError('Brevo sync failed', 'Network error');
    } finally {
      setBrevoSyncing(null);
    }
  }

  async function syncToHubSpot(e: React.MouseEvent, email: string) {
    e.preventDefault(); e.stopPropagation();
    if (hsSyncedSet.has(email)) {
      success('Already synced to HubSpot', email);
      return;
    }
    setHsSyncingRow(email);
    try {
      const res = await fetch(`/api/admin/sync-hubspot-contact?email=${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.current}` },
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        setHsSyncedSet(prev => new Set(prev).add(email));
        success('Synced to HubSpot', email,
          <svg width="12" height="12" viewBox="0 0 24 24"><path fill="#FF7A59" d="M22.447 11.267a5.47 5.47 0 0 0-4.077-4.25V5.277a1.87 1.87 0 0 0 1.08-1.685v-.055a1.87 1.87 0 0 0-1.87-1.87h-.056a1.87 1.87 0 0 0-1.87 1.87v.055a1.87 1.87 0 0 0 1.08 1.685v1.74a5.47 5.47 0 0 0-2.59 1.085L7.28 4.507a2.05 2.05 0 1 0-.912 1.23l6.63 3.7a5.5 5.5 0 0 0-.73 2.724 5.47 5.47 0 0 0 2.685 4.72l-.828 1.147a1.69 1.69 0 1 0 1.255.57l.905-1.255a5.48 5.48 0 0 0 6.162-6.076zm-5.474 4.3a3.106 3.106 0 1 1 0-6.213 3.106 3.106 0 0 1 0 6.213z"/></svg>
        );
      } else {
        toastError('HubSpot sync failed', d.error ?? 'Unknown error');
      }
    } catch {
      toastError('HubSpot sync failed', 'Network error');
    } finally {
      setHsSyncingRow(null);
    }
  }

  const [prFilter,     setPrFilter]     = useState<TabKey>('');
  const [stateFilter,  setStateFilter]  = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('createdate');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [showFilters,  setShowFilters]  = useState(false);
  const token = useRef('');
  useEffect(() => { token.current = window.localStorage.getItem('usbg:adminToken') ?? ''; }, []);

  // Build server URL including all active filters — server does all the work
  const buildUrl = useCallback((pg: number) => {
    const p = new URLSearchParams({
      page:  String(pg),
      limit: String(pageSize),
      sort:  sortKey,
      dir:   sortDir,
    });
    if (search.trim())  p.set('search', search.trim().toLowerCase());
    if (prFilter)       p.set('pr', prFilter);
    if (stateFilter)    p.set('state', stateFilter);
    return `/api/admin/users?${p.toString()}`;
  }, [pageSize, sortKey, sortDir, search, prFilter, stateFilter]);

  const fetchPage = useCallback(async (pg: number) => {
    setServerLoading(true);
    try {
      const res  = await fetch(buildUrl(pg), { headers: { Authorization: `Bearer ${token.current}` } });
      if (!res.ok) { setError('Failed to load contacts.'); return; }
      const data = (await res.json()) as ApiResponse;
      setContacts(data.contacts);
      setServerTotal(data.total);
      setServerPage(data.page ?? pg);
      setServerTotalPages(data.totalPages ?? 1);
      if (data.counts) setTierCounts(data.counts);
    } catch { setError('Failed to load contacts.'); }
    finally { setServerLoading(false); }
  }, [buildUrl]);

  // Re-fetch from page 1 whenever any filter/sort changes
  useEffect(() => { void fetchPage(1); }, [fetchPage]);

  // Focus edit input when it appears
  useEffect(() => {
    if (editCell && editInputRef.current) editInputRef.current.focus();
  }, [editCell]);

  function goToServerPage(pg: number) { setServerPage(pg); void fetchPage(pg); }

  // All filtering/sorting is now server-side — just display what came back
  const filtered    = contacts;
  const totalPages  = serverTotalPages;
  const currentPage = serverPage;
  const totalCount  = serverTotal;
  const tableRows   = contacts;
  const loading     = serverLoading;

  const stateOptions = useMemo(() => {
    const s = new Set(contacts.map(c => c.state).filter(Boolean));
    return ['', ...Array.from(s).sort()];
  }, [contacts]);

  const stats = useMemo(() => ({
    total: serverTotal,
    sf:    tierCounts?.sf ?? null,
    ef:    tierCounts?.ef ?? null,
    uf:    tierCounts?.uf ?? null,
  }), [serverTotal, tierCounts]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function navigate(pg: number) { goToServerPage(pg); }
  function clearFilters() { setSearch(''); setPrFilter(''); setStateFilter(''); }

  // ── Selection ─────────────────────────────────────────────────────────────
  const allPageSelected  = tableRows.length > 0 && tableRows.every(c => selectedIds.has(c.id));
  const somePageSelected = tableRows.some(c => selectedIds.has(c.id)) && !allPageSelected;
  function toggleAll() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) tableRows.forEach(c => next.delete(c.id));
      else tableRows.forEach(c => next.add(c.id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  function exportCSV() {
    const src  = contacts;
    const rows = [
      ['Name', 'Email', 'Company', 'Type', 'State', 'Industry', 'Created'],
      ...src.filter(c => selectedIds.has(c.id)).map(c => [
        `${c.firstname} ${c.lastname}`.trim() || c.company,
        c.email, c.company, prMeta(c.pr).label, c.state, c.industry, formatDate(c.createdate),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `contacts-${Date.now()}.csv`,
    }).click();
  }

  async function bulkChangeTier(pr: string) {
    setBulkLoading(true); setTierMenuOpen(false);
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(email =>
      fetch('/api/admin/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
        body: JSON.stringify({ email, fields: { pr } }),
      })
    ));
    const patch = (c: Contact) => selectedIds.has(c.id) ? { ...c, pr } : c;
    setContacts(prev => prev.map(patch));
    // server will refresh on next fetch
    setSelectedIds(new Set()); setBulkLoading(false);
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} contact${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
        body: JSON.stringify({ ids }),
      });
      const idSet = new Set(ids);
      setContacts(prev => prev.filter(c => !idSet.has(c.id)));
      // server will refresh on next fetch
      setServerTotal(prev => prev - ids.length);
      setSelectedIds(new Set());
    } catch { /* ignore */ }
    finally { setBulkLoading(false); }
  }

  // ── Column toggle (persisted) ─────────────────────────────────────────────
  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      window.localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  // ── Inline edit helpers (uncontrolled input — no re-render on keystroke) ──
  function startEdit(id: string, col: EditableCol, currentVal: string) {
    editDefaultRef.current = currentVal;
    setEditCell({ id, col });
  }

  function cancelEdit() { setEditCell(null); }

  async function commitEdit() {
    if (!editCell) return;
    const { id, col } = editCell;
    const newVal = (editInputRef.current?.value ?? '').trim();

    const fieldMap: Record<EditableCol, string> = {
      company: 'company', type: 'pr', state: 'state', industry: 'industry', zip: 'zip',
    };
    const field = fieldMap[col];
    const cellKey = `${id}:${col}`;

    setEditCell(null);
    setSavingCell(cellKey);

    const patch = (c: Contact): Contact => {
      if (c.id !== id) return c;
      if (col === 'company')  return { ...c, company: newVal };
      if (col === 'type')     return { ...c, pr: newVal };
      if (col === 'state')    return { ...c, state: newVal };
      if (col === 'industry') return { ...c, industry: newVal };
      return { ...c, zip: newVal };
    };
    setContacts(prev => prev.map(patch));
    // server will refresh on next fetch

    try {
      await fetch('/api/admin/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
        body: JSON.stringify({ email: id, fields: { [field]: newVal } }),
      });
    } catch { /* optimistic stays */ }
    finally { setSavingCell(null); }
  }

  function handleTypeChange(c: Contact, val: string) {
    setEditCell(null);
    setSavingCell(`${c.id}:type`);
    const patch = (x: Contact): Contact => x.id === c.id ? { ...x, pr: val } : x;
    setContacts(prev => prev.map(patch));
    // server will refresh on next fetch
    fetch('/api/admin/update-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ email: c.id, fields: { pr: val } }),
    }).finally(() => setSavingCell(null));
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  { e.preventDefault(); void commitEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (tierMenuRef.current && !tierMenuRef.current.contains(e.target as Node)) setTierMenuOpen(false);
      if (colMenuRef.current  && !colMenuRef.current.contains(e.target as Node))  setColMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const localTz = (() => {
    const offsetMins = -new Date().getTimezoneOffset();
    const sign = offsetMins >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMins) / 60);
    const absM = Math.abs(offsetMins) % 60;
    return absM === 0 ? `GMT${sign}${absH}` : `GMT${sign}${absH}:${String(absM).padStart(2, '0')}`;
  })();

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown size={11} className="opacity-25 ml-0.5" />;
    return sortDir === 'asc'
      ? <ChevronUp   size={11} className="ml-0.5 text-blue-600" />
      : <ChevronDown size={11} className="ml-0.5 text-blue-600" />;
  }

  const TABS: { key: TabKey; label: string; count: number | null }[] = [
    { key: '',   label: 'All Contacts', count: stats.total },
    { key: 'SF', label: 'Starter',  count: stats.sf },
    { key: 'EF', label: 'Growth',   count: stats.ef },
    { key: 'UF', label: 'Unlimited',      count: stats.uf },
  ];

  const activeCols = ALL_COLS.filter(c => visibleCols.has(c.key));
  const colCount   = 2 + activeCols.length;

  return (
    <div className="flex flex-col h-full -mx-6 -my-6">

      {/* ── Tabs bar ── */}
      <div className="flex items-end gap-0 px-6 pt-5 bg-white border-b border-slate-200">
        {TABS.map(t => {
          const active = prFilter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setPrFilter(t.key); }}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap
                ${active ? 'border-[#0F4DBA] text-[#0F4DBA]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
            >
              {t.label}
              {t.count !== null && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {serverLoading && t.count === 0 ? '…' : t.count != null ? fmtCount(t.count) : '…'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Toolbar / Bulk action bar ── */}
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#eef3ff] border-b border-blue-200">
          <span className="text-[13px] font-semibold text-blue-800">{selectedIds.size} selected</span>
          <div className="w-px h-4 bg-blue-200 mx-1" />
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 transition-colors">
            <Download size={12} /> Export CSV
          </button>
          <div ref={tierMenuRef} className="relative">
            <button onClick={() => setTierMenuOpen(v => !v)} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50">
              {bulkLoading ? <Spinner size={11} /> : null}
              Change Tier <TierChevron size={11} />
            </button>
            {tierMenuOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[140px]">
                {[{ pr:'SF', label:'Starter', dot:'bg-blue-400' }, { pr:'EF', label:'Growth', dot:'bg-amber-400' }, { pr:'UF', label:'Pro', dot:'bg-purple-500' }].map(({ pr, label, dot }) => (
                  <button key={pr} onClick={() => void bulkChangeTier(pr)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full ${dot}`} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => void bulkDelete()} disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-red-300 text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50">
            <Trash2 size={12} /> Delete
          </button>
          <div className="flex-1" />
          <button onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-800">
            <X size={12} /> Deselect all
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-slate-200">
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border transition-colors ${
              showFilters || stateFilter ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
            }`}>
            <SlidersHorizontal size={12} /> Filters
            {stateFilter && <span className="bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">1</span>}
          </button>

          {showFilters && (
            <CustomSelect value={stateFilter} onChange={setStateFilter}
              options={stateOptions.map(s => ({ value: s, label: s || 'All States' }))}
              placeholder="All States" className="w-36" />
          )}
          {stateFilter && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1">
              {stateFilter}<button onClick={() => setStateFilter('')}><X size={10} /></button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2.5 py-1">
              &quot;{search}&quot;<button onClick={() => setSearch('')}><X size={10} /></button>
            </span>
          )}
          {(search || prFilter || stateFilter) && (
            <button onClick={clearFilters} className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1">Clear all</button>
          )}

          <div className="flex-1" />

          {/* Edit columns */}
          <div ref={colMenuRef} className="relative">
            <button onClick={() => setColMenuOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border transition-colors ${
                colMenuOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}>
              <Columns3 size={13} /> Edit columns
            </button>
            {colMenuOpen && (
              <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 w-48">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visible Columns</div>
                {ALL_COLS.map(col => (
                  <button key={col.key} onClick={() => toggleCol(col.key)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <div className={`w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all
                      ${visibleCols.has(col.key) ? 'bg-[#0F4DBA] border-[#0F4DBA]' : 'bg-white border-slate-300'}`}>
                      {visibleCols.has(col.key) && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    {col.label}
                    {EDITABLE_COLS.includes(col.key as EditableCol) && (
                      <span className="ml-auto text-[9px] font-semibold text-blue-400 uppercase tracking-wide">Editable</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[12px] text-slate-400 font-medium ml-2">
            {serverLoading && !contacts.length ? '…' : `${totalCount.toLocaleString()} contact${totalCount !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto bg-white relative">
        {serverLoading && contacts.length > 0 && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-start justify-center pt-20 pointer-events-none">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-md text-xs font-semibold text-slate-600">
              <Spinner size={13} /> Loading…
            </div>
          </div>
        )}

        {serverLoading && contacts.length === 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 pl-4 pr-2 w-10"><div className="w-[18px] h-[18px] rounded-[4px] bg-slate-200 animate-pulse" /></th>
                <th className="py-2.5 px-4 text-left"><div className="h-3 w-12 bg-slate-200 animate-pulse rounded" /></th>
                {activeCols.map(c => (
                  <th key={c.key} className="py-2.5 px-4 text-left">
                    <div className="h-3 bg-slate-200 animate-pulse rounded" style={{ width: `${c.label.length * 8}px` }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: pageSize > 25 ? 12 : 10 }).map((_, i) => (
                <SkeletonRow key={i} cols={activeCols.length} />
              ))}
            </tbody>
          </table>
        ) : error ? (
          <div className="m-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#f4f6f8] border-b border-slate-200">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allPageSelected} indeterminate={somePageSelected} onChange={toggleAll} />
                </th>
                <th className="text-left px-3 py-3 cursor-pointer select-none font-semibold text-[11px] text-slate-500 uppercase tracking-wide" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-0.5">Name <SortIcon k="name" /></span>
                </th>
                {visibleCols.has('company') && (
                  <th className="text-left px-3 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wide">Company</th>
                )}
                {visibleCols.has('email') && (
                  <th className="text-left px-3 py-3 cursor-pointer select-none font-semibold text-[11px] text-slate-500 uppercase tracking-wide" onClick={() => toggleSort('email')}>
                    <span className="flex items-center gap-0.5">Email <SortIcon k="email" /></span>
                  </th>
                )}
                {visibleCols.has('phone') && (
                  <th className="text-left px-3 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wide">Phone</th>
                )}
                {visibleCols.has('type') && (
                  <th className="text-left px-3 py-3 cursor-pointer select-none font-semibold text-[11px] text-slate-500 uppercase tracking-wide" onClick={() => toggleSort('pr')}>
                    <span className="flex items-center gap-0.5">Type <SortIcon k="pr" /></span>
                  </th>
                )}
                {visibleCols.has('state') && (
                  <th className="text-left px-3 py-3 cursor-pointer select-none font-semibold text-[11px] text-slate-500 uppercase tracking-wide" onClick={() => toggleSort('state')}>
                    <span className="flex items-center gap-0.5">State <SortIcon k="state" /></span>
                  </th>
                )}
                {visibleCols.has('industry') && (
                  <th className="text-left px-3 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wide">Industry</th>
                )}
                {visibleCols.has('createdate') && (
                  <th className="text-left px-3 py-3 cursor-pointer select-none font-semibold text-[11px] text-slate-500 uppercase tracking-wide" onClick={() => toggleSort('createdate')}>
                    <span className="flex items-center gap-0.5">Create Date ({localTz}) <SortIcon k="createdate" /></span>
                  </th>
                )}
                {visibleCols.has('zip') && (
                  <th className="text-left px-3 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wide">Zip</th>
                )}
                {visibleCols.has('fundinguse') && (
                  <th className="text-left px-3 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wide">Funding Use</th>
                )}
                <th className="w-16 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr><td colSpan={colCount + 2} className="py-16 text-center text-slate-400 text-sm">No contacts found.</td></tr>
              ) : tableRows.map(c => {
                const pr    = prMeta(c.pr);
                const name  = `${c.firstname} ${c.lastname}`.trim() || c.company || c.email;
                const color = avatarColor(c.email);
                const sel   = selectedIds.has(c.id);
                return (
                  <tr key={c.id} className={`group border-b border-slate-100 transition-colors ${sel ? 'bg-blue-50/70' : 'bg-white hover:bg-slate-50/70'}`}>
                    <td className="px-4 py-3.5">
                      <Checkbox checked={sel} onChange={() => toggleOne(c.id)} />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}>
                          {initials(c)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/admin/contacts/${encodeURIComponent(c.email)}`}
                              className="font-bold text-[#0F4DBA] hover:underline leading-tight truncate max-w-[200px] text-[14px]">
                              {name}
                            </Link>
                            {/* Brevo + HubSpot sync icons — show on row hover */}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              <button
                                onClick={(e) => void syncToBrevo(e, c.email)}
                                disabled={brevoSyncing === c.email}
                                title={brevoSyncedSet.has(c.email) ? 'Already synced to Brevo' : 'Sync to Brevo'}
                                className="flex items-center justify-center rounded hover:bg-green-50 disabled:opacity-40 flex-shrink-0 p-0.5"
                              >
                                <BrevoSyncIcon spinning={brevoSyncing === c.email} />
                              </button>
                              <button
                                onClick={(e) => void syncToHubSpot(e, c.email)}
                                disabled={hsSyncingRow === c.email}
                                title={hsSyncedSet.has(c.email) ? 'Already synced to HubSpot' : 'Sync to HubSpot'}
                                className="flex items-center justify-center rounded hover:bg-orange-50 disabled:opacity-40 flex-shrink-0 p-0.5"
                              >
                                <HubSpotSyncIcon spinning={hsSyncingRow === c.email} />
                              </button>
                            </span>
                          </div>
                          {c.company && name !== c.company && (
                            <div className="text-[12px] text-slate-400 leading-tight truncate max-w-[220px]">{c.company}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {visibleCols.has('company') && (
                      <td className="px-3 py-2.5 text-slate-600 text-[13px] max-w-[180px]">
                        <EditableCell c={c} col="company"
                          editCell={editCell} editDefaultVal={editDefaultRef.current}
                          savingCell={savingCell} editInputRef={editInputRef}
                          onKeyDown={handleEditKeyDown} onBlur={() => void commitEdit()}
                          onStartEdit={startEdit} onTypeChange={handleTypeChange}
                          displayContent={<span className="truncate block">{c.company || <span className="text-slate-300">—</span>}</span>}
                        />
                      </td>
                    )}
                    {visibleCols.has('email') && (
                      <td className="px-3 py-3.5 max-w-[200px]">
                        <span className="truncate block text-[13px] font-semibold text-slate-700">{c.email || '—'}</span>
                      </td>
                    )}
                    {visibleCols.has('phone') && (
                      <td className="px-3 py-3.5 text-slate-600 text-[13px] whitespace-nowrap">{c.phone || <span className="text-slate-300">—</span>}</td>
                    )}
                    {visibleCols.has('type') && (
                      <td className="px-3 py-2.5">
                        <EditableCell c={c} col="type"
                          editCell={editCell} editDefaultVal={editDefaultRef.current}
                          savingCell={savingCell} editInputRef={editInputRef}
                          onKeyDown={handleEditKeyDown} onBlur={() => void commitEdit()}
                          onStartEdit={startEdit} onTypeChange={handleTypeChange}
                          displayContent={
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-semibold ${pr.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pr.dot}`} /> {pr.label}
                            </span>
                          }
                        />
                      </td>
                    )}
                    {visibleCols.has('state') && (
                      <td className="px-3 py-2.5 text-slate-700 text-[13px] font-semibold">
                        <EditableCell c={c} col="state"
                          editCell={editCell} editDefaultVal={editDefaultRef.current}
                          savingCell={savingCell} editInputRef={editInputRef}
                          onKeyDown={handleEditKeyDown} onBlur={() => void commitEdit()}
                          onStartEdit={startEdit} onTypeChange={handleTypeChange}
                          displayContent={<span>{c.state || <span className="text-slate-300 font-normal">—</span>}</span>}
                        />
                      </td>
                    )}
                    {visibleCols.has('industry') && (
                      <td className="px-3 py-2.5 text-slate-600 text-[13px] max-w-[160px]">
                        <EditableCell c={c} col="industry"
                          editCell={editCell} editDefaultVal={editDefaultRef.current}
                          savingCell={savingCell} editInputRef={editInputRef}
                          onKeyDown={handleEditKeyDown} onBlur={() => void commitEdit()}
                          onStartEdit={startEdit} onTypeChange={handleTypeChange}
                          displayContent={<span className="truncate block">{c.industry || <span className="text-slate-300">—</span>}</span>}
                        />
                      </td>
                    )}
                    {visibleCols.has('createdate') && (
                      <td className="px-3 py-3.5 text-slate-500 text-[13px] font-medium whitespace-nowrap">{formatDate(c.createdate)}</td>
                    )}
                    {visibleCols.has('zip') && (
                      <td className="px-3 py-2.5 text-slate-600 text-[13px]">
                        <EditableCell c={c} col="zip"
                          editCell={editCell} editDefaultVal={editDefaultRef.current}
                          savingCell={savingCell} editInputRef={editInputRef}
                          onKeyDown={handleEditKeyDown} onBlur={() => void commitEdit()}
                          onStartEdit={startEdit} onTypeChange={handleTypeChange}
                          displayContent={<span>{c.zip || <span className="text-slate-300">—</span>}</span>}
                        />
                      </td>
                    )}
                    {visibleCols.has('fundinguse') && (
                      <td className="px-3 py-3.5 text-slate-600 text-[13px] max-w-[180px]">
                        <span className="truncate block">{c.fundingUse || <span className="text-slate-300">—</span>}</span>
                      </td>
                    )}
                    <td className="px-3 py-3.5 text-right">
                      <Link href={`/admin/contacts/${encodeURIComponent(c.email)}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[12px] font-bold text-[#0F4DBA] hover:underline whitespace-nowrap">
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination footer ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200">
        <span className="text-[12px] text-slate-500">
          {totalCount === 0
            ? '0 results'
            : `${((currentPage - 1) * pageSize + 1).toLocaleString()} – ${Math.min(currentPage * pageSize, totalCount).toLocaleString()} of ${totalCount.toLocaleString()}`
          }
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(Math.max(1, currentPage - 1))} disabled={currentPage === 1 || loading}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
            <ChevronLeft size={12} /> Prev
          </button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 7)                    p = i + 1;
            else if (currentPage <= 4)              p = i + 1;
            else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
            else                                    p = currentPage - 3 + i;
            return (
              <button key={p} onClick={() => navigate(p)} disabled={loading}
                className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  currentPage === p ? 'bg-[#0F4DBA] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}>{p}
              </button>
            );
          })}
          <button onClick={() => navigate(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages || loading}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
            Next <ChevronRight size={12} />
          </button>
        </div>
        <span className="text-[11px] text-slate-400">{pageSize} per page</span>
      </div>

    </div>
  );
}
