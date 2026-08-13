"use client";

import type { CosmicSnapshot, ZodiacSign } from "@/lib/zodiac";
import { PLANETS, longitudeToSign } from "@/lib/zodiac";

type Props = {
  snapshot: CosmicSnapshot;
  /** Optional: pre-computed signs map (id → sign) so we don't recompute per render */
  signsById?: Record<string, ZodiacSign>;
  label?: string;
};

/**
 * Bottom bar showing each planet's current zodiac sign + degree.
 * Pulls straight from the snapshot so it stays in sync with the 3D scene.
 */
export default function PlanetInfoBar({ snapshot, signsById, label = "Now" }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none md:px-4">
      <div className="glass-strong mx-auto max-w-5xl rounded-xl px-2 py-2 pointer-events-auto md:rounded-2xl md:px-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] uppercase tracking-[0.3em] text-astral-cyan/80 shrink-0 px-2">
            {label}
          </span>
          {snapshot.planets.map((pos) => {
            const planet = PLANETS.find((p) => p.id === pos.id)!;
            const sign = signsById?.[pos.id] ?? longitudeToSign(pos.longitude);
            const deg = Math.floor(pos.longitude % 30);
            return (
              <div
                key={pos.id}
                className="flex items-center gap-2 px-3 py-1 rounded-lg shrink-0 hover:bg-white/5 transition"
                title={`${planet.name} at ${pos.longitude.toFixed(2)}°`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: planet.color, boxShadow: `0 0 6px ${planet.color}` }}
                />
                <span className="text-xs text-white/80">{planet.name}</span>
                <span className="text-xs gold-text">{sign.symbol} {deg}°</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
