'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function CustomSelect({ options, value, onChange, placeholder = 'Select…', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          px-3 py-2 rounded-lg border bg-white text-sm font-semibold
          outline-none transition-all select-none
          ${open
            ? 'border-blue-500 ring-2 ring-blue-100 text-slate-800'
            : 'border-slate-200 text-slate-700 hover:border-slate-300'
          }
        `}
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="
          absolute z-50 mt-1.5 w-full min-w-[160px]
          bg-white border border-slate-200 rounded-xl shadow-lg
          py-1 overflow-y-auto max-h-56
          animate-in fade-in slide-in-from-top-1 duration-100
        " style={{ scrollbarWidth: 'thin' }}>
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`
                  w-full flex items-center justify-between gap-2
                  px-3 py-2 text-sm text-left transition-colors
                  ${isSelected
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 font-semibold hover:bg-slate-50'
                  }
                `}
              >
                {opt.label}
                {isSelected && <Check size={13} className="text-blue-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
