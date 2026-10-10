import type { AstrologyContext } from "@/lib/astrologyTypes";
import type { BirthChartInterpretation, ReadingPayload } from "./types";

export type ChartContext = AstrologyContext;
export type ChartReading = BirthChartInterpretation;
export type ReadingWithChart = ReadingPayload;

export type ChartEnhancementProps = {
  onEnhanceChart?: () => void;
  chartAvailable?: boolean;
  chartLoading?: boolean;
  enhancingChart?: boolean;
  enhancementError?: string | null;
  chartConfidence?: "known" | "estimated" | "unknown";
};

export function chartPointLabel(name: string): string {
  const angles: Record<string, string> = { Medium_Coeli: "Midheaven", Imum_Coeli: "IC" };
  return angles[name] ?? name.replaceAll("_", " ");
}

export function chartHouseLabel(house: string): string {
  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
  const name = house.trim().replace(/[_\s]+/g, " ").replace(/^house\s+|\s+house$/gi, "").toLowerCase();
  const number = /^\d{1,2}$/.test(name) ? Number(name) : ordinals.indexOf(name) + 1;
  return number >= 1 && number <= 12 ? `House ${number}` : house.replaceAll("_", " ");
}

export function publicMessage(value: unknown, fallback: string): string {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  return !message || /deepgram|deepseek|astrologer|quota|allowance|api.?key|api calls|upstream|configured/i.test(message)
    ? fallback : message;
}
