import type { AstrologyContext, AstrologyMetadata, BirthProfile } from '../src/lib/astrologyTypes';
import type { ReadingPayload } from '../src/components/ui/types';
export const SETTINGS: Readonly<{ zodiac: string; frame: string; houses: string; apiVersion: string }>;
export type AstrologyService = {
  confirm(owner: string, raw: unknown): { profileId: string; confidence: string };
  resolveProfile(owner: string, id?: string): BirthProfile | null;
  resolveContext(owner: string, id?: string): AstrologyContext | null;
  prepare(owner: string | null, profileId: string | undefined, date: string, horizons?: boolean, signal?: AbortSignal): Promise<AstrologyContext>;
  saveInterpretation(owner: string, contextId: string, reading: ReadingPayload): ReadingPayload;
  getInterpretation(owner: string, contextId: string): ReadingPayload | null;
  usage(owner?: string): Promise<null>;
  enabled(): boolean;
};
export const astrology: AstrologyService;
export function createAstrologyService(options?: Record<string, unknown>): AstrologyService;
export function normalizeSubject(raw: unknown, includeAngles?: boolean): Pick<NonNullable<AstrologyContext['natal']>, 'planets' | 'angles' | 'houses'>;
export function aspectsBetween(first: Array<{ name: string; longitude: number }>, second?: Array<{ name: string; longitude: number }>, dual?: boolean): NonNullable<AstrologyContext['natal']>['aspects'];
export function providerConfigured(): boolean;
export function contextMetadata(context: AstrologyContext): AstrologyMetadata;
