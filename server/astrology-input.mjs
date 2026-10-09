import { z } from 'zod';

export const LONDON = Object.freeze({ city: 'London', nation: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' });
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2100-12-31';
}, 'Use a valid date from 1900 to 2100.');
export const locationSchema = z.object({
  city: z.string().trim().min(1).max(100), nation: z.string().regex(/^[A-Z]{2}$/),
  latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
  timezone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return value === 'UTC' || value.includes('/'); } catch { return false; } }, 'Use an IANA timezone, such as Europe/London.'),
}).strict();
export const profileSchema = z.object({
  birthDate: dateSchema, birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timeConfidence: z.enum(['known', 'estimated', 'unknown']).default('unknown'),
  location: locationSchema.default(LONDON), confirmed: z.literal(true), providerConsent: z.literal(true),
  dstChoice: z.enum(['earlier', 'later']).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.timeConfidence !== 'unknown' && !value.birthTime) ctx.addIssue({ code: 'custom', path: ['birthTime'], message: 'Enter the recorded local birth time or choose Unknown.' });
});
export function wallParts(instant, timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
// Compare local wall-clock values against the runtime's historical IANA rules.
// An overlap requires an explicit occurrence choice; a gap is always rejected.
export function localInstant(date, time, timezone, choice) {
  const [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set();
  for (let delta = -36; delta <= 36; delta += 6) {
    const probe = new Date(wall + delta * 3600000), p = wallParts(probe, timezone);
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - +probe);
  }
  const candidates = [...offsets].map(offset => new Date(wall - offset)).filter(d => {
    const p = wallParts(d, timezone);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
  }).sort((a, b) => +a - +b);
  if (!candidates.length) throw new Error('That local time did not exist during a clock change. Check the recorded time.');
  if (candidates.length > 1 && !choice) throw new Error('That local time occurred twice during a clock change. Choose the earlier or later occurrence.');
  return candidates[choice === 'later' ? candidates.length - 1 : 0];
}
export function validateProfile(raw) {
  const profile = profileSchema.parse(raw);
  if (profile.timeConfidence !== 'unknown') localInstant(profile.birthDate, profile.birthTime, profile.location.timezone, profile.dstChoice);
  return profile;
}
export function anchors(date, timezone = LONDON.timezone) {
  dateSchema.parse(date);
  return [0, 3, 7, 30].map((days, index) => {
    const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
    const target = dateSchema.parse(d.toISOString().slice(0, 10));
    return { label: ['Today', '3 Days', 'Week', 'Month'][index], date: target, at: localInstant(target, '12:00', timezone).toISOString() };
  });
}
