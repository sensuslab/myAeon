import { NextResponse } from 'next/server';
import { astrology, providerConfigured } from '../../../../../server/astrology.mjs';
import { requestIdentity } from '../../../../../server/astrology-quota.mjs';
import { sameRequestOrigin } from '@/lib/serverRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function headers(cookie: string | null) { return { 'Cache-Control': 'private, no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) }; }
export async function GET(req: Request) {
  if (!providerConfigured()) return NextResponse.json({ enabled: false, usage: null }, { headers: headers(null) });
  try {
    const user = requestIdentity(req), usage = await astrology.usage(user.id);
    return NextResponse.json({ enabled: true, usage }, { headers: headers(user.cookie) });
  } catch { return NextResponse.json({ enabled: false, usage: null, error: 'Chart enrichment needs its session secret and persistent allowance storage.' }, { headers: headers(null) }); }
}
export async function POST(req: Request) {
  if (!sameRequestOrigin(req)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  let cookie: string | null = null;
  try {
    if (Number(req.headers.get('content-length')) > 10000) return NextResponse.json({ error: 'Birth details are too large.' }, { status: 413 });
    const raw = await req.text();
    if (raw.length > 10000) return NextResponse.json({ error: 'Birth details are too large.' }, { status: 413 });
    const user = requestIdentity(req); cookie = user.cookie;
    const result = astrology.confirm(user.id, JSON.parse(raw));
    return NextResponse.json(result, { headers: headers(cookie) });
  } catch (error) {
    const message = error instanceof Error && error.name !== 'ZodError' ? error.message : 'Check your birth date, time confidence, location, timezone and consent.';
    return NextResponse.json({ error: message }, { status: 400, headers: headers(cookie) });
  }
}
