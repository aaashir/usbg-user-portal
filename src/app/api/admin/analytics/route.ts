export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';

export async function GET(req: Request) {
  if (!await checkAdminAuth(req)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  const col = db.collection('crm_contacts');

  // ── Plan counts via .count() — fast, no reads ────────────────────────────
  const [sfSnap, sfTrueSnap, efSnap, ufSnap, totalSnap] = await Promise.all([
    col.where('pr', '==', 'SF').count().get(),
    col.where('pr', '==', 'TRUE').count().get(),
    col.where('pr', '==', 'EF').count().get(),
    col.where('pr', '==', 'UF').count().get(),
    col.count().get(),
  ]);
  const sf    = (sfSnap.data() as { count: number }).count + (sfTrueSnap.data() as { count: number }).count;
  const ef    = (efSnap.data() as { count: number }).count;
  const uf    = (ufSnap.data() as { count: number }).count;
  const total = (totalSnap.data() as { count: number }).count;

  // ── Fetch minimal fields for aggregation (state, createDate, industry, plan)
  //    Use select() to minimise data transfer ──────────────────────────────
  const snap = await col.select('state', 'createDate', 'industry', 'pr', 'plan', 'monthlyRevenue').get();

  const stateMap:    Record<string, number> = {};
  const industryMap: Record<string, number> = {};
  const revenueMap:  Record<string, number> = {};
  const monthly:     number[] = Array(12).fill(0);
  // signups per day for the last 30 days
  const daily:       number[] = Array(30).fill(0);

  const now = new Date();

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;

    // State
    const state = String(d.state ?? '').trim();
    if (state) stateMap[state] = (stateMap[state] ?? 0) + 1;

    // Industry
    const industry = String(d.industry ?? '').trim();
    if (industry) industryMap[industry] = (industryMap[industry] ?? 0) + 1;

    // Monthly revenue
    const rev = String(d.monthlyRevenue ?? '').trim();
    if (rev) revenueMap[rev] = (revenueMap[rev] ?? 0) + 1;

    // Monthly signups (last 12 months)
    const rawDate = d.createDate;
    if (rawDate) {
      const date = typeof rawDate === 'string' ? new Date(rawDate)
        : typeof (rawDate as { toDate?: () => Date }).toDate === 'function'
          ? (rawDate as { toDate: () => Date }).toDate()
          : null;
      if (date && Number.isFinite(date.getTime())) {
        const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        if (diffMonths >= 0 && diffMonths < 12) monthly[11 - diffMonths]++;

        // Daily (last 30 days)
        const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
        if (diffDays >= 0 && diffDays < 30) daily[29 - diffDays]++;
      }
    }
  }

  // Sort & slice
  const topStates     = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topIndustries = Object.entries(industryMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const revenueBreakdown = Object.entries(revenueMap).sort((a, b) => b[1] - a[1]);

  // Month labels for last 12 months
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabels = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return MONTH_LABELS[d.getMonth()];
  });

  // Day labels for last 30 days
  const dayLabels = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86_400_000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  return NextResponse.json({
    total, sf, ef, uf,
    topStates, topIndustries, revenueBreakdown,
    monthly, monthLabels,
    daily, dayLabels,
  });
}
