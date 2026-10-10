"use client";
import AstrologyStatus from "./AstrologyStatus";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, FileDown, Pencil, CircleHelp } from "lucide-react";
import type { PlanetVisual, ZodiacSign } from "@/lib/zodiac";
import type { PlanetInsight, ReadingPayload } from "./types";
import ReadingAudioPlayer from "./ReadingAudioPlayer";
import type { ReadingAudioState } from "./useReadingAudio";
import BirthChartReading from "./BirthChartReading";
import { publicMessage, type ChartEnhancementProps } from "./chartPresentation";

type Props = ChartEnhancementProps & {
  open: boolean;
  reading: ReadingPayload | null;
  audio: ReadingAudioState;
  sign: ZodiacSign | null;
  loading: boolean;
  error: string | null;
  pdfLoading?: boolean;
  selectedPlanet: PlanetVisual | null;
  selectedPlanetSign: ZodiacSign | null;
  selectedPlanetDegree: number | null;
  onClose: () => void;
  onEditDetails: () => void;
  onDownloadPdf?: () => void;
  onClearSelectedPlanet: () => void;
  onOpenTour: () => void;
};

const TIMEFRAMES = ["Today", "3 Days", "Week", "Month"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const DOMAINS: Record<string, string> = {
  "Love & Connection": "love",
  "Purpose & Work": "purpose",
  "Body & Energy": "body",
  "Inner World": "inner",
};

export default function MobileReadingView({
  open,
  reading,
  audio,
  sign,
  loading,
  error,
  pdfLoading,
  selectedPlanet,
  selectedPlanetSign,
  selectedPlanetDegree,
  onClose,
  onEditDetails,
  onDownloadPdf,
  onClearSelectedPlanet,
  onOpenTour,
  ...chartEnhancement
}: Props) {
  const [tf, setTf] = useState<Timeframe>("Today");
  const selectedInsight = selectedPlanet
    ? reading?.planetInsights?.find((insight) => insight.id === selectedPlanet.id) ?? null
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 overflow-y-auto bg-[var(--app-bg)] text-[var(--app-text)] md:hidden"
        >
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[var(--app-bg)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to planets"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-lg text-white/75 transition active:scale-95"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-[10px] uppercase tracking-[0.28em] text-astral-cyan/80">
                  Your Reading
                </p>
                <h1 className="truncate text-xl font-light gold-text">
                  {sign?.name ?? reading?.sunSign.name ?? "Aeon"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {reading && onDownloadPdf && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={pdfLoading}
                    aria-label="Download reading PDF"
                    title="Download reading PDF"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-astral-gold/25 bg-astral-gold/10 text-astral-gold transition active:scale-95 disabled:opacity-60"
                  >
                    <FileDown size={18} className={pdfLoading ? "animate-pulse" : ""} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onEditDetails}
                  aria-label="Edit birth details"
                  title="Edit birth details"
                  className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/75 transition active:scale-95"
                >
                  <Pencil size={18} />
                </button>
                <button type="button" onClick={onOpenTour} aria-label="Quick tour" title="Quick tour" className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/5"><CircleHelp size={18} /></button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-xl space-y-5 px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-5">
            {selectedPlanet && (
              <MobilePlanetInsight
                planet={selectedPlanet}
                sign={selectedPlanetSign}
                degree={selectedPlanetDegree}
                insight={selectedInsight}
                loading={loading}
                hasReading={Boolean(reading)}
                onClear={onClearSelectedPlanet}
              />
            )}

            {loading && <ReadingLoading />}

            {error && !loading && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-semibold text-red-300">The stars are obscured</p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{publicMessage(error, "Could not cast your reading. Please try again.")}</p>
              </div>
            )}

            {!reading && !loading && !error && (
              <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] p-5 text-center shadow-[var(--panel-shadow)]">
                <p className="text-sm text-white/70">No reading has been cast yet.</p>
                <button
                  type="button"
                  onClick={onEditDetails}
                  className="mt-4 h-12 rounded-2xl bg-gradient-to-r from-astral-gold to-astral-bronze px-6 text-sm font-semibold text-astral-deep"
                >
                  Cast reading
                </button>
              </div>
            )}

            {reading && !loading && (
              <>
                <ReadingAudioPlayer audio={audio} />
                <section className="rounded-3xl border border-astral-cyan/15 bg-astral-cyan/5 p-5">
                  <p className="text-sm italic text-astral-cyan">{reading.greeting}</p>
                  <p className="mt-3 text-base leading-7 text-white/90">{reading.summary}</p>
                </section>

                <AstrologyStatus metadata={reading.meta?.astrology} />
                <BirthChartReading reading={reading} {...chartEnhancement} />

                <div className="sticky top-[calc(env(safe-area-inset-top)+4.65rem)] z-[9] -mx-1 rounded-2xl bg-[var(--app-bg)]/90 p-1 backdrop-blur-xl">
                  <div className="grid grid-cols-4 rounded-2xl bg-black/30 p-1">
                    {TIMEFRAMES.map((timeframe) => (
                      <button
                        key={timeframe}
                        type="button"
                        onClick={() => setTf(timeframe)}
                        className={`h-10 rounded-xl text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
                          tf === timeframe
                            ? "bg-gradient-to-r from-astral-gold to-astral-bronze text-astral-deep"
                            : "text-white/60"
                        }`}
                      >
                        {timeframe}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={tf}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3"
                  >
                    {reading.sections
                      .filter((section) => section.timeframe === tf)
                      .map((section, index) => (
                        <article
                          key={`${section.title}-${index}`}
                          className="rounded-2xl border border-white/10 bg-white/[.03] p-4"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <DomainGlyph domain={DOMAINS[section.title] ?? "default"} />
                            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-astral-gold">
                              {section.title}
                            </h2>
                          </div>
                          <p className="text-[15px] leading-7 text-white/85">{section.body}</p>
                        </article>
                      ))}
                  </motion.div>
                </AnimatePresence>

                {reading.affirmation && (
                  <section className="rounded-3xl border border-astral-gold/20 bg-astral-gold/10 p-5 text-center">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-astral-cyan/80">
                      Affirmation
                    </p>
                    <p className="mt-3 text-lg font-light italic leading-7 gold-text">
                      &ldquo;{reading.affirmation}&rdquo;
                    </p>
                  </section>
                )}

                {reading.meta?.readingDate && (
                  <p className="pb-2 text-center text-[10px] text-white/30">
                    AI-generated reading / Sky date {reading.meta.readingDate}
                  </p>
                )}
              </>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function ReadingLoading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-white/5 bg-white/5 p-4">
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function MobilePlanetInsight({
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
  const positionLabel = sign ? `${sign.symbol} ${sign.name}${degree !== null ? ` ${degree}deg` : ""}` : null;
  const domains = planet.domains.slice(0, 2).join(" and ");

  return (
    <section className="rounded-3xl border border-astral-gold/25 bg-astral-gold/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-astral-cyan/80">
            Planet Focus
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: planet.color, boxShadow: `0 0 14px ${planet.color}` }}
            />
            <h2 className="truncate text-xl font-light gold-text">{planet.name}</h2>
          </div>
          {positionLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
              Visual heliocentric: {positionLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear planet focus"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 transition active:scale-95"
        >
          x
        </button>
      </div>

      {insight ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-base font-medium leading-snug text-white/90">{insight.title}</h3>
          <p className="text-[15px] leading-7 text-white/80">{insight.body}</p>
          {insight.reflection && (
            <div className="rounded-2xl border border-astral-cyan/15 bg-astral-cyan/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-astral-cyan/80">
                Reflection
              </p>
              <p className="mt-1 text-sm leading-6 text-white/75">{insight.reflection}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-white/70">
          {loading
            ? `${planet.name}'s note is being drawn into the reading.`
            : hasReading
              ? `${planet.name}'s note was not returned this time. Its current ${positionLabel ?? "position"} still points attention toward ${domains}.`
              : `Cast a reading to unlock a personal ${planet.name} note.`}
        </p>
      )}
    </section>
  );
}

function DomainGlyph({ domain }: { domain: string }) {
  const glyphs: Record<string, string> = {
    love: "Love",
    purpose: "Work",
    body: "Body",
    inner: "Mind",
  };
  return (
    <span className="rounded-full bg-astral-cyan/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-astral-cyan">
      {glyphs[domain] ?? "Note"}
    </span>
  );
}
