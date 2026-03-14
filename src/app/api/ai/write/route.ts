import { NextResponse } from 'next/server';
import { openAiKey } from '@/app/api/grants/_shared';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const key = openAiKey();
  if (!key) return NextResponse.json({ message: 'Server is not configured for AI.' }, { status: 500 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const prompt =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).prompt === 'string'
      ? String((body as Record<string, unknown>).prompt)
      : '';

  if (!prompt.trim()) return NextResponse.json({ message: 'Missing prompt.' }, { status: 400 });

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content:
            'You help users write strong grant materials. Be concise, specific, and professional. Use plain text.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!upstream.ok) {
    return NextResponse.json({ message: 'Unable to generate writing right now.' }, { status: 502 });
  }

  const data = (await upstream.json()) as unknown;
  const text = (() => {
    if (!data || typeof data !== 'object') return '';
    const record = data as Record<string, unknown>;
    const v = record.output_text;
    return typeof v === 'string' ? v : '';
  })();

  return NextResponse.json({ text });
}
