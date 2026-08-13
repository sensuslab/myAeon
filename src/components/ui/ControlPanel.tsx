"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getSunSign, type ZodiacSign } from "@/lib/zodiac";

export type BirthInput = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  readingDate: string;
};

type Props = {
  onSubmit: (input: BirthInput, sunSign: ZodiacSign) => void;
  loading: boolean;
  onViewChange: (flat: boolean) => void;
  flat: boolean;
  onHowItWorks: () => void;
  onReadingDateChange: (readingDate: string) => void;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Persistent left-side control panel — birth data + view toggle + about.
 * Matches the original plan.md (ControlPanel with location, birth data, toggles).
 */
export default function ControlPanel({
  onSubmit,
  loading,
  onViewChange,
  flat,
  onHowItWorks,
  onReadingDateChange,
}: Props) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("1995-06-15");
  const [birthTime, setBirthTime] = useState("12:00");
  const [birthPlace, setBirthPlace] = useState("");
  const [readingDate, setReadingDate] = useState(todayInputValue);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    onReadingDateChange(readingDate);
  }, [onReadingDateChange, readingDate]);

  const sunSign = (() => {
    try {
      return getSunSign(new Date(birthDate));
    } catch {
      return null;
    }
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sunSign) return;
    onSubmit({ name, birthDate, birthTime, birthPlace, readingDate }, sunSign);
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-20 left-4 bottom-24 z-20 w-80 max-w-[calc(100vw-2rem)] pointer-events-none max-md:top-[4.5rem] max-md:left-3 max-md:right-3 max-md:bottom-auto max-md:w-auto max-md:max-w-none"
    >
      <div className="glass-strong h-full overflow-y-auto rounded-2xl p-5 pointer-events-auto scrollbar-hide max-md:max-h-[43svh] max-md:rounded-xl max-md:p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-astral-cyan/80">
              Birth Chart
            </p>
            <h2 className="text-lg font-light gold-text tracking-wide">Your Cosmos</h2>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
            className="w-7 h-7 rounded-full glass hover:bg-white/10 transition flex items-center justify-center text-white/60 hover:text-white text-xs"
          >
            {collapsed ? "▸" : "◂"}
          </button>
        </div>

        {!collapsed && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seeker"
                className="cp-input"
              />
            </Field>

            <Field label="Birth date">
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="cp-input"
              />
            </Field>

            <Field label="Birth time">
              <input
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
                className="cp-input"
              />
            </Field>

            <Field label="Birth place (optional)">
              <input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="City, Country"
                className="cp-input"
              />
            </Field>

            <Field label="Sky date">
              <input
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                className="cp-input"
              />
            </Field>

            {sunSign && (
              <div className="rounded-lg p-3 bg-astral-cyan/5 border border-astral-cyan/20 flex items-center gap-3">
                <div className="text-3xl gold-text leading-none">{sunSign.glyph}</div>
                <div className="text-xs">
                  <div className="text-white/50 uppercase tracking-widest text-[10px]">
                    Sun sign
                  </div>
                  <div className="text-sm text-white">{sunSign.name}</div>
                  <div className="text-[10px] text-white/50">
                    {sunSign.element} · {sunSign.modality}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-astral-gold to-astral-bronze text-astral-deep font-semibold text-sm tracking-wide hover:from-astral-ochre hover:to-astral-bronze transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-astral-gold/20"
            >
              {loading ? "Reading the stars…" : "Cast My Reading"}
            </button>

            <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-white/50">
                  View
                </span>
                <div className="flex gap-1 rounded-full bg-black/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => onViewChange(true)}
                    className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition ${
                      flat
                        ? "bg-astral-gold text-astral-deep font-semibold"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewChange(false)}
                    className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition ${
                      !flat
                        ? "bg-astral-gold text-astral-deep font-semibold"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    3D
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onHowItWorks}
                className="w-full text-left text-[10px] uppercase tracking-widest text-astral-cyan/70 hover:text-astral-cyan transition py-1"
              >
                ? How this works
              </button>
            </div>
          </form>
        )}

        <style jsx>{`
          .cp-input {
            width: 100%;
            background: var(--field-bg);
            border: 1px solid var(--field-border);
            color: var(--field-text);
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
            outline: none;
            transition: border-color 0.15s;
            font-size: 0.8rem;
          }
          .cp-input:focus {
            border-color: rgba(212, 164, 55, 0.7);
          }
          .cp-input::placeholder {
            color: var(--field-placeholder);
          }
        `}</style>
      </div>
    </motion.aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
