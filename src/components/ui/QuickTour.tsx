"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AudioLines, BookOpen, CalendarDays, Orbit, X } from "lucide-react";
import Link from "next/link";

const steps = [
  { title: "Begin with today", icon: BookOpen, body: "Choose Today for a focused daily reflection with quiet music, spoken playback and a PDF. Full reading explores four dated horizons." },
  { title: "Make it personal", icon: CalendarDays, body: "Enter and confirm your birth date, time and place when you are ready. A known local birth time unlocks houses and angles. If your time is estimated or unknown, your reading will explain what can and cannot be calculated." },
  { title: "Explore at your own pace", icon: Orbit, body: "Explore, Birth chart and Reading each have their own workspace. Unlock the solar view to move the camera, select a planet to focus, or reset the composition. The chart has selectable placements, aspects, a crisp flat view and a 3D tilt view. Previewing another sky date keeps your completed reading." },
  { title: "Discover your birth profile", icon: BookOpen, body: "Open Birth profile in the Birth chart workspace. Choose Standard or Deep analysis to explore personality, interests, strengths, communication and more. Each section includes supporting natal facts. Your profile is separate from your reading and has its own downloadable PDF." },
  { title: "Listen, reflect, keep", icon: AudioLines, body: "Every reading plays with quiet ambient music. Listening and downloading reuse the same voice recording; PDF generation begins only when requested. Ask Zeus about the selected sky or chart, by voice or text. Calculated facts and symbolic interpretations remain distinct." },
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
