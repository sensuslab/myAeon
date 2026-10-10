"use client";
import AstrologyStatus from "./AstrologyStatus";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { PlanetVisual, ZodiacSign } from "@/lib/zodiac";
import type { PlanetInsight, ReadingPayload } from "./types";
import ReadingAudioPlayer from "./ReadingAudioPlayer";
import type { ReadingAudioState } from "./useReadingAudio";
import BirthChartReading from "./BirthChartReading";
import { publicMessage, type ChartEnhancementProps } from "./chartPresentation";

export type { ReadingPayload };

type Props = ChartEnhancementProps & {
  reading: ReadingPayload | null;
  audio: ReadingAudioState;
  sign: ZodiacSign | null;
  loading: boolean;
  error: string | null;
  pdfLoading?: boolean;
  selectedPlanet: PlanetVisual | null;
  selectedPlanetSign: ZodiacSign | null;
  selectedPlanetDegree: number | null;
  onDownloadPdf?: () => void;
  onClearSelectedPlanet: () => void;
};

const TIMEFRAMES = ["Today", "3 Days", "Week", "Month"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const DOMAINS: Record<string, string> = {
  "Love & Connection": "love",
  "Purpose & Work": "purpose",
  "Body & Energy": "body",
  "Inner World": "inner",
};

/**
 * Persistent right-side reading panel — tabbed timeframes × life domains.
 * Matches the original plan.md (ReadingPanel with tabbed timeframes).
 */
export default function ReadingPanel({
  reading,
  audio,
  sign,
  loading,
  error,
  pdfLoading,
  selectedPlanet,
  selectedPlanetSign,
  selectedPlanetDegree,
  onDownloadPdf,
  onClearSelectedPlanet,
  ...chartEnhancement
}: Props) {
  const [tf, setTf] = useState<Timeframe>("Today");
  const selectedInsight = selectedPlanet
    ? reading?.planetInsights?.find((insight) => insight.id === selectedPlanet.id) ?? null
    : null;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="reading-panel fixed top-20 right-4 bottom-24 z-20 w-96 max-w-[calc(100vw-2rem)] pointer-events-none max-md:top-auto max-md:left-3 max-md:right-3 max-md:bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] max-md:w-auto max-md:max-w-none"
    >
      <div className="glass-strong h-full overflow-y-auto rounded-2xl p-5 pointer-events-auto scrollbar-hide max-md:max-h-[31svh] max-md:rounded-xl max-md:p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-astral-cyan/80">
              Your Reading
            </p>
            <h2 className="text-lg font-light gold-text tracking-wide">
              {sign?.name ?? "Cast a reading"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {reading && onDownloadPdf && (
              <button
                type="button"
                onClick={onDownloadPdf}
                disabled={pdfLoading}
                className="h-9 rounded-full border border-astral-gold/25 bg-astral-gold/10 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-astral-gold transition hover:bg-astral-gold/15 disabled:cursor-wait disabled:opacity-60"
              >
                {pdfLoading ? "Making" : "PDF"}
              </button>
            )}
            {sign && (
              <div className="text-3xl gold-text leading-none animate-glow rounded-full">
                {sign.glyph}
              </div>
            )}
          </div>
        </div>

        {selectedPlanet && (
          <PlanetFocusCard
            planet={selectedPlanet}
            sign={selectedPlanetSign}
            degree={selectedPlanetDegree}
            insight={selectedInsight}
            loading={loading}
            hasReading={Boolean(reading)}
            onClear={onClearSelectedPlanet}
          />
        )}

        {/* Empty state */}
        {!reading && !loading && !error && (
          <div className="text-center py-12 text-white/40">
            <div className="text-5xl mb-4 opacity-50">✦</div>
            <p className="text-sm">Enter your birth details to receive a personalized cosmic reading.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 bg-white/5 animate-pulse">
              <div className="h-2 bg-white/10 rounded w-3/4 mb-2" />
              <div className="h-2 bg-white/10 rounded w-full mb-2" />
              <div className="h-2 bg-white/10 rounded w-5/6" />
            </div>
            <div className="rounded-xl p-4 bg-white/5 animate-pulse">
              <div className="h-2 bg-white/10 rounded w-1/2 mb-2" />
              <div className="h-2 bg-white/10 rounded w-full" />
            </div>
            <p className="text-center text-astral-cyan/80 text-xs mt-4 animate-twinkle">
              ✦ Reading the stars ✦
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10">
            <h3 className="font-semibold text-red-300 text-sm mb-2">
              The stars are obscured
            </h3>
            <p className="text-xs text-white/80">{publicMessage(error, "Could not cast your reading. Please try again.")}</p>
          </div>
        )}

        {/* Loaded reading */}
        {reading && !loading && (
          <div className="space-y-4">
            <ReadingAudioPlayer audio={audio} />
            {/* Greeting + summary */}
            <div className="rounded-xl p-4 bg-astral-cyan/5 border border-astral-cyan/15">
              <p className="text-astral-cyan text-xs italic">{reading.greeting}</p>
              <p className="text-white/90 text-sm mt-2 leading-relaxed">
                {reading.summary}
              </p>
            </div>

            <AstrologyStatus metadata={reading.meta?.astrology} />
            <BirthChartReading reading={reading} {...chartEnhancement} />

            {/* Timeframe tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-black/30">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTf(t)}
                  className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest rounded-lg transition ${
                    tf === t
                      ? "bg-gradient-to-r from-astral-gold to-astral-bronze text-astral-deep font-semibold"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Sections for active timeframe */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tf}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {reading.sections
                  .filter((s) => s.timeframe === tf)
                  .map((section, i) => (
                    <div key={i} className="rounded-xl p-4 bg-white/[.03] border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <DomainIcon domain={DOMAINS[section.title] ?? "default"} />
                        <h3 className="text-astral-gold text-[11px] uppercase tracking-widest">
                          {section.title}
                        </h3>
                      </div>
                      <p className="text-white/85 text-sm leading-relaxed whitespace-pre-line">
                        {section.body}
                      </p>
                    </div>
                  ))}
                {reading.sections.filter((s) => s.timeframe === tf).length === 0 && (
                  <div className="rounded-xl p-4 bg-white/[.02] border border-white/5 text-center text-white/40 text-xs">
                    No content for this timeframe.
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Affirmation */}
            {reading.affirmation && (
              <div className="rounded-xl p-4 text-center bg-gradient-to-br from-astral-gold/10 to-astral-cyan/5 border border-astral-gold/20">
                <p className="text-[10px] uppercase tracking-[0.3em] text-astral-cyan mb-2">
                  Affirmation
                </p>
                <p className="text-base font-light gold-text italic">
                  &ldquo;{reading.affirmation}&rdquo;
                </p>
              </div>
            )}

            {reading.meta?.readingDate && (
              <p className="text-[9px] text-white/30 text-center pt-1">
                AI-generated reading · Sky date {reading.meta.readingDate}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.aside>
  );
}

function PlanetFocusCard({
  planet,
  sign,
  degree,
  insight,
  loading,
  hasReading,
  onClear,
}: {
  planet: PlanetVisual;
  sign: ZodiacSign | null;
  degree: number | null;
  insight: PlanetInsight | null;
  loading: boolean;
  hasReading: boolean;
  onClear: () => void;
}) {
  const positionLabel = sign ? `${sign.symbol} ${sign.name}${degree !== null ? ` ${degree}°` : ""}` : null;
  const domains = planet.domains.slice(0, 2).join(" and ");

  return (
    <div className="mb-4 rounded-xl p-4 bg-astral-gold/10 border border-astral-gold/25 shadow-[0_0_24px_rgba(212,164,55,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-astral-cyan/80">
            Planet Focus
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: planet.color, boxShadow: `0 0 14px ${planet.color}` }}
            />
            <h3 className="text-lg font-light gold-text tracking-wide truncate">
              {planet.name}
            </h3>
          </div>
          {positionLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
              Visual heliocentric: {positionLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear planet focus"
          className="h-8 w-8 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-astral-cyan/40 hover:bg-white/5 transition"
        >
          x
        </button>
      </div>

      {insight ? (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm text-white/90 font-medium leading-snug">{insight.title}</h4>
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
            {insight.body}
          </p>
          {insight.reflection && (
            <div className="rounded-lg border border-astral-cyan/15 bg-astral-cyan/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.24em] text-astral-cyan/80 mb-1">
                Reflection
              </p>
              <p className="text-xs text-white/75 leading-relaxed">{insight.reflection}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/70 leading-relaxed">
          {loading
            ? `${planet.name}'s personal note is being drawn into the reading now.`
            : hasReading
              ? `${planet.name}'s note was not returned this time. Its current ${positionLabel ?? "position"} still points attention toward ${domains}.`
              : `Cast a reading to unlock a personal ${planet.name} note. For now, ${planet.archetype.toLowerCase()} is moving through ${positionLabel ?? "the current sky"}, highlighting ${domains}.`}
        </p>
      )}
    </div>
  );
}

function DomainIcon({ domain }: { domain: string }) {
  const glyphs: Record<string, string> = {
    love: "♡",
    purpose: "✦",
    body: "☼",
    inner: "◐",
  };
  return (
    <span className="text-astral-cyan text-sm leading-none">
      {glyphs[domain] ?? "✧"}
    </span>
  );
}
