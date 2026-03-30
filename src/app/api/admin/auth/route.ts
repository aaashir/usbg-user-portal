import { NextResponse } from 'next/server';
import { getEnvString } from '../_shared';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  const adminPassword = getEnvString('ADMIN_PASSWORD');
  if (!adminPassword) return NextResponse.json({ ok: false, message: 'Admin not configured.' }, { status: 500 });
  if (password === adminPassword) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, message: 'Incorrect password.' }, { status: 401 });
}
