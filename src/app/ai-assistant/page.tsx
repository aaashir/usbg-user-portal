'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import Spinner from '@/components/ui/Spinner';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

function currentMonthKey() {
  const d = new Date();
  return `business_plan_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AIAssistantPage() {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);

  const businessPlanQuestions = useMemo(
    () => [
      { key: 'business_name', label: 'Business Name', placeholder: 'Your business name.' },
      { key: 'business_description', label: 'Business Description', placeholder: 'Brief description of what your business does.' },
      { key: 'mission_vision', label: 'Mission & Vision', placeholder: 'Your mission and long-term vision.' },
      { key: 'team_roles', label: 'Team', placeholder: 'Key team members and their roles.' },
      { key: 'advisors', label: 'Advisors', placeholder: 'Any advisors or board members.' },
      { key: 'products_services', label: 'Products / Services', placeholder: 'What you offer and how it works.' },
      { key: 'product_value', label: 'Value Proposition', placeholder: 'Why customers choose you over alternatives.' },
      { key: 'future_products', label: 'Future Plans', placeholder: 'Upcoming products, services, or expansions.' },
      { key: 'marketing_channels', label: 'Marketing Channels', placeholder: 'How you reach and acquire customers.' },
      { key: 'retention_strategies', label: 'Retention Strategies', placeholder: 'How you keep customers coming back.' },
      { key: 'sales_process', label: 'Sales Process', placeholder: 'How you convert leads to customers.' },
      { key: 'financial_projections', label: 'Financial Projections', placeholder: 'Revenue and growth estimates.' },
      { key: 'funding_request', label: 'Funding Request', placeholder: 'Amount requested and how it will be used.' },
    ],
    []
  );

  const pnlQuestions = useMemo(
    () => [
      { key: 'revenue', label: 'Revenue Overview', placeholder: 'Summarize revenue streams and monthly/annual totals.' },
      { key: 'cogs', label: 'Cost of Goods / Direct Costs', placeholder: 'List direct costs and how they scale with sales.' },
      { key: 'opex', label: 'Operating Expenses', placeholder: 'List major operating expenses and approximate amounts.' },
      { key: 'margin', label: 'Profitability Snapshot', placeholder: 'Provide gross margin and net margin estimates.' },
    ],
    []
  );

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [freeform, setFreeform] = useState('');
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastKind, setLastKind] = useState<'business_plan' | 'pnl' | 'freeform' | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedKinds, setSavedKinds] = useState<Set<string>>(new Set());
  const [docName, setDocName] = useState('');

  // Monthly business plan usage
  const [bpUsed, setBpUsed] = useState<boolean>(false);
  const [bpUsageLoaded, setBpUsageLoaded] = useState(false);
  const [showBpConfirm, setShowBpConfirm] = useState(false);

  useEffect(() => {
    if (!email) return;
    const mk = currentMonthKey();
    getDoc(doc(db, 'check_status_app', email, 'usage', 'ai'))
      .then(snap => {
        const count = snap.exists()
          ? ((snap.data() as Record<string, unknown>)[mk] as number ?? 0)
          : 0;
        setBpUsed(count >= 1);
      })
      .catch(() => setBpUsed(false))
      .finally(() => setBpUsageLoaded(true));
  }, [email]);

  async function doGenerateBusinessPlan() {
    const keys = businessPlanQuestions.map(q => q.key);
    const get = (k: string) => (inputs[k] ?? '').trim() || '(not provided)';
    const prompt = `Please generate a comprehensive, professional business plan for a grant application based on the following information:
Business Name: ${get('business_name')}
Description: ${get('business_description')}
Mission & Vision: ${get('mission_vision')}
Team: ${get('team_roles')}
Advisors: ${get('advisors')}
Products/Services: ${get('products_services')}
Value Proposition: ${get('product_value')}
Future Plans: ${get('future_products')}
Marketing Channels: ${get('marketing_channels')}
Retention Strategies: ${get('retention_strategies')}
Sales Process: ${get('sales_process')}
Financial Projections: ${get('financial_projections')}
Funding Request: ${get('funding_request')}
Please structure the business plan with the following sections:
1. Executive Summary
2. Company Overview
3. Products and Services
4. Market Analysis
5. Marketing and Sales Strategy
6. Operational Plan
7. Financial Plan
8. Conclusion
Write in a persuasive, professional tone suitable for grant reviewers. Use clear headings and bullet points where appropriate. Focus on clarity, feasibility, and impact. Output as plain text only. Do not use any markdown formatting (like bold, italics, or headers with hashes). Use simple line breaks and standard text for structure.`;

    setIsGenerating(true);
    setOutput('');
    setSaveStatus(null);
    try {
      const res = await fetch('/api/ai/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, kind: 'business_plan', email }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { message?: string };
        setOutput('');
        setSaveStatus({
          type: 'error',
          message: data.message ?? "You've used your 1 business plan for this month. Come back next month to create another!",
        });
        setBpUsed(true);
        return;
      }

      const data = (await res.json()) as unknown;
      const text =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).text === 'string'
          ? String((data as Record<string, unknown>).text)
          : '';
      setOutput(text);
      if (text) setBpUsed(true); // mark as used after first successful generation
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateFromSection(title: string, keys: string[]) {
    const isBusinessPlan = keys.includes('business_name');
    if (isBusinessPlan) {
      // Delegate to the business plan flow with usage tracking
      setLastKind('business_plan');
      if (bpUsed) {
        setSaveStatus({
          type: 'error',
          message: "You've used your 1 business plan for this month. Take time to refine it, and come back next month to create another!",
        });
        return;
      }
      setShowBpConfirm(true);
      return;
    }

    // P&L — no limit
    const get = (k: string) => (inputs[k] ?? '').trim() || '(not provided)';
    const prompt = `Please generate a comprehensive, professional Profit & Loss narrative for a grant application based on the following financial information:
Revenue Overview: ${get('revenue')}
Cost of Goods / Direct Costs: ${get('cogs')}
Operating Expenses: ${get('opex')}
Profitability Snapshot: ${get('margin')}
Please structure the narrative with the following sections:
1. Revenue Summary
2. Cost Structure
3. Operating Expenses Breakdown
4. Profitability Analysis
5. Financial Health Assessment
6. Grant Impact on Financials
Write in a persuasive, professional tone suitable for grant reviewers. Demonstrate financial responsibility and viability. Use clear headings and bullet points where appropriate. Output as plain text only. Do not use any markdown formatting (like bold, italics, or headers with hashes). Use simple line breaks and standard text for structure.`;
    setIsGenerating(true);
    setOutput('');
    setSaveStatus(null);
    try {
      const res = await fetch('/api/ai/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, kind: 'pnl', email }),
      });
      const data = (await res.json()) as unknown;
      const text =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).text === 'string'
          ? String((data as Record<string, unknown>).text)
          : '';
      setOutput(text);
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateFreeform() {
    const userInput = freeform.trim();
    if (!userInput) return;
    const prompt = `You are helping a business owner improve their grant application materials. ${userInput}\n\nWrite in a persuasive, professional tone suitable for grant reviewers. Output as plain text only. Do not use any markdown formatting (like bold, italics, or headers with hashes). Use simple line breaks and standard text for structure.`;
    setIsGenerating(true);
    setOutput('');
    setSaveStatus(null);
    try {
      const res = await fetch('/api/ai/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, kind: 'freeform', email }),
      });
      const data = (await res.json()) as unknown;
      const text =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).text === 'string'
          ? String((data as Record<string, unknown>).text)
          : '';
      setOutput(text);
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveToDocVault() {
    if (!email) {
      setSaveStatus({ type: 'error', message: 'Missing email.' });
      return;
    }
    const text = output.trim();
    if (!text) {
      setSaveStatus({ type: 'error', message: 'Nothing to save yet.' });
      return;
    }

    const key =
      lastKind === 'business_plan' ? 'ai_business_plan' : lastKind === 'pnl' ? 'ai_pnl_narrative' : 'ai_freeform';
    const defaultLabel =
      lastKind === 'business_plan' ? 'AI Business Plan' : lastKind === 'pnl' ? 'AI P&L Narrative' : 'AI Freeform';
    const customName = docName.trim();
    const label = customName || defaultLabel;
    const safeName = (customName || defaultLabel).replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-');
    const filename = `${safeName}-${new Date().toISOString().slice(0, 10)}.txt`;

    setSaveStatus(null);
    setIsSaving(true);
    try {
      const file = new File([text], filename, { type: 'text/plain' });
      const form = new FormData();
      form.append('email', email);
      form.append('key', key);
      form.append('label', label);
      form.append('file', file);

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && typeof (data as Record<string, unknown>).message === 'string'
            ? String((data as Record<string, unknown>).message)
            : 'Save failed.';
        setSaveStatus({ type: 'error', message: msg });
        return;
      }
      setSaveStatus({ type: 'success', message: 'Saved to Document Vault.' });
      setSavedKinds((prev) => new Set(prev).add(key));
    } catch {
      setSaveStatus({ type: 'error', message: 'Save failed.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* Business Plan Confirmation Modal */}
      {showBpConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-[#1F315C] mb-2">Ready to generate?</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              You&apos;re about to use your 1 business plan for this month—make it count! You can create another next month.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowBpConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowBpConfirm(false); void doGenerateBusinessPlan(); }}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white text-sm font-bold shadow-sm"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">AI Writing Assistant</h1>
        <p className="text-slate-500 text-sm font-medium">Quick actions to improve your application.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6 order-2 lg:order-1">
          <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm animate-fade-up delay-75">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold text-[#1F315C]">Business Plan</div>
              {bpUsageLoaded && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bpUsed ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {bpUsed ? '1/1 used this month' : '0/1 used this month'}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {businessPlanQuestions.map((q) => (
                <div key={q.key}>
                  <div className="text-sm font-bold text-[#1F315C] mb-1">{q.label}</div>
                  <textarea
                    value={inputs[q.key] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    className="w-full min-h-[72px] lg:min-h-[90px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                    placeholder={q.placeholder}
                  />
                </div>
              ))}
            </div>

            {bpUsed ? (
              <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 font-medium leading-relaxed">
                You&apos;ve used your 1 business plan for this month. Take time to refine it, and come back next month to create another!
              </div>
            ) : (
              <button
                type="button"
                disabled={isGenerating || !bpUsageLoaded}
                onClick={() => {
                  setLastKind('business_plan');
                  void generateFromSection('Business Plan narrative', businessPlanQuestions.map((q) => q.key));
                }}
                className="mt-4 w-full bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-2.5 rounded-md text-sm font-bold shadow-sm disabled:opacity-60"
              >
                {isGenerating && lastKind === 'business_plan' ? 'Generating…' : 'Generate Business Plan'}
              </button>
            )}
          </div>

          <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm animate-fade-up delay-150">
            <div className="text-lg font-bold text-[#1F315C] mb-3">Profit & Loss Statement (Narrative)</div>
            <div className="space-y-3">
              {pnlQuestions.map((q) => (
                <div key={q.key}>
                  <div className="text-sm font-bold text-[#1F315C] mb-1">{q.label}</div>
                  <textarea
                    value={inputs[q.key] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    className="w-full min-h-[72px] lg:min-h-[90px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                    placeholder={q.placeholder}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                setLastKind('pnl');
                void generateFromSection('P&L explanation', pnlQuestions.map((q) => q.key));
              }}
              className="mt-4 w-full bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-2.5 rounded-md text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {isGenerating && lastKind === 'pnl' ? 'Generating…' : 'Generate P&L Narrative'}
            </button>
          </div>

          <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm animate-fade-up delay-225">
            <div className="text-lg font-bold text-[#1F315C] mb-2">Freeform Help</div>
            <div className="text-sm text-slate-600 mb-3">Ask for rewriting, shortening, polishing, or drafting new content.</div>
            <textarea
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              className="w-full min-h-[100px] lg:min-h-[140px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              placeholder="Paste text and ask what you want changed…"
            />
            <button
              type="button"
              disabled={isGenerating || !freeform.trim()}
              onClick={() => {
                setLastKind('freeform');
                void generateFreeform();
              }}
              className="mt-3 w-full bg-gradient-to-r from-[#2F72D8] to-[#235FB7] text-white py-2.5 rounded-md text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {isGenerating && lastKind === 'freeform' ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm h-fit animate-fade-up delay-75 order-1 lg:order-2 lg:sticky lg:top-8">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-lg font-bold text-[#1F315C]">Results</div>
            <div className="flex items-center gap-2">
              {(() => {
                const currentKey = lastKind === 'business_plan' ? 'ai_business_plan' : lastKind === 'pnl' ? 'ai_pnl_narrative' : lastKind === 'freeform' ? 'ai_freeform' : null;
                const alreadySaved = currentKey ? savedKinds.has(currentKey) : false;
                return alreadySaved && !isSaving ? (
                  <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>
                ) : null;
              })()}
              <button
                type="button"
                disabled={!output.trim() || !email || isSaving}
                onClick={() => void saveToDocVault()}
                className="inline-flex items-center gap-1.5 justify-center px-3 py-2 rounded-md text-xs sm:text-sm font-bold bg-[#0F4DBA] text-white disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Spinner size={14} />
                    Saving…
                  </>
                ) : (
                  'SAVE TO DOC VAULT'
                )}
              </button>
            </div>
          </div>
          <div className="mb-3">
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Document name (optional)"
              className="w-full rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>

          {saveStatus ? (
            <div
              className={`mb-3 rounded-md border px-3 py-2 text-sm ${
                saveStatus.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-orange-50 border-orange-200 text-orange-800'
              }`}
            >
              {saveStatus.message}
            </div>
          ) : null}
          <textarea
            readOnly
            value={output}
            className="w-full min-h-[220px] lg:min-h-[480px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none"
            placeholder="Generated content will appear here…"
          />
        </div>
      </div>
    </div>
  );
}
