import type { AstrologyMetadata } from '@/lib/astrologyTypes';
import { chartPointLabel, publicMessage } from './chartPresentation';
export default function AstrologyStatus({ metadata }: { metadata?: AstrologyMetadata }) {
  if (!metadata) return null;
  return <details className="rounded-xl border border-[var(--panel-border)] p-3 text-xs leading-5">
    <summary className="cursor-pointer font-medium text-astral-cyan">Calculated facts · Geocentric · {metadata.confidence === 'unconfirmed' ? 'Limited sky reading' : `${metadata.confidence} birth time`}</summary>
    <p className="mt-2 opacity-70">Private chart facts, separate from AI interpretation. Snapshots at noon {metadata.targetTimezone}.</p>
    {metadata.natalSummary?.length ? <p className="mt-2">Calculated natal facts: {metadata.natalSummary.map(p => `${chartPointLabel(p.name)} in ${p.sign} ${p.degree}°`).join(' · ')}</p> : null}
    <ul className="mt-2 list-disc space-y-1 pl-4 opacity-80">{metadata.limitations.filter(item => publicMessage(item, '')).map(item => <li key={item}>{item}</li>)}</ul>
  </details>;
}
