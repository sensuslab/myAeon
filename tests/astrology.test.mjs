import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { anchors, LONDON, localInstant, validateProfile } from '../server/astrology-input.mjs';
import { CALL_LIMIT, createQuotaStore, userIdentity, requestIdentity } from '../server/astrology-quota.mjs';
import { createAstrologyService, normalizeSubject, contextMetadata, providerConfigured } from '../server/astrology.mjs';
import { createKerykeionBridge } from '../server/kerykeion-bridge.mjs';
import { buildPrompt, runFunction } from '../server/agent-context.mjs';
import { knownProfile, subjectFixture, localWorkerFixture } from './fixtures/kerykeion.mjs';

process.env.ASTROLOGY_SESSION_SECRET = 'synthetic-test-secret-at-least-32-characters';
function setup(options = {}) {
  const calls = [];
  const service = createAstrologyService({ enabled: true, worker: async job => { calls.push(job); return localWorkerFixture(job); }, ...options });
  const profileId = service.confirm('user-a', knownProfile).profileId;
  return { service, profileId, calls };
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

test('four horizon dates remain London noon across DST and reject out-of-range dates', () => {
  const dates = anchors('2026-10-24');
  assert.deepEqual(dates.map(s => s.date), ['2026-10-24', '2026-10-27', '2026-10-31', '2026-11-23']);
  assert.equal(dates[0].at, '2026-10-24T11:00:00.000Z');
  assert.equal(dates[1].at, '2026-10-27T12:00:00.000Z');
  assert.throws(() => anchors('2100-12-31'));
});

test('identity remains HttpOnly, signed, request-bound and cannot be forged', () => {
  const user = userIdentity('', true);
  assert.match(user.cookie, /HttpOnly; SameSite=Strict/); assert.match(user.cookie, /Secure/);
  assert.equal(userIdentity(user.cookie).id, user.id);
  assert.notEqual(userIdentity(user.cookie.replace(user.id, 'a'.repeat(48))).id, user.id);
  assert.equal(requestIdentity(new Request('https://example.test/chart', { headers: { cookie: user.cookie } })).id, user.id);
});

test('legacy quota exports remain inert and never require disk storage', async () => {
  const store = createQuotaStore('/does/not/exist');
  assert.equal(CALL_LIMIT, null);
  for (let i = 0; i < 20; i++) assert.equal(await store.reserve('user-a'), null);
  assert.equal(await store.usage('user-a'), null);
});

test('local provider needs no API key and has an explicit disable switch', () => {
  const prior = process.env.ASTROLOGY_ENABLED;
  try {
    delete process.env.ASTROLOGY_ENABLED;
    assert.equal(providerConfigured(), true);
    process.env.ASTROLOGY_ENABLED = 'false'; assert.equal(providerConfigured(), false);
  } finally { if (prior === undefined) delete process.env.ASTROLOGY_ENABLED; else process.env.ASTROLOGY_ENABLED = prior; }
});

test('one local job returns four anchors, SVGs, semantics and null usage; warm facts are shared', async () => {
  const { service, profileId, calls } = setup({ quota: { reserve() { throw new Error('Quota must never run'); }, usage() { throw new Error('Quota must never run'); } }, fetch() { throw new Error('No network'); } });
  const first = await service.prepare('user-a', profileId, '2026-10-09', true);
  assert.equal(calls.length, 1); assert.equal(first.usage, null); assert.equal(first.source, 'Kerykeion');
  assert.equal(first.natal.planets.find(p => p.name === 'Mercury').retrograde, true);
  assert.equal(first.natal.houses.length, 12); assert.equal(first.snapshots.length, 4);
  assert.ok(first.snapshots.every(s => s.natalAspects.some(a => a.natal === 'Sun')));
  assert.equal(calls[0].subject.hour, 10); assert.equal(calls[0].subject.minute, 15);
  assert.equal(calls[0].subject.at, '1990-05-01T09:15:00.000Z'); assert.equal(calls[0].subject.timezone, 'Europe/London');
  assert.equal(first.engine.backend, 'swisseph-moshier'); assert.match(first.charts.natal.dark, /<svg/);
  assert.match(first.chartContext, /<astrology_context/);
  const warm = await service.prepare('user-a', profileId, '2026-10-09', true);
  assert.equal(calls.length, 1); assert.deepEqual(warm.natal, first.natal);
  const voice = { viewedDate: '2026-10-09', astrology: service.resolveContext('user-a', first.id) };
  assert.deepEqual(runFunction('get_natal_chart', '{}', voice).natal, first.natal);
  assert.deepEqual((await runFunction('get_transits', '{}', voice)).snapshots[0], first.snapshots[0]);
  assert.match(buildPrompt(voice), /Kerykeion/); assert.equal(contextMetadata(first).contextId, first.id);
  assert.equal(contextMetadata(first).usage, null); assert.equal(contextMetadata(first).engine.version, '6.0.2');
  for (let day = 1; day < 15; day++) assert.equal((await service.prepare('user-a', profileId, `2026-11-${String(day).padStart(2, '0')}`)).source, 'Kerykeion');
  assert.equal(await service.usage('user-a'), null);
});

test('identical preparations deduplicate while cancellation of one waiter preserves the other', async () => {
  let calls = 0, workerAborted = false;
  const { service, profileId } = setup({ worker: async (job, signal) => { calls++; signal.addEventListener('abort', () => { workerAborted = true; }); await new Promise(r => setTimeout(r, 30)); return localWorkerFixture(job); } });
  const controller = new AbortController();
  const a = service.prepare('user-a', profileId, '2026-10-09', true, controller.signal);
  const b = service.prepare('user-a', profileId, '2026-10-09', true);
  controller.abort();
  await assert.rejects(a, /Aborted/);
  const context = await b;
  assert.equal(calls, 1); assert.equal(workerAborted, false); assert.equal(context.source, 'Kerykeion');
});

test('the last cancelled waiter cancels the worker and no cancelled result is cached', async () => {
  let aborted = false, calls = 0;
  const { service, profileId } = setup({ worker: async (job, signal) => {
    calls++;
    if (calls === 1) await new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
    return localWorkerFixture(job);
  } });
  const controller = new AbortController();
  const pending = service.prepare('user-a', profileId, '2026-10-09', false, controller.signal);
  await new Promise(r => setTimeout(r, 5)); controller.abort();
  await assert.rejects(pending, /Aborted/); assert.equal(aborted, true);
  assert.equal((await service.prepare('user-a', profileId, '2026-10-09')).source, 'Kerykeion'); assert.equal(calls, 2);
});

test('unknown, unconfirmed and polar profiles have no fabricated natal facts or wheels', async () => {
  const { service, calls } = setup();
  const unknown = service.confirm('user-a', { ...knownProfile, timeConfidence: 'unknown', birthTime: undefined }).profileId;
  const a = await service.prepare('user-a', unknown, '2026-10-09', true);
  assert.equal(a.natal, null); assert.equal(a.charts, undefined); assert.equal(calls.length, 0);
  assert.ok(a.snapshots.every(s => !s.natalAspects.length)); assert.match(a.limitations.join(' '), /Sun signs can be uncertain/);
  const b = await service.prepare(null, undefined, '2026-10-09', true);
  assert.equal(b.natal, null); assert.equal(b.confidence, 'unconfirmed'); assert.equal(b.snapshots.length, 4); assert.equal(contextMetadata(b).contextId, undefined);
  const polar = service.confirm('user-a', { ...knownProfile, location: { ...LONDON, latitude: 70 } }).profileId;
  const c = await service.prepare('user-a', polar, '2026-10-09');
  assert.equal(c.natal, null); assert.match(c.limitations.join(' '), /polar latitudes/); assert.equal(calls.length, 0);
});

test('estimated time omits houses, angles and misleading wheels and discloses approximation', async () => {
  const { service } = setup();
  const id = service.confirm('user-a', { ...knownProfile, timeConfidence: 'estimated' }).profileId;
  const context = await service.prepare('user-a', id, '2026-10-09', true);
  assert.deepEqual(context.natal.houses, []); assert.deepEqual(context.natal.angles, []);
  assert.ok(context.natal.planets.every(p => !p.house)); assert.match(context.limitations.join(' '), /approximate/);
  assert.equal(context.charts, undefined); assert.doesNotMatch(context.chartContext, /house=|Ascendant/);
});

test('contexts and profiles are opaque, owner-bound, copy-isolated and expire', async () => {
  const { service, profileId } = setup();
  assert.throws(() => service.resolveProfile('user-b', profileId), /expired/);
  const context = await service.prepare('user-a', profileId, '2026-10-09');
  assert.equal(service.resolveContext('user-a', context.id).profileId, profileId);
  assert.throws(() => service.resolveContext('user-b', context.id), /expired/);
  context.natal.planets[0].longitude = 0;
  assert.equal(service.resolveContext('user-a', context.id).natal.planets[0].longitude, 40);
  const copy = service.resolveContext('user-a', context.id); copy.limitations.length = 0;
  assert.ok(service.resolveContext('user-a', context.id).limitations.length);
  const brief = createAstrologyService({ enabled: false, ttl: 100 });
  const id = brief.confirm('user-a', knownProfile).profileId;
  const short = await brief.prepare('user-a', id, '2026-10-09');
  await new Promise(r => setTimeout(r, 120));
  assert.throws(() => brief.resolveProfile('user-a', id), /expired/);
  assert.throws(() => brief.resolveContext('user-a', short.id), /expired/);
});

test('worker failures never retry, spend, cache failure or claim natal data', async () => {
  let calls = 0;
  const { service, profileId } = setup({ worker: async () => { calls++; throw new Error('Private runtime error'); } });
  for (let i = 0; i < 2; i++) {
    const context = await service.prepare('user-a', profileId, '2026-10-09', true);
    assert.equal(context.natal, null); assert.equal(context.charts, undefined); assert.equal(context.usage, null);
    assert.ok(context.snapshots.every(s => s.source === 'astronomy-engine' && !s.natalAspects.length));
    assert.doesNotMatch(context.limitations.join(' '), /Private runtime error/);
  }
  assert.equal(calls, 2);
});

test('wrong moment, settings, coordinates, missing bodies, anchors or version are rejected before caching', async () => {
  const mutations = [data => { data.natal.iso_formatted_utc_datetime = '1990-05-01T10:15:00Z'; }, data => { data.natal.lat = 0; }, data => { data.natal.perspective_type = 'Heliocentric'; }, data => { data.natal.moon = null; }, data => { data.snapshots = []; }, data => { data.engine.version = 'unverified'; }, data => { data.charts.natal.dark = '<svg onload="alert(1)">' + ' '.repeat(100) + '</svg>'; }];
  for (const mutate of mutations) {
    let calls = 0;
    const { service, profileId } = setup({ worker: async job => { calls++; const data = localWorkerFixture(job); mutate(data); return data; } });
    for (let i = 0; i < 2; i++) assert.equal((await service.prepare('user-a', profileId, '2026-10-09')).natal, null);
    assert.equal(calls, 2);
  }
  const subject = subjectFixture({ ...knownProfile.location, year: 1990, month: 5, day: 1, hour: 10, minute: 15 });
  assert.throws(() => normalizeSubject({ ...subject, polar_house_fallbacks: [{}] }));
  assert.throws(() => normalizeSubject({ ...subject, first_house: null }));
});

test('private caches are isolated by owner and count-bounded without persistent ledgers', async () => {
  const { service, profileId, calls } = setup({ maxEntries: 1 });
  const first = await service.prepare('user-a', profileId, '2026-10-09');
  const otherId = service.confirm('user-b', knownProfile).profileId;
  await service.prepare('user-b', otherId, '2026-10-09'); assert.equal(calls.length, 2);
  assert.throws(() => service.resolveContext('user-a', first.id), /expired/);
  const fresh = service.confirm('user-a', knownProfile).profileId;
  await service.prepare('user-a', fresh, '2026-10-09'); assert.equal(calls.length, 3);
});

test('enhanced interpretations are synchronous, validated, matching, owner-bound and copy-isolated', async () => {
  const { service, profileId } = setup();
  const context = await service.prepare('user-a', profileId, '2026-10-09');
  const reading = { sunSign: { id: 'taurus', name: 'Taurus', symbol: 'T' }, greeting: 'Welcome.', summary: 'Reflection.', sections: [], affirmation: 'Stay curious.', birthChart: { contextId: context.id, title: 'Your birth chart', overview: 'Computed reflection.', sections: [{ title: 'Natal', body: 'Sun in Taurus.' }], synthesis: 'Synthesis.', reflection: 'A question.' }, meta: { readingDate: '2026-10-09', astrology: contextMetadata(context) }, audioScript: 'A matching spoken reading.' };
  assert.equal(service.getInterpretation('user-a', context.id), null);
  service.saveInterpretation('user-a', context.id, reading);
  assert.deepEqual(service.getInterpretation('user-a', context.id), reading);
  reading.birthChart.overview = 'Browser mutation';
  assert.equal(service.getInterpretation('user-a', context.id).birthChart.overview, 'Computed reflection.');
  assert.throws(() => service.getInterpretation('user-b', context.id), /expired/);
  assert.throws(() => service.saveInterpretation('user-b', context.id, reading), /expired/);
  assert.throws(() => service.saveInterpretation('user-a', context.id, { ...reading, birthChart: { ...reading.birthChart, contextId: 'f'.repeat(48) } }), /does not match/);
  assert.throws(() => service.saveInterpretation('user-a', context.id, { ...reading, summary: 7 }));
});

test('bounded Zeus functions reject extra fields and theory/Moon requests need no chart work', async () => {
  const { service, profileId, calls } = setup();
  const context = await service.prepare('user-a', profileId, '2026-10-09');
  const voice = { viewedDate: '2026-10-09', astrology: context };
  const moon = runFunction('get_moon_phase', '{"date":"2026-10-09"}', voice);
  assert.equal(moon.source, 'astronomy-engine'); assert.ok(moon.illumination >= 0 && moon.illumination <= 1); assert.equal(calls.length, 1);
  assert.throws(() => runFunction('get_transits', '{"dates":["2026-10-10"]}', voice));
  assert.throws(() => runFunction('get_natal_chart', '{"apiKey":"x"}', voice));
});

test('real installed offline worker returns verified placements, safe transparent dark/light SVGs and bounded XML', async () => {
  const service = createAstrologyService();
  const id = service.confirm('user-a', knownProfile).profileId;
  const result = await service.prepare('user-a', id, '2026-10-24', true);
  assert.equal(result.source, 'Kerykeion', result.limitations.join(' '));
  assert.equal(result.engine.version, '6.0.2'); assert.equal(result.engine.backend, 'swisseph-moshier');
  assert.equal(result.natal.at, '1990-05-01T09:15:00.000Z');
  assert.ok(Math.abs(result.natal.planets[0].longitude - 40.744546) < 0.00001);
  assert.equal(result.natal.houses.length, 12); assert.equal(result.natal.angles.length, 4);
  assert.equal(result.snapshots.length, 4); assert.equal(result.snapshots[0].at, '2026-10-24T11:00:00.000Z');
  assert.equal(result.snapshots[1].at, '2026-10-27T12:00:00.000Z');
  for (const wheel of Object.values(result.charts)) for (const svg of Object.values(wheel)) {
    assert.ok(svg.length > 10_000 && svg.length < 512_000); assert.match(svg, /<svg\b/);
    assert.match(svg, /<svg\b[^>]*\bstyle=(['"])background-color:\s*transparent\1/);
    assert.doesNotMatch(svg, /<script|<foreignObject|\bonload=/i);
  }
  assert.ok(result.chartContext.length < 32_000); assert.match(result.chartContext, /<houses system="Placidus"/);
  const estimated = service.confirm('user-a', { ...knownProfile, timeConfidence: 'estimated' }).profileId;
  const uncertain = await service.prepare('user-a', estimated, '2026-10-09', true);
  assert.equal(uncertain.source, 'Kerykeion', uncertain.limitations.join(' '));
  assert.equal(uncertain.charts, undefined); assert.deepEqual(uncertain.natal.houses, []);
  assert.doesNotMatch(uncertain.chartContext, /house=|<houses|Ascendant|Medium_Coeli/);
  for (const choice of ['earlier', 'later']) {
    const fold = service.confirm('user-a', { ...knownProfile, birthDate: '2026-10-25', birthTime: '01:30', dstChoice: choice }).profileId;
    const chart = await service.prepare('user-a', fold, '2026-10-09');
    assert.equal(chart.source, 'Kerykeion', chart.limitations.join(' '));
    assert.equal(chart.natal.at, choice === 'earlier' ? '2026-10-25T00:30:00.000Z' : '2026-10-25T01:30:00.000Z');
  }
});

const controlScript = path.resolve('tests/fixtures/kerykeion-control.py');
const python = process.env.ASTROLOGY_PYTHON || path.resolve('.venv/bin/python');
test('worker bridge bounds its queue and releases its process slot after cancellation', async () => {
  const bridge = createKerykeionBridge({ python, script: controlScript, concurrency: 1, maxQueue: 1, timeoutMs: 3000 });
  const controller = new AbortController();
  const first = bridge({ mode: 'hang' }, controller.signal);
  const second = bridge({ mode: 'ok' });
  await assert.rejects(bridge({ mode: 'ok' }), /busy/);
  await new Promise(r => setTimeout(r, 40)); controller.abort();
  await assert.rejects(first, /Aborted/); assert.deepEqual(await second, { offline: true });
});

test('worker bridge times out and rejects invalid, failed or oversized stdout without leaks', async () => {
  for (const [mode, message, options] of [['hang', /timed out/, { timeoutMs: 100 }], ['malformed', /invalid data/, {}], ['fail', /could not be calculated/, {}], ['huge', /output bound/, { maxOutputBytes: 100 }]]) {
    const bridge = createKerykeionBridge({ python, script: controlScript, timeoutMs: 2000, ...options });
    await assert.rejects(bridge({ mode }), message);
    assert.deepEqual(await bridge({ mode: 'ok' }), { offline: true });
  }
});
