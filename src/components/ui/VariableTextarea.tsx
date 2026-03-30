'use client';

import React, { useRef, useState } from 'react';

export const TEMPLATE_VARIABLES = [
  { key: 'name',         label: 'Full Name',      example: 'John Doe'       },
  { key: 'firstName',    label: 'First Name',     example: 'John'           },
  { key: 'lastName',     label: 'Last Name',      example: 'Doe'            },
  { key: 'businessName', label: 'Business Name',  example: 'Acme LLC'       },
  { key: 'email',        label: 'Email Address',  example: 'john@acme.com'  },
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function VariableTextarea({
  value, onChange, rows = 6, placeholder, className = '', disabled,
}: Props) {
  const [showPopup, setShowPopup] = useState(false);
  const [filter,    setFilter]    = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = TEMPLATE_VARIABLES.filter(v =>
    !filter ||
    v.key.toLowerCase().startsWith(filter.toLowerCase()) ||
    v.label.toLowerCase().includes(filter.toLowerCase())
  );

  function detectVar(val: string, cursorPos: number) {
    const before = val.slice(0, cursorPos);
    const m = before.match(/\{\{([a-zA-Z]*)$/);
    if (m) { setFilter(m[1]); setActiveIdx(0); setShowPopup(true); }
    else     setShowPopup(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onChange(val);
    detectVar(val, e.target.selectionStart ?? val.length);
  }

  function insertVariable(key: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const cur   = ta.selectionStart ?? value.length;
    const before = value.slice(0, cur);
    const after  = value.slice(cur);
    const start  = before.lastIndexOf('{{');
    if (start === -1) return;
    const next = before.slice(0, start) + `{{${key}}}` + after;
    onChange(next);
    setShowPopup(false);
    setTimeout(() => {
      const pos = start + key.length + 4; // {{ + key + }}
      ta.setSelectionRange(pos, pos);
      ta.focus();
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showPopup || !filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[activeIdx]) { e.preventDefault(); insertVariable(filtered[activeIdx].key); }
    }
    if (e.key === 'Escape') setShowPopup(false);
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowPopup(false), 200)}
        onFocus={e => detectVar(value, e.target.selectionStart ?? 0)}
        rows={rows}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />

      {showPopup && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 z-50 bg-white border border-blue-200 rounded-xl shadow-2xl overflow-hidden"
          style={{ top: 'calc(100% + 4px)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Insert Variable</span>
            <span className="text-[10px] text-blue-400 ml-auto">↑↓ navigate · Enter to insert · Esc close</span>
          </div>
          {filtered.map((v, i) => (
            <button
              key={v.key}
              type="button"
              onMouseDown={() => insertVariable(v.key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors text-left group ${
                i === activeIdx ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <code className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                  i === activeIdx ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {`{{${v.key}}}`}
                </code>
                <span className="text-sm text-slate-700 font-medium">{v.label}</span>
              </div>
              <span className="text-xs text-slate-400 italic">{v.example}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
