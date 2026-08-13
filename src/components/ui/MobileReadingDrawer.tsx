"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getSunSign, type ZodiacSign } from "@/lib/zodiac";
import type { BirthInput } from "./ControlPanel";
import type { ReadingPayload } from "./types";

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  reading: ReadingPayload | null;
  flat: boolean;
  onSubmit: (input: BirthInput, sunSign: ZodiacSign) => void;
  onClose: () => void;
  onViewChange: (flat: boolean) => void;
  onViewReading: () => void;
  onHowItWorks: () => void;
  onReadingDateChange: (readingDate: string) => void;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function MobileReadingDrawer({
  open,
  loading,
  error,
  reading,
  flat,
  onSubmit,
  onClose,
  onViewChange,
  onViewReading,
  onHowItWorks,
  onReadingDateChange,
}: Props) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("1995-06-15");
  const [birthTime, setBirthTime] = useState("12:00");
  const [birthPlace, setBirthPlace] = useState("");
  const [readingDate, setReadingDate] = useState(todayInputValue);

  const sunSign = useMemo(() => {
    try {
      return getSunSign(new Date(birthDate));
    } catch {
      return null;
    }
  }, [birthDate]);

  useEffect(() => {
    onReadingDateChange(readingDate);
  }, [onReadingDateChange, readingDate]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sunSign) return;
    onSubmit({ name, birthDate, birthTime, birthPlace, readingDate }, sunSign);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close reading drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Birth details"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88svh] overflow-hidden rounded-t-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] text-[var(--app-text)] shadow-[var(--panel-shadow)] backdrop-blur-2xl md:hidden"
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--panel-border)]" />

            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-astral-cyan/80">
                  Birth Chart
                </p>
                <h2 className="text-xl font-light gold-text">Your Cosmos</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Minimise drawer"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-lg text-white/70 transition active:scale-95"
              >
                x
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="max-h-[calc(88svh-5.75rem)] space-y-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2 scrollbar-hide"
            >
              <Field label="Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seeker"
                  className="mobile-input"
                />
              </Field>

              <Field label="Date of birth">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  required
                  className="mobile-input"
                />
              </Field>

              <Field label="Time of birth">
                <input
                  type="time"
                  value={birthTime}
                  onChange={(event) => setBirthTime(event.target.value)}
                  className="mobile-input"
                />
              </Field>

              <Field label="Place of birth">
                <input
                  value={birthPlace}
                  onChange={(event) => setBirthPlace(event.target.value)}
                  placeholder="City, Country"
                  className="mobile-input"
                />
              </Field>

              <Field label="Sky date">
                <input
                  type="date"
                  value={readingDate}
                  onChange={(event) => setReadingDate(event.target.value)}
                  className="mobile-input"
                />
              </Field>

              {sunSign && (
                <div className="flex items-center gap-3 rounded-2xl border border-astral-cyan/20 bg-astral-cyan/5 p-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-astral-gold/10 text-2xl gold-text">
                    {sunSign.glyph}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                      Sun sign
                    </p>
                    <p className="text-base font-medium text-white/90">{sunSign.name}</p>
                    <p className="text-xs text-white/50">
                      {sunSign.element} / {sunSign.modality}
                    </p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm font-medium text-red-300">The stars are obscured</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/75">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sunSign}
                className="h-[3.25rem] w-full rounded-2xl bg-gradient-to-r from-astral-gold to-astral-bronze px-5 text-base font-semibold text-astral-deep shadow-lg shadow-astral-gold/20 transition active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? "Casting..." : "Cast my reading"}
              </button>

              {reading && (
                <button
                  type="button"
                  onClick={onViewReading}
                  className="h-12 w-full rounded-2xl border border-astral-gold/25 bg-astral-gold/10 px-5 text-sm font-medium text-white/85 transition active:scale-[0.98]"
                >
                  Open reading
                </button>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex rounded-full bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => onViewChange(true)}
                    className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      flat
                        ? "bg-astral-gold text-astral-deep"
                        : "text-white/60"
                    }`}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewChange(false)}
                    className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      !flat
                        ? "bg-astral-gold text-astral-deep"
                        : "text-white/60"
                    }`}
                  >
                    3D
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onHowItWorks}
                  aria-label="How this works"
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-astral-cyan transition active:scale-95"
                >
                  ?
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}
