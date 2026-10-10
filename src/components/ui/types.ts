import type { PlanetId } from "@/lib/zodiac";
import type { AudioAuthorization } from "@/lib/readingAudio";

export type ThemeMode = "dark" | "light";

export type PlanetInsight = {
  id: PlanetId;
  name: string;
  sign: string;
  degree: number;
  title: string;
  body: string;
  reflection: string;
};

export type ReadingPayload = {
  sunSign: { id: string; name: string; symbol: string };
  greeting: string;
  summary: string;
  sections: Array<{
    title: string;
    timeframe: string;
    body: string;
  }>;
  planetInsights?: PlanetInsight[];
  affirmation: string;
  audioScript?: string;
  audioAuthorization?: AudioAuthorization;
  birthChart?: BirthChartInterpretation;
  meta?: {
    astrology?: import("@/lib/astrologyTypes").AstrologyMetadata;
    provider?: string;
    model?: string;
    endpoint?: string;
    endpointMode?: string;
    generatedAt?: string;
    readingDate?: string;
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    profileId?: string;
  };
};

export type BirthChartInterpretation = {
  contextId: string;
  title: string;
  overview: string;
  sections: Array<{ title: string; body: string }>;
  synthesis: string;
  reflection: string;
};
