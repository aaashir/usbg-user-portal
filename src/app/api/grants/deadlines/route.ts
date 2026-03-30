import { NextResponse } from 'next/server';
import { halfMonthKey, makeGrantId, openAiKey, type GrantItem } from '@/app/api/grants/_shared';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function getGrantsArray(parsedRoot: unknown): unknown[] {
  if (!isRecord(parsedRoot)) return [];
  const grants = parsedRoot['grants'];
  return Array.isArray(grants) ? grants : [];
}

type CacheDoc = {
  grants: GrantItem[];
  cachedAt: number;
  monthKey: string;
};

type AdminLikeDoc = {
  exists: boolean;
  data(): unknown;
};

type AdminLikeRef = {
  get(): Promise<AdminLikeDoc>;
  set(data: unknown, options?: { merge?: boolean }): Promise<void>;
};

type AdminLikeDb = {
  collection(name: string): { doc(id: string): AdminLikeRef };
};

async function getAdminDb(): Promise<AdminLikeDb | null> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : '';

  if (!projectId || !clientEmail || !privateKey) return null;

  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getFirestore() as unknown as AdminLikeDb;
}

async function generateDeadlines(): Promise<GrantItem[]> {
  const key = openAiKey();
  if (!key) throw new Error('missing_openai_key');

  const prompt = '10 nationwide small business grants with application deadlines in the next 60 days (not state-specific)';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Return a single JSON object with shape: { "grants": [ ... ] }. No markdown, no extra text.',
        },
        {
          role: 'user',
          content: `Create 10 items for: "${prompt}". Each item must include: { "name": string, "agency": string, "amount": string, "deadline": string, "summary": string, "url": string }. url must be the best application page (or official program page if application page is unknown). Use empty string for unknown values.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error('openai_failed');

  const data = (await res.json()) as unknown;
  const content = (() => {
    if (!data || typeof data !== 'object') return '';
    const record = data as Record<string, unknown>;
    const choices = record.choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return '';
    const choice0 = choices[0] as Record<string, unknown>;
    const message = choice0.message;
    if (!message || typeof message !== 'object') return '';
    const msg = message as Record<string, unknown>;
    return typeof msg.content === 'string' ? msg.content : '';
  })();

  const parsedRoot = JSON.parse(content) as unknown;
  const grantsRaw = getGrantsArray(parsedRoot);

  return grantsRaw
    .filter((g) => isRecord(g) && typeof g['name'] === 'string' && String(g['name']).trim().length > 0)
    .slice(0, 10)
    .map((g) => {
      const grant = g as Record<string, unknown>;
      const name = String(grant.name ?? '').trim();
      const deadline = typeof grant.deadline === 'string' ? grant.deadline.trim() : undefined;
      const urlRaw = typeof grant.url === 'string' ? grant.url.trim() : '';
      const url = urlRaw.length > 0 ? urlRaw : undefined;
      return {
        id: makeGrantId(`upcoming_deadline|${name}|${deadline ?? ''}`),
        name,
        summary: typeof grant.summary === 'string' ? grant.summary.trim() : '',
        agency: typeof grant.agency === 'string' ? grant.agency.trim() : undefined,
        amount: typeof grant.amount === 'string' ? grant.amount.trim() : undefined,
        deadline,
        url,
        type: 'upcoming_deadline',
      };
    });
}

export async function GET() {
  try {
    const mk = halfMonthKey();
    const cacheId = `deadlines_${mk}`;
    const adminDb = await getAdminDb();

    if (adminDb) {
      const ref = adminDb.collection('grants_cache').doc(cacheId);
      try {
        const snap = await ref.get();
        const existing = (snap.data() as CacheDoc | undefined) ?? null;
        if (existing?.grants?.length && existing.grants.length > 0) {
          return NextResponse.json({ grants: existing.grants, cachedAt: existing.cachedAt, monthKey: mk });
        }
      } catch {
        // ignore cache read failures, still generate below
      }

      const grants = await generateDeadlines();
      const cachedAt = Date.now();
      try {
        await ref.set({ grants, cachedAt, monthKey: mk }, { merge: true });
      } catch {
        // ignore cache write failures
      }
      return NextResponse.json({ grants, cachedAt, monthKey: mk });
    }

    const grants = await generateDeadlines();
    const cachedAt = Date.now();
    return NextResponse.json({ grants, cachedAt, monthKey: mk });
  } catch {
    return NextResponse.json({ message: 'Unable to generate deadlines right now.' }, { status: 502 });
  }
}
