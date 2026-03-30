'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Check, X, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  icon?: React.ReactNode;
}

interface ToastContextValue {
  toast: (opts: { type?: ToastType; title: string; message?: string; icon?: React.ReactNode }) => void;
  success: (title: string, message?: string, icon?: React.ReactNode) => void;
  error:   (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const TYPE_STYLES: Record<ToastType, { border: string; icon: React.ReactNode }> = {
  success: { border: 'border-emerald-200', icon: <Check size={14} strokeWidth={3} className="text-emerald-500" /> },
  error:   { border: 'border-red-200',     icon: <X    size={14} strokeWidth={3} className="text-red-500"     /> },
  info:    { border: 'border-blue-200',    icon: <Info size={14}                 className="text-blue-500"    /> },
  warning: { border: 'border-amber-200',   icon: <AlertTriangle size={14}        className="text-amber-500"   /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((opts: { type?: ToastType; title: string; message?: string; icon?: React.ReactNode }) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type: opts.type ?? 'success', title: opts.title, message: opts.message, icon: opts.icon };
    setToasts(prev => [toast, ...prev].slice(0, 5)); // max 5
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const value: ToastContextValue = {
    toast:   addToast,
    success: (title, message, icon) => addToast({ type: 'success', title, message, icon }),
    error:   (title, message)       => addToast({ type: 'error',   title, message }),
    info:    (title, message)       => addToast({ type: 'info',    title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container — top right */}
      <div className="fixed top-[68px] right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ minWidth: '280px', maxWidth: '340px' }}>
        {toasts.map(t => {
          const style = TYPE_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 bg-white border ${style.border} rounded-xl shadow-lg px-4 py-3 animate-fade-up`}
              style={{ animation: 'slideIn 0.2s ease-out' }}
            >
              <div className="mt-0.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                {t.icon ?? style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 leading-tight">{t.title}</p>
                {t.message && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{t.message}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
