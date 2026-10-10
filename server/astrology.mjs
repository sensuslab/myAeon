import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { anchors, dateSchema, LONDON, localInstant, validateProfile, wallParts } from './astrology-input.mjs';
import { AstrologyError, digest } from './astrology-quota.mjs';
import { calculateCharts, ENGINE_BACKEND, KERYKEION_VERSION } from './kerykeion-bridge.mjs';
import { skyAt, moonAt } from './sky.mjs';

export const SETTINGS = Object.freeze({ zodiac: 'Tropical', frame: 'Apparent Geocentric', houses: 'Placidus', apiVersion: 'v6' });
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ANGLES = ['Ascendant', 'Medium_Coeli', 'Descendant', 'Imum_Coeli'];
const HOUSES = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const pointSchema = z.object({ abs_pos: z.number().finite().min(0).lt(360), retrograde: z.boolean().nullable().optional(), house: z.string().max(40).nullable().optional() });
export function normalizeSubject(raw, includeAngles = true) {
  if (!raw || raw.zodiac_type !== 'Tropical' || raw.perspective_type !== 'Apparent Geocentric' || raw.houses_system_identifier !== 'P' || raw.polar_house_fallbacks?.length) throw new AstrologyError('invalid_provider_data', 'The chart service returned incompatible calculation settings.');
  const mapPoint = name => {
    const p = pointSchema.parse(raw[name.toLowerCase()]);
    return { name, longitude: p.abs_pos, sign: SIGNS[Math.floor(p.abs_pos / 30)], degree: +(p.abs_pos % 30).toFixed(3), ...(typeof p.retrograde === 'boolean' ? { retrograde: p.retrograde } : {}), ...(includeAngles && HOUSES.some(h => `${h}_house` === p.house?.toLowerCase()) ? { house: p.house } : {}) };
  };
  const planets = PLANETS.filter(name => raw[name.toLowerCase()] != null).map(mapPoint);
  if (!PLANETS.slice(0, 9).every(name => planets.some(p => p.name === name))) throw new AstrologyError('invalid_provider_data', 'The chart service returned incomplete planetary data.');
  const angles = includeAngles ? ANGLES.filter(name => raw[name.toLowerCase()] != null).map(mapPoint) : [];
  const houses = includeAngles ? HOUSES.filter(name => raw[`${name}_house`] != null).map((name) => ({ number: HOUSES.indexOf(name) + 1, ...mapPoint(`${name}_house`) })) : [];
  if (includeAngles && (houses.length !== 12 || !['Ascendant', 'Medium_Coeli'].every(name => angles.some(p => p.name === name)))) throw new AstrologyError('invalid_provider_data', 'The chart service returned incomplete houses or angles.');
  return { planets, angles, houses };
}
function verifySubject(raw, expectedAt, location) {
  const at = new Date(raw?.iso_formatted_utc_datetime);
  if (!Number.isFinite(+at) || Math.abs(+at - +new Date(expectedAt)) > 1000 || raw.tz_str !== location.timezone || typeof raw.lat !== 'number' || typeof raw.lng !== 'number' || Math.abs(raw.lat - location.latitude) > 0.0001 || Math.abs(raw.lng - location.longitude) > 0.0001) throw new AstrologyError('invalid_provider_data', 'The chart service returned a different time or location than requested.');
}
export function aspectsBetween(first, second = first, dual = false) {
  const result = [];
  for (let i = 0; i < first.length; i++) for (let j = dual ? 0 : i + 1; j < second.length; j++) {
    const separation = Math.abs(((first[i].longitude - second[j].longitude + 540) % 360) - 180);
    for (const [angle, aspect] of [[0, 'conjunction'], [60, 'sextile'], [90, 'square'], [120, 'trine'], [180, 'opposition']]) {
      const orb = Math.abs(separation - angle);
      if (orb <= 6) result.push({ [dual ? 'natal' : 'first']: first[i].name, [dual ? 'transit' : 'second']: second[j].name, aspect, orb: +orb.toFixed(3), source: 'computed from validated longitudes' });
    }
  }
  return result.sort((a, b) => a.orb - b.orb);
}
function birthSubject(profile) {
  const [year, month, day] = profile.birthDate.split('-').map(Number), [hour, minute] = profile.birthTime.split(':').map(Number);
  const value = { name: 'myAeon profile', year, month, day, hour, minute, ...profile.location, zodiac_type: SETTINGS.zodiac, perspective_type: SETTINGS.frame, houses_system_identifier: 'P' };
  // The validated instant is authoritative, including non-DST clock overlaps.
  value.at = localInstant(profile.birthDate, profile.birthTime, profile.location.timezone, profile.dstChoice).toISOString();
  if (profile.dstChoice) value.is_dst = profile.dstChoice === 'earlier';
  return value;
}
function transitSubject(at) { return { name: 'Transit', at, ...wallParts(new Date(at), LONDON.timezone), ...LONDON }; }
function abort(signal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); }
export function providerConfigured() { return process.env.ASTROLOGY_ENABLED !== 'false'; }

const engineSchema = z.object({ name: z.literal('Kerykeion'), version: z.literal(KERYKEION_VERSION), backend: z.literal(ENGINE_BACKEND) }).strict();
const svgSchema = z.string().min(100).max(512_000).refine(value => /<svg\b/.test(value) && !/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|javascript:)/i.test(value), 'Unsafe chart SVG');
const chartsSchema = z.object({ natal: z.object({ dark: svgSchema, light: svgSchema }).strict(), transit: z.object({ dark: svgSchema, light: svgSchema }).strict() }).strict();
const readingSchema = z.object({
  sunSign: z.object({ id: z.string().max(30), name: z.string().max(30), symbol: z.string().max(10) }),
  greeting: z.string().max(200), summary: z.string().max(1200), affirmation: z.string().max(500),
  sections: z.array(z.object({ title: z.string().max(100), timeframe: z.string().max(40), body: z.string().max(2000) })).max(16),
  birthChart: z.object({ contextId: z.string().regex(/^[a-f0-9]{48}$/), title: z.string().max(160), overview: z.string().max(3000), sections: z.array(z.object({ title: z.string().max(160), body: z.string().max(4000) })).max(12), synthesis: z.string().max(4000), reflection: z.string().max(1000) }),
}).passthrough();

export function createAstrologyService(options = {}) {
  const contexts = new Map(), profiles = new Map(), cache = new Map(), pending = new Map();
  const ttl = options.ttl ?? 60 * 60 * 1000, maxEntries = options.maxEntries ?? 64, maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  const worker = options.worker || calculateCharts;
  const enabled = () => options.enabled ?? providerConfigured();
  function prune(map) { for (const [key, value] of map) if (value.expires <= Date.now()) map.delete(key); }
  function put(map, key, value) {
    prune(map);
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (bytes > maxBytes) throw new AstrologyError('context_size', 'The chart context exceeds its memory bound.');
    map.delete(key);
    let total = [...map.values()].reduce((sum, item) => sum + item.bytes, 0);
    while (map.size && (map.size >= maxEntries || total + bytes > maxBytes)) {
      const oldest = map.keys().next().value; total -= map.get(oldest).bytes; map.delete(oldest);
    }
    map.set(key, { ...value, bytes, expires: Date.now() + ttl });
  }
  function owned(map, id, owner) {
    prune(map); const item = map.get(id);
    if (!owner || !item || item.owner !== owner) throw new AstrologyError('context_expired', 'Your confirmed chart context expired. Confirm your birth details again.', 410);
    return item;
  }
  async function localChart(owner, job, validate, signal) {
    abort(signal);
    const key = digest(JSON.stringify({ owner, job, settings: SETTINGS, version: KERYKEION_VERSION, backend: ENGINE_BACKEND }));
    prune(cache);
    if (cache.has(key)) return cache.get(key).data;
    let entry = pending.get(key);
    if (!entry) {
      if (pending.size >= 32) throw new AstrologyError('engine_busy', 'The local chart runtime is busy. Try again shortly.');
      entry = { controller: new AbortController(), waiters: 0, settled: false };
      entry.promise = Promise.resolve().then(() => worker(job, entry.controller.signal)).then(raw => {
        abort(entry.controller.signal);
        let data;
        try { data = validate(raw); }
        catch (error) { if (error instanceof AstrologyError) throw error; throw new AstrologyError('invalid_provider_data', 'The local chart returned invalid or incomplete data.'); }
        put(cache, key, { data }); return data;
      }).finally(() => { entry.settled = true; if (pending.get(key) === entry) pending.delete(key); });
      pending.set(key, entry);
    }
    entry.waiters++;
    let cancel;
    const cancelled = signal && new Promise((_, reject) => { cancel = () => reject(new DOMException('Aborted', 'AbortError')); signal.addEventListener('abort', cancel, { once: true }); });
    try { return await (cancelled ? Promise.race([entry.promise, cancelled]) : entry.promise); }
    finally {
      if (cancel) signal.removeEventListener('abort', cancel);
      if (--entry.waiters === 0 && !entry.settled) { entry.controller.abort(); pending.delete(key); }
    }
  }
  function confirm(owner, raw) {
    if (!owner) throw new AstrologyError('identity_required', 'Confirm your chart with a private session.', 400);
    const profile = validateProfile(raw);
    const key = digest(JSON.stringify({ owner, profile, settings: SETTINGS }));
    prune(profiles);
    const existing = [...profiles].find(([, item]) => item.key === key);
    if (existing) return { profileId: existing[0], confidence: profile.timeConfidence };
    const id = randomBytes(24).toString('hex'); put(profiles, id, { owner, profile, key });
    return { profileId: id, confidence: profile.timeConfidence };
  }
  function resolveProfile(owner, id) { return id ? structuredClone(owned(profiles, id, owner).profile) : null; }
  function resolveContext(owner, id) { return id ? structuredClone(owned(contexts, id, owner).data) : null; }
  function saveInterpretation(owner, contextId, reading) {
    const item = owned(contexts, contextId, owner);
    if (Buffer.byteLength(JSON.stringify(reading)) > 160_000) throw new AstrologyError('interpretation_size', 'The interpretation is too large.', 400);
    const validated = readingSchema.parse(reading);
    if (validated.birthChart.contextId !== contextId || (validated.meta?.astrology?.contextId && validated.meta.astrology.contextId !== contextId) || (validated.meta?.readingDate && validated.meta.readingDate !== item.data.selectedDate)) throw new AstrologyError('interpretation_context', 'The interpretation does not match this chart.', 400);
    put(contexts, contextId, { owner, data: item.data, reading: structuredClone(validated) });
    return structuredClone(validated);
  }
  function getInterpretation(owner, contextId) { return structuredClone(owned(contexts, contextId, owner).reading || null); }
  async function prepare(owner, profileId, selectedDate, horizons = false, signal) {
    abort(signal);
    const dates = horizons ? anchors(selectedDate) : [{ label: 'Today', date: dateSchema.parse(selectedDate), at: localInstant(selectedDate, '12:00', LONDON.timezone).toISOString() }];
    const profile = resolveProfile(owner, profileId);
    const limitations = [], result = { serverOwned: Boolean(owner), id: randomBytes(24).toString('hex'), source: 'astronomy-engine', settings: SETTINGS, computedAt: new Date().toISOString(), selectedDate, profileId, targetTimezone: LONDON.timezone, confidence: profile?.timeConfidence || 'unconfirmed', natal: null, snapshots: [], limitations };
    if (!profile) limitations.push('No confirmed natal profile. No calculated natal chart, houses, Ascendant or natal aspects.');
    else if (profile.timeConfidence === 'unknown') limitations.push('Birth time is unknown. No natal Moon, houses, Ascendant or exact natal aspects are supplied; date-only Sun signs can be uncertain near a boundary.');
    else if (profile.timeConfidence === 'estimated') limitations.push('Birth time is estimated. Natal positions and aspects are approximate; houses and angles are omitted.');
    if (profile && Math.abs(profile.location.latitude) >= 66) limitations.push('Placidus is unavailable at polar latitudes. No alternative house system has been silently substituted.');
    const eligible = profile && profile.timeConfidence !== 'unknown' && Math.abs(profile.location.latitude) < 66;
    let calculated;
    if (enabled() && eligible) {
      try {
        const natalRequest = birthSubject(profile);
        calculated = await localChart(owner, { subject: natalRequest, confidence: profile.timeConfidence, targets: dates.map(target => transitSubject(target.at)) }, raw => {
          const engine = engineSchema.parse(raw.engine);
          verifySubject(raw.natal, natalRequest.at, profile.location);
          const natal = normalizeSubject(raw.natal, profile.timeConfidence === 'known');
          if (!Array.isArray(raw.snapshots) || raw.snapshots.length !== dates.length) throw new Error('Incorrect anchor count');
          const snapshots = raw.snapshots.map((subject, index) => { verifySubject(subject, dates[index].at, LONDON); return normalizeSubject(subject, false); });
          const chartContext = z.string().min(1).max(32_000).parse(raw.chartContext);
          if (!chartContext.startsWith('<astrology_context') || !chartContext.endsWith('</astrology_context>') || /<!DOCTYPE|<!ENTITY/i.test(chartContext)) throw new Error('Invalid semantic context');
          const charts = profile.timeConfidence === 'known' ? chartsSchema.parse(raw.charts) : undefined;
          if (profile.timeConfidence !== 'known' && (raw.charts || /\bhouse\s*=|<(?:houses?|angles?)\b|Ascendant|Medium_Coeli|Descendant|Imum_Coeli/i.test(chartContext))) throw new Error('Uncertain house data');
          return { natal, snapshots, charts, chartContext, engine };
        }, signal);
        result.engine = structuredClone(calculated.engine); result.chartContext = calculated.chartContext;
        if (calculated.charts) result.charts = structuredClone(calculated.charts);
        result.natal = { ...structuredClone(calculated.natal), aspects: aspectsBetween([...calculated.natal.planets, ...calculated.natal.angles]), at: natalRequest.at, source: 'Kerykeion' };
        limitations.push('Planetary positions use the offline Moshier analytical ephemeris, not JPL file-backed ephemerides.');
        if (profile.timeConfidence === 'estimated') limitations.push('Chart wheels are omitted because an estimated birth time cannot support reliable houses or angles.');
      } catch (error) { abort(signal); limitations.push(error instanceof AstrologyError ? error.message : 'The local chart calculation is unavailable.'); }
    } else if (!enabled()) limitations.push('Local chart calculation is disabled.');
    if (!result.natal) limitations.push('No verified natal chart is available. Use the date-only Sun sign as a broad theme; it can be uncertain at a sign boundary. No natal Moon, houses, Ascendant or natal aspects are supplied.');
    for (const [index, target] of dates.entries()) {
      abort(signal);
      let snapshot;
      if (result.natal && calculated) {
        const subject = structuredClone(calculated.snapshots[index]);
        snapshot = { ...subject, aspects: aspectsBetween(subject.planets), natalAspects: aspectsBetween([...result.natal.planets, ...result.natal.angles], subject.planets, true), source: 'Kerykeion' };
      }
      if (!snapshot) snapshot = { ...skyAt(new Date(target.at)), source: 'astronomy-engine', natalAspects: [] };
      result.snapshots.push({ ...snapshot, ...target, moon: moonAt(new Date(target.at)) });
    }
    result.source = result.natal ? 'Kerykeion' : 'astronomy-engine';
    limitations.push('Dated anchors at 12:00 Europe/London are snapshots, not exact event times. The 3D scene is heliocentric; chart facts are geocentric.');
    result.limitations = [...new Set(limitations)];
    result.usage = null;
    if (owner) put(contexts, result.id, { owner, data: structuredClone(result) });
    return result;
  }
  return { confirm, resolveProfile, resolveContext, prepare, saveInterpretation, getInterpretation, usage: async () => null, enabled };
}
// Next's route bundle and the custom voice server share the same process store.
const key = Symbol.for('myAeon.astrology.local.v6');
export const astrology = globalThis[key] ||= createAstrologyService();
export function contextMetadata(context) { return { contextId: context.serverOwned ? context.id : undefined, source: context.source, frame: context.settings.frame, confidence: context.confidence, natalSummary: context.natal ? [...context.natal.planets.filter(p => ['Sun', 'Moon'].includes(p.name)), ...context.natal.angles.filter(p => ['Ascendant', 'Medium_Coeli'].includes(p.name))] : [], computedAt: context.computedAt, targetTimezone: context.targetTimezone, limitations: context.limitations, usage: null, ...(context.engine ? { engine: context.engine } : {}) }; }
