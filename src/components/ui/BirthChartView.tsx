"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Download, LoaderCircle, RotateCcw, Sparkles, Pencil } from "lucide-react";
import type { ThemeMode } from "./types";
import { chartHouseLabel, chartPointLabel, type ChartContext, type ChartEnhancementProps } from "./chartPresentation";

const BirthChartScene = dynamic(() => import("../scene/BirthChartScene"), { ssr: false });

type Props = ChartEnhancementProps & {
  context: ChartContext | null; theme: ThemeMode; loading: boolean; error: string | null;
  timeConfidence: "known" | "estimated" | "unknown"; confirmed: boolean;
  hasReading: boolean; enhanced: boolean; onCalculate: () => void; onEditDetails: () => void;
};

export default function BirthChartView({ context, theme, loading, error, timeConfidence, confirmed, hasReading, enhanced, onCalculate, onEditDetails, onEnhanceChart, enhancingChart, enhancementError }: Props) {
  const [mode, setMode] = useState<"natal" | "transit">("natal");
  const [flat, setFlat] = useState(true);
  const [reset, setReset] = useState(0);
  const [pointName, setPointName] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const onImageError = useCallback(() => setImageError("The chart image could not be displayed. You can still inspect its placements or download the original SVG."), []);
  const svg = timeConfidence === "known" ? context?.charts?.[mode]?.[theme] : undefined;
  const snapshot = context?.snapshots.find(item => item.date === context.selectedDate) ?? context?.snapshots[0];
  const points = mode === "natal" ? [...(context?.natal?.planets ?? []), ...(context?.natal?.angles ?? [])] : snapshot?.planets ?? [];
  const point = points.find(item => item.name === pointName) ?? points[0];
  const available = Boolean(context?.natal && timeConfidence !== "unknown");
  const download = () => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `myAeon-${mode}-${context?.selectedDate ?? "chart"}-${theme}.svg`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section aria-label="Birth chart view">
    <div className="chart-toolbar">
      <div role="group" aria-label="Chart type" className="chart-segments">
        <button type="button" aria-pressed={mode === "natal"} onClick={() => { setMode("natal"); setImageError(null); }}>Natal</button>
        <button type="button" aria-pressed={mode === "transit"} onClick={() => { setMode("transit"); setImageError(null); }}>Transits</button>
      </div>
      <div role="group" aria-label="Chart perspective" className="chart-segments">
        <button type="button" aria-pressed={!flat} onClick={() => setFlat(false)}>Tilt</button>
        <button type="button" aria-pressed={flat} onClick={() => setFlat(true)}>Flat</button>
      </div>
      <button type="button" className="chart-icon" title="Reset chart view" aria-label="Reset chart view" onClick={() => setReset(value => value + 1)}><RotateCcw size={17} /></button>
      <button type="button" className="chart-icon" title="Download original SVG" aria-label="Download original SVG" disabled={!svg} onClick={download}><Download size={17} /></button>
    </div>

    <div className="chart-surface">
      {svg && !imageError ? <BirthChartScene svg={svg} theme={theme} flat={flat} reset={reset} onError={onImageError} /> : <div className="chart-empty">
        <h2 className="text-base font-medium">{loading ? "Calculating birth chart" : timeConfidence !== "known" ? "A recorded birth time is needed" : "Your birth chart"}</h2>
        <p className="mt-2 text-sm leading-6 opacity-75" role={error || imageError ? "alert" : "status"}>{loading ? "Your reading continues independently." : imageError || error || (timeConfidence !== "known" ? "A full wheel needs a known local birth time and exact birthplace. You can still cast a limited reading and explore the solar system." : !confirmed ? "Confirm your birth details to calculate a private chart." : context ? "No chart wheel was returned. Calculated placements remain available below." : "Calculate your chart, or cast a reading to load both views.")}</p>
        {!loading && <button type="button" onClick={timeConfidence !== "known" || !confirmed ? onEditDetails : onCalculate} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--panel-border)] px-3 text-sm"><Pencil size={16} />{timeConfidence !== "known" || !confirmed ? "Edit birth details" : "Calculate chart"}</button>}
      </div>}
    </div>

    <div className="chart-inspector">
      {point && <div className="mb-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="chart-placement" className="text-xs font-medium text-astral-cyan">{timeConfidence === "estimated" ? "Approximate facts" : "Private chart facts"}</label>
          <select id="chart-placement" aria-label="Inspect calculated placement" value={point.name} onChange={event => setPointName(event.target.value)} className="min-h-9 min-w-0 max-w-[50%] rounded-lg border border-[var(--panel-border)] bg-[var(--field-bg)] px-2 text-xs">
            {points.map(item => <option key={item.name} value={item.name}>{chartPointLabel(item.name)}</option>)}
          </select>
        </div>
        <p className="mt-1 text-xs leading-5">{point.sign} {point.degree.toFixed(2)}°{point.house ? ` / ${chartHouseLabel(point.house)}` : ""}{point.retrograde ? " / Retrograde" : ""}</p>
        <p className="text-[11px] leading-4 opacity-60">{mode === "natal" ? "Natal" : `Transits / ${context?.selectedDate}`} / Geocentric / {context?.confidence} time</p>
      </div>}
      {timeConfidence === "estimated" && <p className="mb-2 text-xs leading-5 text-astral-gold">Estimated birth time: approximate placements and interpretation. No houses, angles or full wheel.</p>}
      {enhanced ? <p role="status" className="text-xs text-astral-cyan">Birth chart interpretation added to your reading.</p> : <button type="button" onClick={onEnhanceChart} disabled={!available || loading || enhancingChart || !onEnhanceChart} aria-busy={enhancingChart} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--panel-border)] px-2 py-2 text-xs font-medium disabled:opacity-50">
        {enhancingChart ? <LoaderCircle size={16} className="shrink-0 animate-spin motion-reduce:animate-none" /> : <Sparkles size={16} className="shrink-0" />}
        <span>{enhancingChart ? "Interpreting birth chart..." : hasReading ? "Enhance with my birth chart" : "Interpret birth chart"}</span>
      </button>}
      {enhancementError && <p role="alert" className="mt-2 text-xs leading-5 text-red-400">{enhancementError}</p>}
    </div>
  </section>;
}
