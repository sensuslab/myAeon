import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CALL_LIMIT = 5;
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
function directory() {
  const configured = process.env.ASTROLOGY_QUOTA_DIR;
  if (!configured || !path.isAbsolute(configured)) throw new AstrologyError('configuration', 'Chart enrichment needs ASTROLOGY_QUOTA_DIR on persistent storage.');
  return configured;
}
export function createQuotaStore(root = directory()) {
  async function locked(id, operation) {
    const key = digest(`quota:${id}`), lock = path.join(root, `${key}.lock`), file = path.join(root, `${key}.json`);
    await mkdir(root, { recursive: true, mode: 0o700 });
    let acquired = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try { await mkdir(lock, { mode: 0o700 }); acquired = true; break; }
      catch (error) { if (error.code !== 'EEXIST') throw error; await new Promise(resolve => setTimeout(resolve, 25)); }
    }
    // Never steal stale locks: denying service is safer than overspending.
    if (!acquired) throw new AstrologyError('quota_busy', 'Chart allowance is busy. Try again in a moment.');
    try {
      let count = 0;
      try { const data = JSON.parse(await readFile(file, 'utf8')); count = data.count; if (!Number.isInteger(count) || count < 0 || count > CALL_LIMIT) throw new Error('Invalid ledger'); }
      catch (error) { if (error.code !== 'ENOENT') throw new AstrologyError('quota_storage', 'Chart allowance could not be verified.'); }
      return await operation(count, async next => {
        const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
        await writeFile(temp, JSON.stringify({ count: next }), { mode: 0o600, flush: true });
        await rename(temp, file);
      });
    } finally { await rm(lock, { recursive: true, force: true }); }
  }
  return {
    usage: id => locked(id, count => ({ limit: CALL_LIMIT, used: count, remaining: CALL_LIMIT - count, period: 'total' })),
    reserve: id => locked(id, async (count, save) => {
      if (count >= CALL_LIMIT) throw new AstrologyError('quota_exhausted', 'Your five Astrologer API calls have been used. Cached charts and local sky exploration remain available.', 429);
      await save(count + 1); // Reserve before sending, including failed/timeout requests.
      return { limit: CALL_LIMIT, used: count + 1, remaining: CALL_LIMIT - count - 1, period: 'total' };
    }),
  };
}
