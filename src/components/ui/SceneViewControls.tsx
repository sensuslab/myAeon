"use client";

import { Orbit, ChartNoAxesCombined } from "lucide-react";

export type SceneView = "solar" | "chart";

export default function SceneViewControls({ view, onChange }: { view: SceneView; onChange: (view: SceneView) => void }) {
  return <div className="scene-view-controls" role="group" aria-label="Sky view">
    <button type="button" aria-pressed={view === "solar"} onClick={() => onChange("solar")}><Orbit size={16} aria-hidden /> <span>Solar system</span></button>
    <button type="button" aria-pressed={view === "chart"} onClick={() => onChange("chart")}><ChartNoAxesCombined size={16} aria-hidden /> <span>Birth chart</span></button>
  </div>;
}
