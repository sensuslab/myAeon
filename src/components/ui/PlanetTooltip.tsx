"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { PlanetVisual } from "@/lib/zodiac";

type Props = {
  planet: PlanetVisual | null;
  sign: string | null;
};

/**
 * Floating planet tooltip — appears near the hovered planet on the canvas.
 * The 3D scene reports screen-space coords; we project those to a CSS overlay.
 */
export default function PlanetTooltip({ planet, sign }: Props) {
  return (
    <AnimatePresence>
      {planet && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.15 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-[140%] z-20 pointer-events-none"
        >
          <div className="glass-strong rounded-xl px-4 py-3 text-center max-w-xs">
            <div
              className="w-3 h-3 rounded-full mx-auto mb-2"
              style={{ background: planet.color, boxShadow: `0 0 12px ${planet.color}` }}
            />
            <div className="text-base font-light gold-text tracking-wide">{planet.name}</div>
            {sign && (
              <div className="text-[10px] uppercase tracking-widest text-astral-cyan/80 mt-1">
                in {sign}
              </div>
            )}
            <div className="text-xs text-white/60 mt-2 italic">{planet.archetype}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}