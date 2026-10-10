import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
// Retained for callers of the former hosted-provider adapter. There is no quota.
export const CALL_LIMIT = null;
const COOKIE = 'aeon-astrology-user';
export class AstrologyError extends Error {
  constructor(code, message, status = 503) { super(message); this.code = code; this.status = status; }
}
export function secret() {
  const value = process.env.ASTROLOGY_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new AstrologyError('configuration', 'Chart enrichment needs ASTROLOGY_SESSION_SECRET (at least 32 characters).');
  return value;
}
export function digest(value) { return createHmac('sha256', secret()).update(value).digest('hex'); }
export function userIdentity(cookieHeader = '', secure = false) {
  const value = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [id, signature] = (value || '').split('.');
  if (/^[a-f0-9]{48}$/.test(id || '') && /^[a-f0-9]{64}$/.test(signature || '') && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(digest(`user:${id}`), 'hex'))) return { id, cookie: null };
  const fresh = randomBytes(24).toString('hex');
  return { id: fresh, cookie: `${COOKIE}=${fresh}.${digest(`user:${fresh}`)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure ? '; Secure' : ''}` };
}
export function requestIdentity(req) {
  return userIdentity(req.headers.get('cookie') || '', process.env.NODE_ENV === 'production' || new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https');
}
export function createQuotaStore() {
  return { usage: async () => null, reserve: async () => null };
}
