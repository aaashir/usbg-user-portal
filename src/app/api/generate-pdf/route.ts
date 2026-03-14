import { NextResponse } from 'next/server';

type GeneratePdfPayload = Record<string, unknown>;

function getStringProp(data: unknown, key: string) {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export async function POST(req: Request) {
  const url = process.env.PIPEDREAM_PDF_URL;
  if (!url) {
    return NextResponse.json({ message: 'Server is not configured for PDF generation.' }, { status: 500 });
  }

  let payload: GeneratePdfPayload;
  try {
    payload = (await req.json()) as GeneratePdfPayload;
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    return NextResponse.json({ message: 'Unable to generate PDF right now.' }, { status: 502 });
  }

  const data = (await upstream.json()) as unknown;

  const downloadUrl = getStringProp(data, 'downloadUrl') ?? getStringProp(data, 'download_url');

  if (!downloadUrl) {
    return NextResponse.json({ message: 'PDF generation returned an unexpected response.' }, { status: 502 });
  }

  return NextResponse.json({ downloadUrl });
}
