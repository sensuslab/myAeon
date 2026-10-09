"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AudioLines, BookOpen, CalendarDays, Orbit, X } from "lucide-react";

const steps = [
  { title: "Your sky, at a glance", icon: Orbit, body: "Explore the planets by dragging and zooming. Tap a planet to inspect it. Choose another reading date in your birth details to explore an estimated upcoming sky." },
  { title: "Cast your reading", icon: CalendarDays, body: "Tap Cast reading, then enter your name, birth date, time of birth and birthplace. Choose the date you want to explore. Keep your birth time as recorded locally." },
  { title: "Make it yours", icon: BookOpen, body: "Explore Today, 3 Days, Week and Month in your reading. Planet selections reveal personal insights once a reading is ready. Listen, generate an audio download, or save a designed PDF." },
  { title: "Talk to Zeus", icon: AudioLines, body: "Talk to Zeus is available from both the sky and your reading. Start a conversation to enable your microphone and ask about astrology, planetary placements or your current reading. Closing the conversation stops the microphone." },
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
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
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
        <p className="mb-5 text-xs leading-5 opacity-70">Astrology offers reflection, not certain predictions.</p>
        <div className="flex items-center gap-3">
          <button onClick={() => step ? setStep(step - 1) : onClose()} className="h-12 flex-1 rounded-md border border-[var(--panel-border)]">{step ? "Back" : "Skip"}</button>
          <button onClick={() => step === steps.length - 1 ? onClose() : setStep(step + 1)} className="h-12 flex-[2] rounded-md bg-[#d4a437] px-3 font-semibold text-[#15121a]">{step === steps.length - 1 ? "Start exploring" : "Next"}</button>
        </div>
      </motion.div>
    </motion.div>
  )}</AnimatePresence>;
}
