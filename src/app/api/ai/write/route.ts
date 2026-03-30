export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { openAiKey } from '@/app/api/grants/_shared';
import { getAdminFirebase } from '@/app/api/admin/_shared';

/** Returns the Firestore field key for this month's business plan usage, e.g. "business_plan_2025_03" */
function monthKey() {
  const d = new Date();
  return `business_plan_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  const key = openAiKey();
  if (!key) return NextResponse.json({ message: 'Server is not configured for AI.' }, { status: 500 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const asRecord = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const prompt = typeof asRecord.prompt === 'string' ? asRecord.prompt : '';
  const kind   = typeof asRecord.kind   === 'string' ? asRecord.kind   : '';
  const email  = typeof asRecord.email  === 'string' ? asRecord.email.toLowerCase().trim() : '';

  if (!prompt.trim()) return NextResponse.json({ message: 'Missing prompt.' }, { status: 400 });

  // ── Monthly limit: 1 business plan per user per calendar month ────────────
  if (kind === 'business_plan' && email) {
    const db = await getAdminFirebase();
    if (db) {
      const usageRef = db.collection('check_status_app').doc(email).collection('usage').doc('ai');
      const snap = await usageRef.get();
      const count = snap.exists
        ? ((snap.data() as Record<string, unknown>)[monthKey()] as number ?? 0)
        : 0;
      if (count >= 1) {
        return NextResponse.json({
          limitReached: true,
          message: "You've used your 1 business plan for this month. Take time to refine it, and come back next month to create another!",
        }, { status: 429 });
      }
    }
  }

  // ── Call OpenAI ────────────────────────────────────────────────────────────
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert business and social impact analyst.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error('OpenAI error:', upstream.status, errText);
    return NextResponse.json({ message: 'Unable to generate writing right now.' }, { status: 502 });
  }

  const data = (await upstream.json()) as unknown;
  const text = (() => {
    if (!data || typeof data !== 'object') return '';
    const record = data as Record<string, unknown>;
    const choices = record.choices;
    if (!Array.isArray(choices) || choices.length === 0) return '';
    const first = choices[0] as Record<string, unknown>;
    const message = first.message as Record<string, unknown> | undefined;
    return typeof message?.content === 'string' ? message.content : '';
  })();

  // ── Record usage after successful generation ───────────────────────────────
  if (kind === 'business_plan' && email) {
    const db = await getAdminFirebase();
    if (db) {
      const mk = monthKey();
      const usageRef = db.collection('check_status_app').doc(email).collection('usage').doc('ai');
      const snap = await usageRef.get();
      const current = snap.exists ? ((snap.data() as Record<string, unknown>)[mk] as number ?? 0) : 0;
      await usageRef.set({ [mk]: current + 1 }, { merge: true });
    }
  }

  return NextResponse.json({ text });
}
