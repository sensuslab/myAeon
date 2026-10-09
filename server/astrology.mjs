import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { anchors, dateSchema, LONDON, localInstant, validateProfile, wallParts } from './astrology-input.mjs';
import { AstrologyError, createQuotaStore, digest } from './astrology-quota.mjs';
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
  if (profile.dstChoice) value.is_dst = profile.dstChoice === 'earlier';
  return value;
}
function transitSubject(at) { return { name: 'Transit', ...wallParts(new Date(at), LONDON.timezone), ...LONDON }; }
function abort(signal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); }
export function providerConfigured() { return process.env.ASTROLOGER_ENABLED === 'true' && Boolean(process.env.ASTROLOGER_API_KEY?.trim()); }

export function createAstrologyService(options = {}) {
  const contexts = new Map(), profiles = new Map(), cache = new Map(), pending = new Map();
  const ttl = options.ttl ?? 60 * 60 * 1000, maxEntries = options.maxEntries ?? 500;
  const fetcher = (...args) => (options.fetch || globalThis.fetch)(...args);
  const quota = () => options.quota || createQuotaStore();
  const enabled = () => options.enabled ?? providerConfigured();
  function prune(map) { for (const [key, value] of map) if (value.expires <= Date.now()) map.delete(key); }
  function put(map, key, value) {
    prune(map);
    if (!map.has(key) && map.size >= maxEntries) map.delete(map.keys().next().value);
    map.set(key, { ...value, expires: Date.now() + ttl });
  }
  function owned(map, id, owner) {
    prune(map); const item = map.get(id);
    if (!item || item.owner !== owner) throw new AstrologyError('context_expired', 'Your confirmed chart context expired. Confirm your birth details again.', 410);
    return item;
  }
  async function provider(owner, route, body, validate, signal) {
    abort(signal);
    const key = digest(JSON.stringify({ owner, route, body, settings: SETTINGS }));
    prune(cache);
    if (cache.has(key)) return cache.get(key).data;
    if (pending.has(key)) return pending.get(key);
    const work = (async () => {
      await quota().reserve(owner);
      abort(signal);
      let response;
      try {
        response = await fetcher(`https://astrologer.p.rapidapi.com/api/v6${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': process.env.ASTROLOGER_API_KEY?.trim() || '', 'X-RapidAPI-Host': 'astrologer.p.rapidapi.com' },
          body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(9000)]) : AbortSignal.timeout(9000),
        });
      } catch (error) { if (signal?.aborted) throw error; throw new AstrologyError('provider_timeout', 'The chart service could not be reached. This attempt counts towards the allowance.'); }
      if (response.status !== 200) {
        const code = [401, 403].includes(response.status) ? 'provider_configuration' : response.status === 422 ? 'provider_input' : response.status === 429 ? 'provider_rate_limit' : 'provider_unavailable';
        throw new AstrologyError(code, 'Chart enrichment is unavailable. Using limited local sky facts.');
      }
      let data;
      try { const envelope = await response.json(); if (envelope.status !== 'OK') throw new Error('Invalid status'); data = validate(envelope); }
      catch (error) { if (error instanceof AstrologyError) throw error; throw new AstrologyError('invalid_provider_data', 'The chart service returned an invalid or incomplete chart.'); }
      put(cache, key, { data }); return data;
    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }
  function confirm(owner, raw) {
    const profile = validateProfile(raw);
    const key = digest(JSON.stringify({ owner, profile, settings: SETTINGS }));
    prune(profiles);
    const existing = [...profiles].find(([, item]) => item.key === key);
    if (existing) return { profileId: existing[0], confidence: profile.timeConfidence };
    const id = randomBytes(24).toString('hex'); put(profiles, id, { owner, profile, key });
    return { profileId: id, confidence: profile.timeConfidence };
  }
  function resolveProfile(owner, id) { return id ? owned(profiles, id, owner).profile : null; }
  function resolveContext(owner, id) { return id ? owned(contexts, id, owner).data : null; }
  async function prepare(owner, profileId, selectedDate, horizons = false, signal) {
    const dates = horizons ? anchors(selectedDate) : [{ label: 'Today', date: dateSchema.parse(selectedDate), at: localInstant(selectedDate, '12:00', LONDON.timezone).toISOString() }]; // Validate requested dates before reserving calls.
    const profile = resolveProfile(owner, profileId);
    const limitations = [], result = { serverOwned: Boolean(owner), id: randomBytes(24).toString('hex'), source: 'astronomy-engine', settings: SETTINGS, computedAt: new Date().toISOString(), selectedDate, profileId, targetTimezone: LONDON.timezone, confidence: profile?.timeConfidence || 'unconfirmed', natal: null, snapshots: [], limitations };
    if (!profile) limitations.push('No confirmed natal profile. No calculated natal chart, houses, Ascendant or natal aspects.');
    else if (profile.timeConfidence === 'unknown') limitations.push('Birth time is unknown. No natal Moon, houses, Ascendant or exact natal aspects are supplied; date-only Sun signs can be uncertain near a boundary.');
    else if (profile.timeConfidence === 'estimated') limitations.push('Birth time is estimated. Natal positions and aspects are approximate; houses and angles are omitted.');
    if (profile && Math.abs(profile.location.latitude) >= 66) limitations.push('Placidus is unavailable at polar latitudes. No alternative house system has been silently substituted.');
    const eligible = profile && profile.timeConfidence !== 'unknown' && Math.abs(profile.location.latitude) < 66;
    let providerFailed = false;
    if (enabled() && eligible) {
      try {
        result.natal = await provider(owner, '/chart-data/birth-chart', { subject: birthSubject(profile) }, envelope => {
          if (envelope.chart_data?.chart_type !== 'Natal') throw new Error('Expected natal');
          verifySubject(envelope.chart_data.subject, localInstant(profile.birthDate, profile.birthTime, profile.location.timezone, profile.dstChoice), profile.location);
          const subject = normalizeSubject(envelope.chart_data.subject, profile.timeConfidence === 'known');
          return { ...subject, aspects: aspectsBetween([...subject.planets, ...subject.angles]), at: localInstant(profile.birthDate, profile.birthTime, profile.location.timezone, profile.dstChoice).toISOString(), source: 'Astrologer v6' };
        }, signal);
      } catch (error) { abort(signal); limitations.push(error instanceof AstrologyError ? error.message : 'Chart enrichment is unavailable.'); providerFailed = true; }
    } else if (!enabled()) limitations.push('Hosted chart enrichment is disabled or not configured.');
    if (!result.natal) limitations.push('No verified natal chart is available. Use the date-only Sun sign as a broad theme; it can be uncertain at a sign boundary. No natal Moon, houses, Ascendant or natal aspects are supplied.');
    for (const target of horizons ? dates : dates.slice(0, 1)) {
      abort(signal);
      let snapshot;
      if (result.natal && !providerFailed) {
        try {
          snapshot = await provider(owner, '/chart-data/transit', { first_subject: birthSubject(profile), transit_subject: transitSubject(target.at) }, envelope => {
            if (envelope.chart_data?.chart_type !== 'Transit') throw new Error('Expected transit');
            verifySubject(envelope.chart_data.first_subject, result.natal.at, profile.location);
            verifySubject(envelope.chart_data.second_subject, target.at, LONDON);
            const subject = normalizeSubject(envelope.chart_data.second_subject, false);
            // Response second_subject is the transit ring, unlike the request transit_subject.
            return { ...subject, aspects: aspectsBetween(subject.planets), natalAspects: aspectsBetween([...result.natal.planets, ...result.natal.angles], subject.planets, true), source: 'Astrologer v6' };
          }, signal);
        } catch (error) { abort(signal); limitations.push(error instanceof AstrologyError ? error.message : 'Transit enrichment is unavailable.'); providerFailed = true; }
      }
      if (!snapshot) snapshot = { ...skyAt(new Date(target.at)), source: 'astronomy-engine', natalAspects: [] };
      result.snapshots.push({ ...snapshot, ...target, moon: moonAt(new Date(target.at)) });
    }
    result.source = result.snapshots.every(s => s.source === 'Astrologer v6') ? 'Astrologer v6' : result.natal ? 'mixed' : 'astronomy-engine';
    limitations.push('Dated anchors at 12:00 Europe/London are snapshots, not exact event times. The 3D scene is heliocentric; chart facts are geocentric.');
    result.limitations = [...new Set(limitations)];
    try { result.usage = owner ? await quota().usage(owner) : null; } catch { result.usage = null; }
    if (owner) put(contexts, result.id, { owner, data: result });
    return result;
  }
  return { confirm, resolveProfile, resolveContext, prepare, usage: owner => quota().usage(owner), enabled };
}
// Next's route bundle and the custom voice server share the same process store.
const key = Symbol.for('myAeon.astrology.v6');
export const astrology = globalThis[key] ||= createAstrologyService();
export function contextMetadata(context) { return { contextId: context.serverOwned ? context.id : undefined, source: context.source, frame: context.settings.frame, confidence: context.confidence, natalSummary: context.natal ? [...context.natal.planets.filter(p => ['Sun', 'Moon'].includes(p.name)), ...context.natal.angles.filter(p => ['Ascendant', 'Medium_Coeli'].includes(p.name))] : [], computedAt: context.computedAt, targetTimezone: context.targetTimezone, limitations: context.limitations, usage: context.usage }; }
