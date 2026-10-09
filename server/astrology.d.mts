import type { AstrologyContext, AstrologyMetadata, AstrologyUsage, BirthProfile } from '../src/lib/astrologyTypes';
export const astrology: {
  confirm(owner: string, raw: unknown): { profileId: string; confidence: string };
  resolveProfile(owner: string, id?: string): BirthProfile | null;
  resolveContext(owner: string, id?: string): AstrologyContext | null;
  prepare(owner: string | null, profileId: string | undefined, date: string, horizons?: boolean, signal?: AbortSignal): Promise<AstrologyContext>;
  usage(owner: string): Promise<AstrologyUsage>;
  enabled(): boolean;
};
export function providerConfigured(): boolean;
export function contextMetadata(context: AstrologyContext): AstrologyMetadata;
