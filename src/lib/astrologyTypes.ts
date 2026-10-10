export type ChartLocation = { city: string; nation: string; latitude: number; longitude: number; timezone: string };
export type BirthProfile = { birthDate: string; birthTime?: string; timeConfidence: 'known' | 'estimated' | 'unknown'; location: ChartLocation; confirmed: true; providerConsent: true; dstChoice?: 'earlier' | 'later' };
export type AstrologyUsage = { limit: number; used: number; remaining: number; period: string };
export type ChartPoint = { name: string; longitude: number; sign: string; degree: number; retrograde?: boolean; house?: string };
export type ChartAspect = { natal?: string; transit?: string; first?: string; second?: string; aspect: string; orb: number; source?: string };
export type AstrologyCharts = { natal: { dark: string; light: string }; transit: { dark: string; light: string } };
export type AstrologyEngine = { name: string; version: string; backend: string };
export type AstrologyContext = {
  id: string; profileId?: string; serverOwned?: boolean; source: string; settings: { zodiac: string; frame: string; houses: string; apiVersion: string }; computedAt: string;
  selectedDate: string; targetTimezone: string; confidence: string; limitations: string[]; usage: AstrologyUsage | null;
  charts?: AstrologyCharts; chartContext?: string; engine?: AstrologyEngine;
  natal: { planets: ChartPoint[]; angles: ChartPoint[]; houses: Array<ChartPoint & { number: number }>; aspects: ChartAspect[]; at: string; source: string } | null;
  snapshots: Array<{ label: string; date: string; at: string; source: string; planets: ChartPoint[]; aspects: unknown[]; natalAspects: ChartAspect[]; moon: { at: string; source: string; angle: number; illumination: number; phaseName: string } }>;
};
export type AstrologyMetadata = Pick<AstrologyContext, 'source' | 'confidence' | 'computedAt' | 'targetTimezone' | 'limitations' | 'usage' | 'engine'> & { contextId?: string; frame: string; natalSummary?: ChartPoint[] };
