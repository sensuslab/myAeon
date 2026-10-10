"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export default function HowItWorksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, [open]);
  return <AnimatePresence>{open && <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
    <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby="how-title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-1/2 left-1/2 z-50 max-h-[82svh] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto glass-strong rounded-lg p-5 md:p-8" onKeyDown={event => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 id="how-title" className="text-xl font-medium gold-text">How this works</h2><button type="button" onClick={onClose} title="Close" aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg glass"><X size={20} /></button></div>
      <div className="space-y-5 text-sm leading-6 text-[var(--app-text)]">
        <Section title="Two views">The solar system is an illustrative heliocentric snapshot for the selected date. The birth chart uses calculated geocentric tropical placements. Their signs may differ. Earth is a grounding reflection, not a geocentric natal planet.</Section>
        <Section title="Calculation and interpretation">Chart calculations run on this app&apos;s server. Casting loads a baseline reading and calculated chart independently. A chart request alone does not generate an AI reading. Birth chart interpretation starts only when you choose Enhance with my birth chart or Interpret birth chart. Calculated facts and AI interpretation are labelled separately.</Section>
        <Section title="Birth-time confidence">A full wheel needs a known, recorded local birth time and exact birthplace. Estimated times give approximate placements without houses, angles or a wheel. Unknown times give a limited reading. Sky snapshots use noon in London, UK, not exact event times.</Section>
        <Section title="Talk to Zeus">Zeus receives the selected sky date, your reading and available calculated chart facts. Microphone access begins only when you start a conversation. Closing the conversation stops the microphone.</Section>
        <Section title="Reflection, not certainty">Readings are AI-generated invitations to reflection, not professional advice or guaranteed predictions. For personal decisions or distress, speak with a qualified person you trust.</Section>
        <Section title="Your data">AI readings, speech and conversations use remote services. Private profiles, chart facts and generated audio are cached temporarily; browser preferences remain local. Provider policies and hosting logs may have different retention periods. <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-astral-cyan underline underline-offset-2">Read the privacy policy</Link> for processing, retention, source code and licensing details.</Section>
      </div>
    </motion.div>
  </>}</AnimatePresence>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-sm font-medium text-astral-gold">{title}</h3><p>{children}</p></section>;
}
