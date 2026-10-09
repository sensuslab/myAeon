"use client";
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import BirthDetailsForm, { type BirthFormProps } from './BirthDetailsForm';
import type { ReadingPayload } from './types';
type Props = BirthFormProps & { open: boolean; error: string | null; reading: ReadingPayload | null; flat: boolean; onClose: () => void; onViewChange: (flat: boolean) => void; onViewReading: () => void; onHowItWorks: () => void };
export default function MobileReadingDrawer({ open, error, reading, flat, onClose, onViewChange, onViewReading, onHowItWorks, ...form }: Props) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button')?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, [open]);
  return <AnimatePresence>{open && <>
    <motion.button type="button" aria-label="Close reading drawer" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden" />
    <motion.aside ref={panel} role="dialog" aria-modal="true" aria-label="Birth details" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-x-0 bottom-0 z-50 max-h-[88svh] overflow-y-auto rounded-t-3xl border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-[var(--app-text)] backdrop-blur-2xl md:hidden" onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary');
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-light gold-text">Your Cosmos</h2><button type="button" onClick={onClose} aria-label="Close birth details" className="h-11 w-11 rounded-full border border-[var(--panel-border)]">×</button></div>
      <BirthDetailsForm {...form} />
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      {reading && <button type="button" onClick={onViewReading} className="mt-4 min-h-12 w-full rounded-lg border border-[var(--panel-border)]">Open reading</button>}
      <div className="mt-4 flex gap-2"><button type="button" onClick={() => onViewChange(!flat)} className="min-h-11 flex-1 rounded-lg border border-[var(--panel-border)]">{flat ? 'Switch to 3D' : 'Switch to flat'}</button><button type="button" onClick={onHowItWorks} className="min-h-11 flex-1 text-sm text-astral-cyan">How this works</button></div>
    </motion.aside>
  </>}</AnimatePresence>;
}
