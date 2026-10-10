"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AudioLines, BookOpen, CalendarDays, Orbit, X } from "lucide-react";
import Link from "next/link";

const steps = [
  { title: "Two views of the same sky", icon: Orbit, body: "Choose Solar system or Birth chart above the scene. The solar system is an illustrative heliocentric view; the birth chart is geocentric and tropical, so their signs may differ. Earth remains a grounding reflection." },
  { title: "Confirm your birth details", icon: CalendarDays, body: "Enter your birth date and choose Known, Estimated or Unknown birth time. London, UK and Europe/London are the defaults. Confirm your birthplace and recorded local time, then allow chart processing. Use Confirm birth details for Zeus even before casting a reading." },
  { title: "Read with the right confidence", icon: BookOpen, body: "A full wheel needs a known, recorded local birth time and exact birthplace. Estimated times give approximate placements without houses, angles or a wheel. Unknown times give a limited reading. Readings use dated London-noon snapshots, not guaranteed predictions." },
  { title: "Explore your private chart", icon: Orbit, body: "Cast a reading to load your reading and calculated chart independently, or choose Calculate chart in the birth chart view. Switch Natal and Transits, choose Tilt or Flat, inspect calculated placements, and download the original SVG. Changing birth details or the sky date clears the previous chart." },
  { title: "Interpret only when you choose", icon: BookOpen, body: "Chart calculation does not generate an AI interpretation. Choose Enhance with my birth chart from your reading or chart view, or Interpret birth chart when no reading exists. The interpretation is labelled separately from calculated facts. A failed chart request leaves your reading intact." },
  { title: "Explore with Zeus", icon: AudioLines, body: "Start Talk to Zeus from the sky or a reading. He receives your selected-date sky, current reading and available calculated chart facts. Microphone access starts only when you start a conversation. Closing the conversation stops your microphone." },
  { title: "Listen, save and understand", icon: BookOpen, body: "Listen to a reading, generate an audio download or save a PDF. Chart calculations run on this app's server. AI readings, audio and conversations use remote services. Private chart context expires after an hour; theme and tour preferences stay in your browser. Read the privacy policy for processing and retention details." },
];

export default function QuickTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    setStep(0);
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>("button")?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open, onClose]);
  const current = steps[step];
  const Icon = current.icon;
  return <AnimatePresence>{open && (
    <motion.div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
      <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby="quick-tour-title" aria-describedby="quick-tour-body" className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border border-[var(--panel-border)] bg-[var(--app-bg)] p-6 text-[var(--app-text)] shadow-xl" initial={{ y: reducedMotion ? 0 : 16 }} animate={{ y: 0 }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm opacity-70">Welcome to myAeon</p>
          <button onClick={onClose} aria-label="Close quick tour" title="Close quick tour" className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={20} /></button>
        </div>
        <div className="min-h-[250px] py-5">
          <Icon className="mb-5 text-[var(--astral-gold)]" size={36} aria-hidden="true" />
          <p className="mb-2 text-xs opacity-70">{step + 1} of {steps.length}</p>
          <h2 id="quick-tour-title" className="mb-4 text-2xl font-medium leading-tight">{current.title}</h2>
          <p id="quick-tour-body" className="text-base leading-7">{current.body}</p>
        </div>
        <p className="mb-5 text-xs leading-5 opacity-70">Astrology offers reflection, not certain predictions. <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Privacy policy</Link></p>
        <div className="flex items-center gap-3">
          <button onClick={() => step ? setStep(step - 1) : onClose()} className="h-12 flex-1 rounded-md border border-[var(--panel-border)]">{step ? "Back" : "Skip"}</button>
          <button onClick={() => step === steps.length - 1 ? onClose() : setStep(step + 1)} className="h-12 flex-[2] rounded-md bg-[#d4a437] px-3 font-semibold text-[#15121a]">{step === steps.length - 1 ? "Start exploring" : "Next"}</button>
        </div>
      </motion.div>
    </motion.div>
  )}</AnimatePresence>;
}
