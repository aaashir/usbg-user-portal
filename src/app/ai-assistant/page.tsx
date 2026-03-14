'use client';

import React, { useMemo, useState } from 'react';

export default function AIAssistantPage() {
  const businessPlanQuestions = useMemo(
    () => [
      { key: 'mission', label: 'Mission Statement', placeholder: 'Describe your mission in 1–2 sentences.' },
      { key: 'problem', label: 'Problem You Solve', placeholder: 'What problem does your business solve and for whom?' },
      { key: 'solution', label: 'Your Solution', placeholder: 'How do you solve it? What makes your approach effective?' },
      { key: 'use_of_funds', label: 'Use of Funds', placeholder: 'How will you use grant funds? Be specific with categories.' },
      { key: 'impact', label: 'Community Impact', placeholder: 'What measurable impact will this grant create?' },
      { key: 'pg_business_plan', label: 'PG Prompt (Placeholder)', placeholder: 'Paste the PG question/prompt here.' },
    ],
    []
  );

  const pnlQuestions = useMemo(
    () => [
      { key: 'revenue', label: 'Revenue Overview', placeholder: 'Summarize revenue streams and monthly/annual totals.' },
      { key: 'cogs', label: 'Cost of Goods / Direct Costs', placeholder: 'List direct costs and how they scale with sales.' },
      { key: 'opex', label: 'Operating Expenses', placeholder: 'List major operating expenses and approximate amounts.' },
      { key: 'margin', label: 'Profitability Snapshot', placeholder: 'Provide gross margin and net margin estimates.' },
      { key: 'pg_pnl', label: 'PG Prompt (Placeholder)', placeholder: 'Paste the PG question/prompt here.' },
    ],
    []
  );

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [freeform, setFreeform] = useState('');
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  async function generateFromSection(title: string, keys: string[]) {
    const lines = keys
      .map((k) => {
        const q = [...businessPlanQuestions, ...pnlQuestions].find((x) => x.key === k);
        const answer = (inputs[k] ?? '').trim();
        if (!q) return null;
        return `${q.label}:\n${answer || '(no answer provided)'}\n`;
      })
      .filter(Boolean)
      .join('\n');

    const prompt = `Write a strong, grant-ready ${title} based on the inputs below. Use clear headings and keep it concise.\n\n${lines}`;
    setIsGenerating(true);
    setOutput('');
    try {
      const res = await fetch('/api/ai/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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
    const prompt = freeform.trim();
    if (!prompt) return;
    setIsGenerating(true);
    setOutput('');
    try {
      const res = await fetch('/api/ai/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">AI Writing Assistant</h1>
        <p className="text-slate-500 text-sm font-medium">Quick actions to improve your application.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm">
            <div className="text-lg font-bold text-[#1F315C] mb-3">Business Plan</div>
            <div className="space-y-3">
              {businessPlanQuestions.map((q) => (
                <div key={q.key}>
                  <div className="text-sm font-bold text-[#1F315C] mb-1">{q.label}</div>
                  <textarea
                    value={inputs[q.key] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    className="w-full min-h-[90px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                    placeholder={q.placeholder}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => generateFromSection('Business Plan narrative', businessPlanQuestions.map((q) => q.key))}
              className="mt-4 w-full bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-2.5 rounded-md text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {isGenerating ? 'Generating…' : 'Generate Business Plan'}
            </button>
          </div>

          <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm">
            <div className="text-lg font-bold text-[#1F315C] mb-3">Profit & Loss Statement (Narrative)</div>
            <div className="space-y-3">
              {pnlQuestions.map((q) => (
                <div key={q.key}>
                  <div className="text-sm font-bold text-[#1F315C] mb-1">{q.label}</div>
                  <textarea
                    value={inputs[q.key] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    className="w-full min-h-[90px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                    placeholder={q.placeholder}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => generateFromSection('P&L explanation', pnlQuestions.map((q) => q.key))}
              className="mt-4 w-full bg-gradient-to-r from-[#3A8CF6] to-[#2F72D8] text-white py-2.5 rounded-md text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {isGenerating ? 'Generating…' : 'Generate P&L Narrative'}
            </button>
          </div>

          <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm">
            <div className="text-lg font-bold text-[#1F315C] mb-2">Freeform Help</div>
            <div className="text-sm text-slate-600 mb-3">Ask for rewriting, shortening, polishing, or drafting new content.</div>
            <textarea
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              className="w-full min-h-[140px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              placeholder="Paste text and ask what you want changed…"
            />
            <button
              type="button"
              disabled={isGenerating || !freeform.trim()}
              onClick={generateFreeform}
              className="mt-3 w-full bg-gradient-to-r from-[#2F72D8] to-[#235FB7] text-white py-2.5 rounded-md text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#D4DEEF] rounded-xl p-5 shadow-sm h-fit">
          <div className="text-lg font-bold text-[#1F315C] mb-2">Output</div>
          <textarea
            readOnly
            value={output}
            className="w-full min-h-[520px] rounded-md border border-[#D4DEEF] bg-white px-3 py-2 text-sm text-slate-900 outline-none"
            placeholder="Generated content will appear here…"
          />
        </div>
      </div>
    </div>
  );
}
