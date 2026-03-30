'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';

type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'multi_checkbox';

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
};

type FormData = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft';
  fields: FormField[];
};

const inputBase =
  'w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0E468F] focus:border-transparent transition-colors';
const inputDefault = 'border-slate-200 hover:border-slate-300 bg-white';
const inputError   = 'border-red-300 bg-red-50';

export default function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';

  const [form, setForm]           = useState<FormData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [values, setValues]       = useState<Record<string, string>>({});
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Post height to parent when in embed mode
  function postHeight() {
    if (!isEmbed) return;
    const h = document.body.scrollHeight || document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'usbg-form-height', formId, height: h }, '*');
  }

  // Make body transparent in embed mode so only the card shows
  useEffect(() => {
    if (!isEmbed) return;
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  }, [isEmbed]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/forms/${formId}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        setForm(data);
        const init: Record<string, string> = {};
        (data.fields ?? []).forEach((f: FormField) => { init[f.id] = ''; });
        setValues(init);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, [formId]);

  // Post height after any render when in embed mode
  useEffect(() => {
    if (!isEmbed) return;
    const timer = setTimeout(postHeight, 80);
    return () => clearTimeout(timer);
  });

  function validate() {
    const errs: Record<string, string> = {};
    form?.fields.forEach(f => {
      if (f.required && !values[f.id]?.trim()) errs[f.id] = `${f.label} is required`;
      if (f.type === 'email' && values[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.id]))
        errs[f.id] = 'Enter a valid email address';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error ?? 'Failed to submit. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const wrapClass = isEmbed
    ? ''
    : 'min-h-screen bg-[#F0F5FF] flex flex-col items-center justify-start py-10 px-4';

  // ── Loading
  if (loading) {
    return (
      <div className={`${isEmbed ? '' : 'min-h-screen'} flex items-center justify-center bg-[#F0F5FF]`}>
        <Loader2 size={28} className="animate-spin text-[#0E468F]" />
      </div>
    );
  }

  // ── Not found
  if (!form) {
    return (
      <div className={`${isEmbed ? 'p-6' : 'min-h-screen p-6'} flex items-center justify-center bg-[#F0F5FF]`}>
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#1F315C] mb-2">Form not found</h2>
          <p className="text-[#3E5A8A]">This form doesn&apos;t exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  // ── Inactive
  if (form.status !== 'active') {
    return (
      <div className={`${isEmbed ? 'p-6' : 'min-h-screen p-6'} flex items-center justify-center bg-[#F0F5FF]`}>
        <div className="text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-[#1F315C] mb-2">Form unavailable</h2>
          <p className="text-[#3E5A8A]">This form is not currently accepting submissions.</p>
        </div>
      </div>
    );
  }

  // ── Success
  if (submitted) {
    return (
      <div className={`${isEmbed ? 'py-10 px-4' : 'min-h-screen p-6'} flex items-center justify-center bg-[#F0F5FF]`}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #0E468F, #032D67)' }}>
            <CheckCircle size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#1F315C] mb-2">Submitted!</h2>
          <p className="text-[#3E5A8A]">Your response has been submitted successfully. We&apos;ll be in touch soon.</p>
        </div>
      </div>
    );
  }

  // ── Form
  return (
    <div ref={containerRef} className={wrapClass}>
      <div className={isEmbed ? 'w-full' : 'w-full max-w-lg'}>

        {/* Brand header — hidden in embed */}
        {!isEmbed && (
          <div className="flex items-center justify-center mb-6">
            <Image
              src="https://usbg-subs-admin.vercel.app/_next/image?url=https%3A%2F%2Fusbusinessgrants.org%2Fassets%2Fflag-logo4.png&w=1920&q=75"
              alt="USBG"
              width={200}
              height={56}
              className="object-contain h-14 w-auto"
            />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">

          {/* Gradient header strip */}
          <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(135deg, #0E468F 0%, #032D67 100%)' }}>
            <h1 className="text-2xl font-bold text-white">{form.name}</h1>
            {form.description && (
              <p className="text-blue-200 mt-2 text-sm leading-relaxed">{form.description}</p>
            )}
          </div>

          {/* Fields */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {form.fields.map(field => (
              <div key={field.id}>
                {field.type !== 'checkbox' && (
                  <label className="block text-sm font-semibold text-[#1F315C] mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}

                {field.type === 'textarea' ? (
                  <textarea
                    value={values[field.id] ?? ''}
                    onChange={e => setValues({ ...values, [field.id]: e.target.value })}
                    placeholder={field.placeholder || undefined}
                    rows={4}
                    className={`${inputBase} ${errors[field.id] ? inputError : inputDefault} resize-none`}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={values[field.id] ?? ''}
                    onChange={e => setValues({ ...values, [field.id]: e.target.value })}
                    className={`${inputBase} ${errors[field.id] ? inputError : inputDefault}`}
                  >
                    <option value="">Select an option…</option>
                    {field.options.filter(Boolean).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values[field.id] === 'true'}
                      onChange={e => setValues({ ...values, [field.id]: e.target.checked ? 'true' : 'false' })}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-[#0E468F] focus:ring-[#0E468F]"
                    />
                    <span className="text-sm text-[#1F315C]">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </label>
                ) : field.type === 'multi_checkbox' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {field.options.filter(Boolean).map(opt => {
                      const selected = (values[field.id] ?? '').split(',').map(s => s.trim()).filter(Boolean).includes(opt);
                      return (
                        <label
                          key={opt}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm font-medium select-none ${
                            selected
                              ? 'border-[#0E468F] bg-[#EEF4FF] text-[#0E468F]'
                              : 'border-slate-200 bg-white text-[#1F315C] hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 accent-[#0E468F] flex-shrink-0"
                            checked={selected}
                            onChange={() => {
                              const current = (values[field.id] ?? '').split(',').map(s => s.trim()).filter(Boolean);
                              const next = selected ? current.filter(v => v !== opt) : [...current, opt];
                              setValues({ ...values, [field.id]: next.join(', ') });
                            }}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type={field.type}
                    value={values[field.id] ?? ''}
                    onChange={e => setValues({ ...values, [field.id]: e.target.value })}
                    placeholder={field.placeholder || undefined}
                    className={`${inputBase} ${errors[field.id] ? inputError : inputDefault}`}
                  />
                )}

                {errors[field.id] && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} />
                    {errors[field.id]}
                  </p>
                )}
              </div>
            ))}

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle size={15} />
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 text-white font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #0E468F 0%, #032D67 100%)' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting…
                </>
              ) : 'Submit Application'}
            </button>
          </form>
        </div>

        {!isEmbed && (
          <p className="text-center text-xs text-[#3E5A8A] mt-5 opacity-60">
            Powered by US Business Grants
          </p>
        )}
      </div>
    </div>
  );
}
