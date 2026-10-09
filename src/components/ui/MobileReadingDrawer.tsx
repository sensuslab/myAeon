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
    <motion.aside ref={panel} role="dialog" aria-modal="true" aria-label="Birth details" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88svh] flex-col overflow-hidden rounded-t-3xl border border-[var(--panel-border)] bg-[var(--app-bg)] text-[var(--app-text)] md:hidden" onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary');
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] px-5 py-3"><h2 className="text-xl font-light gold-text">Your Cosmos</h2><button type="button" onClick={onClose} aria-label="Close birth details" className="h-11 w-11 rounded-full border border-[var(--panel-border)]">×</button></div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
      <BirthDetailsForm {...form} formId="mobile-birth-details" hideSubmit />
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      {reading && <button type="button" onClick={onViewReading} className="mt-4 min-h-12 w-full rounded-lg border border-[var(--panel-border)]">Open reading</button>}
      <div className="mt-4 flex gap-2"><button type="button" onClick={() => onViewChange(!flat)} className="min-h-11 flex-1 rounded-lg border border-[var(--panel-border)]">{flat ? 'Switch to 3D' : 'Switch to flat'}</button><button type="button" onClick={onHowItWorks} className="min-h-11 flex-1 text-sm text-astral-cyan">How this works</button></div>
      </div>
      <div className="shrink-0 border-t border-[var(--panel-border)] bg-[var(--app-bg)] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button type="submit" form="mobile-birth-details" disabled={form.loading || form.confirming || !form.input.birthDate} className="h-14 w-full rounded-lg bg-[#d4a437] px-3 text-base font-semibold text-[#15120b] disabled:opacity-60">{form.loading ? 'Reading the stars…' : 'Cast my reading'}</button>
      </div>
    </motion.aside>
  </>}</AnimatePresence>;
}
