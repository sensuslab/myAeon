// Synthetic offline worker data; no real person's birth information.
import { localInstant } from '../../server/astrology-input.mjs';
export const knownProfile = { birthDate: '1990-05-01', birthTime: '10:15', timeConfidence: 'known', location: { city: 'London', nation: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' }, confirmed: true, providerConsent: true };
export function subjectFixture(subject, shift = 0) {
  const { year, month, day, hour, minute } = subject;
  const pad = x => String(x).padStart(2, '0');
  const at = subject.at ? new Date(subject.at) : localInstant(`${year}-${pad(month)}-${pad(day)}`, `${pad(hour)}:${pad(minute)}`, subject.timezone, subject.is_dst === undefined ? undefined : subject.is_dst ? 'earlier' : 'later');
  const result = { zodiac_type: 'Tropical', perspective_type: 'Apparent Geocentric', houses_system_identifier: 'P', iso_formatted_utc_datetime: at.toISOString(), tz_str: subject.timezone, lat: subject.latitude, lng: subject.longitude };
  for (const [i, name] of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ascendant', 'medium_coeli', 'descendant', 'imum_coeli'].entries()) result[name] = { abs_pos: (40 + i * 30 + shift) % 360, ...(name === 'mercury' ? { retrograde: true } : {}), house: 'First_House' };
  for (const [i, name] of ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'].entries()) result[`${name}_house`] = { abs_pos: (50 + i * 30) % 360 };
  return result;
}
export function localWorkerFixture(job) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="white" stroke="black"/></svg>';
  return {
    natal: subjectFixture(job.subject), snapshots: job.targets.map((subject, i) => subjectFixture(subject, 2 + i)),
    engine: { name: 'Kerykeion', version: '6.0.2', backend: 'swisseph-moshier' },
    chartContext: '<astrology_context><natal><point name="Sun" abs_pos="40"/></natal></astrology_context>',
    ...(job.confidence === 'known' ? { charts: { natal: { dark: svg, light: svg }, transit: { dark: svg, light: svg } } } : {}),
  };
}
