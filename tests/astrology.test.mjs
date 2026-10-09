import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { anchors, LONDON, localInstant, validateProfile } from '../server/astrology-input.mjs';
import { createQuotaStore, userIdentity } from '../server/astrology-quota.mjs';
import { createAstrologyService, normalizeSubject, contextMetadata } from '../server/astrology.mjs';
import { buildPrompt, runFunction } from '../server/agent-context.mjs';
import { knownProfile, subjectFixture, providerFixture } from './fixtures/astrologer.mjs';
process.env.ASTROLOGY_SESSION_SECRET = 'synthetic-test-secret-at-least-32-characters';
async function setup(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aeon-quota-')); t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [], quota = createQuotaStore(root);
  const service = createAstrologyService({ quota, enabled: true, fetch: async (url, args) => { calls.push({ url, args }); return providerFixture(url, args); }, ...options });
  const profileId = service.confirm('user-a', knownProfile).profileId;
  return { service, profileId, calls, quota, root };
}

test('London defaults, local wall time, historical DST gaps and overlaps', () => {
  assert.equal(validateProfile({ birthDate: '1990-01-01', confirmed: true, providerConsent: true }).timeConfidence, 'unknown');
  assert.deepEqual(validateProfile({ birthDate: '1990-01-01', confirmed: true, providerConsent: true }).location, LONDON);
  assert.equal(localInstant('1990-05-01', '10:15', 'Europe/London').toISOString(), '1990-05-01T09:15:00.000Z');
  assert.equal(localInstant('1970-01-01', '12:00', 'Europe/London').toISOString(), '1970-01-01T11:00:00.000Z');
  assert.throws(() => localInstant('2026-03-29', '01:30', 'Europe/London'), /did not exist/);
  assert.throws(() => localInstant('2026-10-25', '01:30', 'Europe/London'), /occurred twice/);
  assert.equal(localInstant('2026-10-25', '01:30', 'Europe/London', 'earlier').toISOString(), '2026-10-25T00:30:00.000Z');
  assert.equal(localInstant('2026-10-25', '01:30', 'Europe/London', 'later').toISOString(), '2026-10-25T01:30:00.000Z');
  assert.throws(() => validateProfile({ ...knownProfile, birthDate: '2026-02-30' }));
  assert.throws(() => validateProfile({ ...knownProfile, location: { ...LONDON, timezone: 'London' } }));
  assert.throws(() => validateProfile({ ...knownProfile, confirmed: false }));
  assert.equal(validateProfile({ ...knownProfile, location: { ...LONDON, longitude: 0 } }).location.longitude, 0);
});
test('horizon dates remain London noon across DST and reject out-of-range dates', () => {
  const dates = anchors('2026-10-24');
  assert.deepEqual(dates.map(s => s.date), ['2026-10-24', '2026-10-27', '2026-10-31', '2026-11-23']);
  assert.equal(dates[0].at, '2026-10-24T11:00:00.000Z'); assert.equal(dates[1].at, '2026-10-27T12:00:00.000Z');
  assert.throws(() => anchors('2100-12-31'));
});
test('anonymous identity is HttpOnly, signed and cannot be forged', () => {
  const user = userIdentity('', true); assert.match(user.cookie, /HttpOnly; SameSite=Strict/); assert.match(user.cookie, /Secure/);
  assert.equal(userIdentity(user.cookie).id, user.id);
  assert.notEqual(userIdentity(user.cookie.replace(user.id, 'a'.repeat(48))).id, user.id);
});
test('atomic five-attempt ledger survives restart and concurrent reservations', async t => {
  const { quota, root } = await setup(t);
  const results = await Promise.allSettled(Array.from({ length: 18 }, () => quota.reserve('shared-user')));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 5);
  assert.equal((await createQuotaStore(root).usage('shared-user')).remaining, 0);
  assert.equal((await quota.usage('another-user')).remaining, 5);
  const files = await readdir(root);
  for (const file of files) { assert.ok(!file.includes('shared-user')); assert.deepEqual(Object.keys(JSON.parse(await readFile(path.join(root, file), 'utf8'))), ['count']); }
});
test('full reading uses exactly five calls; warm reading and Zeus share facts without spending', async t => {
  const { service, profileId, calls } = await setup(t);
  const first = await service.prepare('user-a', profileId, '2026-10-09', true);
  assert.equal(calls.length, 5); assert.equal(first.usage.remaining, 0); assert.equal(first.source, 'Astrologer v6');
  assert.equal(first.natal.planets.find(p => p.name === 'Mercury').retrograde, true);
  assert.equal(first.natal.houses.length, 12); assert.equal(first.snapshots.length, 4);
  assert.ok(first.snapshots.every(s => s.natalAspects.some(a => a.natal === 'Sun')));
  const natalRequest = JSON.parse(calls[0].args.body).subject;
  assert.equal(natalRequest.hour, 10); assert.equal(natalRequest.minute, 15); assert.equal(natalRequest.timezone, 'Europe/London');
  assert.equal(natalRequest.longitude, -0.1278); assert.equal(natalRequest.name, 'myAeon profile');
  assert.match(calls[1].url, /chart-data\/transit$/);
  assert.ok(JSON.parse(calls[1].args.body).transit_subject); assert.ok(!JSON.parse(calls[1].args.body).second_subject);
  const warm = await service.prepare('user-a', profileId, '2026-10-09', true); assert.equal(calls.length, 5);
  assert.deepEqual(warm.natal, first.natal);
  const voice = { viewedDate: '2026-10-09', astrology: service.resolveContext('user-a', first.id) };
  assert.deepEqual(runFunction('get_natal_chart', '{}', voice).natal, first.natal);
  assert.deepEqual((await runFunction('get_transits', '{}', voice)).snapshots[0], first.snapshots[0]);
  assert.match(buildPrompt(voice), /Astrologer v6/); assert.equal(contextMetadata(first).contextId, first.id);
  const exhausted = await service.prepare('user-a', profileId, '2026-11-01', false);
  assert.equal(calls.length, 5); assert.equal(exhausted.snapshots[0].source, 'astronomy-engine');
  assert.deepEqual(exhausted.snapshots[0].natalAspects, []); assert.match(exhausted.limitations.join(' '), /five.*calls/);
});
test('concurrent identical preparations are deduplicated and never exceed allowance', async t => {
  const { service, profileId, calls } = await setup(t);
  const [a, b] = await Promise.all([service.prepare('user-a', profileId, '2026-10-09', true), service.prepare('user-a', profileId, '2026-10-09', true)]);
  assert.equal(calls.length, 5); assert.deepEqual(a.natal, b.natal); assert.equal(a.usage.used, 5);
});
test('unknown, unconfirmed and polar data do not invent natal facts or spend calls', async t => {
  const { service, calls } = await setup(t);
  const unknown = service.confirm('user-a', { ...knownProfile, timeConfidence: 'unknown', birthTime: undefined }).profileId;
  const a = await service.prepare('user-a', unknown, '2026-10-09', true);
  assert.equal(a.natal, null); assert.equal(calls.length, 0); assert.ok(a.snapshots.every(s => !s.natalAspects.length)); assert.match(a.limitations.join(' '), /Sun signs can be uncertain/);
  const b = await service.prepare(null, undefined, '2026-10-09', false); assert.equal(b.natal, null); assert.equal(b.confidence, 'unconfirmed'); assert.equal(contextMetadata(b).contextId, undefined);
  const polar = service.confirm('user-a', { ...knownProfile, location: { ...LONDON, latitude: 70 } }).profileId;
  const c = await service.prepare('user-a', polar, '2026-10-09', false); assert.equal(c.natal, null); assert.match(c.limitations.join(' '), /polar latitudes/); assert.equal(calls.length, 0);
});
test('estimated time omits houses and angles and discloses approximate positions', async t => {
  const { service } = await setup(t);
  const profileId = service.confirm('user-a', { ...knownProfile, timeConfidence: 'estimated' }).profileId;
  const context = await service.prepare('user-a', profileId, '2026-10-09', false);
  assert.deepEqual(context.natal.houses, []); assert.deepEqual(context.natal.angles, []);
  assert.ok(context.natal.planets.every(p => !p.house)); assert.match(context.limitations.join(' '), /approximate/);
});
test('private contexts are opaque, owner-bound and expire', async t => {
  const { service, profileId } = await setup(t);
  assert.throws(() => service.resolveProfile('user-b', profileId), /expired/);
  const context = await service.prepare('user-a', profileId, '2026-10-09', false);
  assert.throws(() => service.resolveContext('user-b', context.id), /expired/);
  const brief = createAstrologyService({ enabled: false, ttl: 1 }); const id = brief.confirm('user-a', knownProfile).profileId;
  await new Promise(resolve => setTimeout(resolve, 5)); assert.throws(() => brief.resolveProfile('user-a', id), /expired/);
});
for (const status of [401, 403, 422, 429, 503]) test(`provider ${status} counts once, never retries, falls back without natal claims`, async t => {
  let calls = 0;
  const { service, profileId, quota } = await setup(t, { fetch: async () => { calls++; return new Response('no', { status }); } });
  const context = await service.prepare('user-a', profileId, '2026-10-09', true);
  assert.equal(calls, 1); assert.equal((await quota.usage('user-a')).used, 1); assert.equal(context.natal, null);
  assert.ok(context.snapshots.every(s => s.source === 'astronomy-engine' && !s.natalAspects.length));
});
test('malformed success, wrong moment and wrong house settings are never cached as verified', async t => {
  let calls = 0;
  const { service, profileId } = await setup(t, { fetch: async () => { calls++; return Response.json({ status: 'OK', chart_data: { chart_type: 'Natal', subject: { sun: { abs_pos: 12 } } } }); } });
  for (let i = 0; i < 2; i++) assert.equal((await service.prepare('user-a', profileId, '2026-10-09')).natal, null);
  assert.equal(calls, 2);
  const subject = subjectFixture({ ...knownProfile.location, year: 1990, month: 5, day: 1, hour: 10, minute: 15 });
  assert.throws(() => normalizeSubject({ ...subject, perspective_type: 'Heliocentric' }));
  assert.throws(() => normalizeSubject({ ...subject, polar_house_fallbacks: [{}] }));
  assert.throws(() => normalizeSubject({ ...subject, moon: null }));
});
test('timeout and cancellation do not silently retry billable requests', async t => {
  const { service, profileId, quota } = await setup(t, { fetch: async () => { throw new DOMException('Timeout', 'TimeoutError'); } });
  assert.equal((await service.prepare('user-a', profileId, '2026-10-09')).natal, null);
  assert.equal((await quota.usage('user-a')).used, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.prepare('user-a', profileId, '2026-10-09', true, controller.signal), /Aborted/);
  assert.equal((await quota.usage('user-a')).used, 1);
});
test('bounded Zeus functions reject extra fields and theory/Moon requests use no hosted calls', async t => {
  const { service, profileId, calls } = await setup(t);
  const context = await service.prepare('user-a', profileId, '2026-10-09');
  const voice = { viewedDate: '2026-10-09', astrology: context };
  const moon = runFunction('get_moon_phase', '{"date":"2026-10-09"}', voice);
  assert.equal(moon.source, 'astronomy-engine'); assert.ok(moon.illumination >= 0 && moon.illumination <= 1); assert.equal(calls.length, 2);
  assert.throws(() => runFunction('get_transits', '{"dates":["2026-10-10"]}', voice));
  assert.throws(() => runFunction('get_transits', '{"dates":["2026-10-09","2026-10-09","2026-10-09","2026-10-09","2026-10-09"]}', voice));
  assert.throws(() => runFunction('get_natal_chart', '{"apiKey":"x"}', voice));
});

test('wrong returned moment or coordinates are rejected even with an OK chart envelope', async t => {
  for (const field of ['iso_formatted_utc_datetime', 'lat']) {
    const { service, profileId, quota } = await setup(t, { fetch: async (url, args) => {
      const data = await providerFixture(url, args).json();
      data.chart_data.subject[field] = field === 'lat' ? 0 : '1990-05-01T10:15:00Z';
      return Response.json(data);
    } });
    const result = await service.prepare('user-a', profileId, '2026-10-09');
    assert.equal(result.natal, null); assert.match(result.limitations.join(' '), /different time or location/);
    assert.equal((await quota.usage('user-a')).used, 1);
  }
});
test('private caches stay isolated between users; restarting does not reset quota', async t => {
  const { service, profileId, calls, quota } = await setup(t);
  await service.prepare('user-a', profileId, '2026-10-09', true);
  const other = service.confirm('user-b', knownProfile).profileId;
  await service.prepare('user-b', other, '2026-10-09', true);
  assert.equal(calls.length, 10);
  let afterRestart = 0;
  const restarted = createAstrologyService({ quota, enabled: true, fetch: async (url, args) => { afterRestart++; return providerFixture(url, args); } });
  const id = restarted.confirm('user-a', knownProfile).profileId;
  const result = await restarted.prepare('user-a', id, '2026-10-09', true);
  assert.equal(afterRestart, 0); assert.equal(result.natal, null); assert.equal(result.usage.remaining, 0);
});
