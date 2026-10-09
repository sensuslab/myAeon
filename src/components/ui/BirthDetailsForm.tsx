"use client";
import { getSunSign, type ZodiacSign } from '@/lib/zodiac';
import type { AstrologyUsage, BirthProfile, ChartLocation } from '@/lib/astrologyTypes';

export type BirthInput = {
  name: string; birthDate: string; birthTime: string; timeConfidence: 'known' | 'estimated' | 'unknown';
  birthPlace: string; location: ChartLocation; readingDate: string; confirmed: boolean; dstChoice?: 'earlier' | 'later';
};
export function londonToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function initialBirthInput(): BirthInput {
  return { name: '', birthDate: '', birthTime: '', timeConfidence: 'unknown', birthPlace: 'London, UK', location: { city: 'London', nation: 'GB', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' }, readingDate: londonToday(), confirmed: false };
}
export function birthProfile(input: BirthInput): BirthProfile {
  return { birthDate: input.birthDate, ...(input.timeConfidence !== 'unknown' ? { birthTime: input.birthTime } : {}), timeConfidence: input.timeConfidence, location: input.location, confirmed: true, providerConsent: true, ...(input.dstChoice ? { dstChoice: input.dstChoice } : {}) };
}
export function profileFingerprint(input: BirthInput) { return JSON.stringify({ ...birthProfile(input), confirmed: input.confirmed }); }
export type BirthFormProps = {
  input: BirthInput; onChange: (input: BirthInput) => void; onSubmit: (input: BirthInput, sunSign: ZodiacSign) => void;
  onConfirm: (input: BirthInput) => void; loading: boolean; confirming: boolean; profileConfirmed: boolean;
  status: string | null; usage: AstrologyUsage | null; enrichmentEnabled: boolean;
};
export default function BirthDetailsForm({ input, onChange, onSubmit, onConfirm, loading, confirming, profileConfirmed, status, usage, enrichmentEnabled }: BirthFormProps) {
  const update = (patch: Partial<BirthInput>) => onChange({ ...input, ...patch });
  const location = (patch: Partial<ChartLocation>) => update({ location: { ...input.location, ...patch } });
  const london = input.location.city === 'London' && input.location.nation === 'GB' && input.location.latitude === 51.5074 && input.location.longitude === -0.1278 && input.location.timezone === 'Europe/London';
  const busy = loading || confirming;
  return <form className="space-y-3 text-[var(--app-text)]" onSubmit={event => { event.preventDefault(); if (input.birthDate) onSubmit(input, getSunSign(new Date(`${input.birthDate}T12:00:00Z`))); }}>
    <Field label="Name (optional)"><input className="birth-input" maxLength={80} value={input.name} onChange={e => update({ name: e.target.value })} placeholder="Your name" /></Field>
    <Field label="Birth date"><input className="birth-input" type="date" min="1900-01-01" max="2100-12-31" required value={input.birthDate} onChange={e => update({ birthDate: e.target.value })} /></Field>
    <Field label="How certain is your birth time?"><select className="birth-input" value={input.timeConfidence} onChange={e => update({ timeConfidence: e.target.value as BirthInput['timeConfidence'] })}><option value="unknown">Unknown</option><option value="known">Known / recorded</option><option value="estimated">Estimated</option></select></Field>
    {input.timeConfidence !== 'unknown' && <>
      <Field label="Recorded local birth time"><input className="birth-input" type="time" required value={input.birthTime} onChange={e => update({ birthTime: e.target.value })} /></Field>
      <details className="text-xs"><summary className="min-h-8 cursor-pointer opacity-70">Born during a clock change?</summary><Field label="If the recorded time occurred twice"><select className="birth-input" value={input.dstChoice || ''} onChange={e => update({ dstChoice: (e.target.value || undefined) as BirthInput['dstChoice'] })}><option value="">Detect automatically</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select></Field></details>
    </>}
    <Field label="Birthplace"><select className="birth-input" value={london ? 'london' : 'custom'} onChange={e => e.target.value === 'london' ? update({ location: initialBirthInput().location, birthPlace: 'London, UK' }) : update({ location: { ...input.location, city: '' }, birthPlace: '' })}><option value="london">London, UK</option><option value="custom">Another location</option></select></Field>
    {!london && <div className="space-y-3 rounded-lg border border-[var(--panel-border)] p-3">
      <p className="text-xs leading-5 opacity-70">Use the exact birthplace coordinates and its historical IANA timezone. A city name alone does not resolve a location.</p>
      <Field label="City"><input className="birth-input" required maxLength={100} value={input.location.city} onChange={e => { location({ city: e.target.value }); }} /></Field>
      <Field label="Country code"><input className="birth-input" required pattern="[A-Z]{2}" maxLength={2} placeholder="GB" value={input.location.nation} onChange={e => location({ nation: e.target.value.toUpperCase() })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Latitude"><input className="birth-input" type="number" min={-90} max={90} step="any" required value={Number.isFinite(input.location.latitude) ? input.location.latitude : ''} onChange={e => location({ latitude: e.target.value === '' ? NaN : Number(e.target.value) })} /></Field>
        <Field label="Longitude"><input className="birth-input" type="number" min={-180} max={180} step="any" required value={Number.isFinite(input.location.longitude) ? input.location.longitude : ''} onChange={e => location({ longitude: e.target.value === '' ? NaN : Number(e.target.value) })} /></Field>
      </div>
      <Field label="IANA birth timezone"><input className="birth-input" required maxLength={80} placeholder="Europe/London" value={input.location.timezone} onChange={e => location({ timezone: e.target.value })} /></Field>
    </div>}
    <p className="text-xs leading-5 opacity-70">Sky snapshots use London, UK · Europe/London. {input.timeConfidence === 'unknown' ? 'Unknown birth time gives a limited reading without natal Moon, Ascendant, houses or exact natal aspects.' : input.timeConfidence === 'estimated' ? 'Estimated birth time gives approximate placements without houses or angles.' : 'Confirmed local time enables a calculated natal chart when enrichment is available.'}</p>
    <Field label="Sky date"><input className="birth-input" type="date" min="1900-01-01" max="2100-12-01" required value={input.readingDate} onChange={e => update({ readingDate: e.target.value })} /></Field>
    <label className="flex items-start gap-3 rounded-lg border border-[var(--panel-border)] p-3 text-xs leading-5"><input className="mt-1 h-4 w-4 shrink-0 accent-[#d4a437]" type="checkbox" checked={input.confirmed} onChange={e => update({ confirmed: e.target.checked })} /><span>I confirm these birth details and allow Astrologer to process them for chart calculations. Zeus may discuss the resulting facts through Deepgram and its model provider.</span></label>
    {usage && <p className="text-xs leading-5 text-astral-cyan" aria-live="polite">{usage.remaining} of 5 chart API calls remaining · total allowance. Cached results are free. A full new reading uses up to 5 calls.</p>}
    {!enrichmentEnabled && <p className="text-xs leading-5 opacity-70">Hosted chart enrichment is unavailable. Local sky exploration and limited readings remain available.</p>}
    <button type="button" disabled={busy || !input.confirmed || !input.birthDate || (input.timeConfidence !== 'unknown' && !input.birthTime)} onClick={event => { if (event.currentTarget.form?.reportValidity()) onConfirm(input); }} className="min-h-11 w-full rounded-lg border border-[var(--panel-border)] px-3 text-sm disabled:opacity-40">{confirming ? 'Confirming…' : profileConfirmed ? 'Birth details confirmed for Zeus' : 'Confirm birth details for Zeus'}</button>
    {status && <p role="status" className="text-xs leading-5 text-astral-cyan">{status}</p>}
    <button type="submit" disabled={busy || !input.birthDate} className="min-h-12 w-full rounded-lg bg-gradient-to-r from-astral-gold to-astral-bronze px-3 text-sm font-semibold text-astral-deep disabled:opacity-40">{loading ? 'Reading the stars…' : 'Cast my reading'}</button>
    <style jsx>{`.birth-input { width:100%; min-height:44px; background:var(--field-bg); border:1px solid var(--field-border); color:var(--field-text); padding:0.5rem 0.65rem; border-radius:0.5rem; font-size:0.9rem; } .birth-input:focus { outline:2px solid var(--astral-gold); outline-offset:2px; }`}</style>
  </form>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-xs opacity-70">{label}</span>{children}</label>; }
