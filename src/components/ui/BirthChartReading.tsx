"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import type { ChartEnhancementProps, ReadingWithChart } from "./chartPresentation";
import type { ReadingPayload } from "./types";

export default function BirthChartReading({ reading, onEnhanceChart, chartAvailable, chartLoading, enhancingChart, enhancementError, chartConfidence }: ChartEnhancementProps & { reading: ReadingPayload }) {
  const birthChart = (reading as ReadingWithChart).birthChart;
  const estimated = chartConfidence === "estimated" || reading.meta?.astrology?.confidence === "estimated";
  if (birthChart) return (
    <section aria-label="Birth chart interpretation" className="space-y-3 border-y border-[var(--panel-border)] py-4 text-[var(--app-text)]">
      <p className="text-xs font-medium text-astral-cyan">AI interpretation / Birth chart</p>
      {estimated && <p className="text-xs leading-5 text-astral-gold">Estimated birth time: placements and interpretation are approximate. Houses, angles and a full wheel are unavailable.</p>}
      <h2 className="text-base font-medium">{birthChart.title}</h2>
      <p className="text-sm leading-relaxed whitespace-pre-line">{birthChart.overview}</p>
      {birthChart.sections.map((section, index) => <div key={`${section.title}-${index}`}>
        <h3 className="mb-1 text-sm font-medium text-astral-gold">{section.title}</h3>
        <p className="text-sm leading-relaxed whitespace-pre-line">{section.body}</p>
      </div>)}
      {birthChart.synthesis && <p className="text-sm leading-relaxed whitespace-pre-line">{birthChart.synthesis}</p>}
      {birthChart.reflection && <div><h3 className="mb-1 text-xs font-medium text-astral-cyan">Reflection</h3><p className="text-sm leading-relaxed">{birthChart.reflection}</p></div>}
    </section>
  );
  if (!onEnhanceChart) return null;
  return <section aria-label="Add birth chart interpretation" className="border-y border-[var(--panel-border)] py-3">
    <button type="button" onClick={onEnhanceChart} disabled={!chartAvailable || chartLoading || enhancingChart} aria-busy={enhancingChart} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-medium text-[var(--app-text)] disabled:opacity-50">
      {enhancingChart ? <LoaderCircle size={16} className="shrink-0 animate-spin motion-reduce:animate-none" /> : <Sparkles size={16} className="shrink-0" />}
      <span>{enhancingChart ? "Interpreting birth chart..." : "Enhance with my birth chart"}</span>
    </button>
    {estimated && chartAvailable && <p className="mt-2 text-xs leading-5 text-astral-gold">Estimated birth time: placements and interpretation are approximate. No houses, angles or full wheel.</p>}
    {!chartAvailable && <p role="status" className="mt-2 text-xs leading-5 text-[var(--app-text)] opacity-70">{chartLoading ? "Calculating your chart separately..." : "Calculated natal facts need a recorded or estimated birth time."}</p>}
    {enhancementError && <p role="alert" className="mt-2 text-xs leading-5 text-red-400">{enhancementError}</p>}
  </section>;
}
