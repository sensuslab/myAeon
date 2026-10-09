"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, BookOpen, Sparkles } from "lucide-react";
import type { ReadingPayload } from "./types";

type Props = {
  hidden: boolean;
  loading: boolean;
  reading: ReadingPayload | null;
  onOpenDrawer: () => void;
  onOpenReading: () => void;
  readingView: boolean;
  onTalk: () => void;
};

export default function MobileBottomActions({
  hidden,
  loading,
  reading,
  onOpenDrawer,
  onOpenReading,
  readingView,
  onTalk,
}: Props) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--panel-border)] bg-[var(--app-bg)] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
        >
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
            <button type="button" onClick={reading && !readingView ? onOpenReading : onOpenDrawer} disabled={loading} className="flex h-14 min-w-0 items-center justify-center gap-2 rounded-lg bg-[#d4a437] px-2 text-sm font-semibold text-[#15120b] transition active:scale-[0.98] disabled:opacity-60">
              {reading && !readingView ? <BookOpen size={18} className="shrink-0" /> : <Sparkles size={18} className="shrink-0" />}
              {loading ? "Casting..." : readingView ? "New reading" : reading ? "Reading" : "Cast reading"}
            </button>
            <button type="button" onClick={onTalk} className="flex h-14 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] px-2 text-sm font-medium text-[var(--app-text)] transition active:scale-[0.98]"><AudioLines size={18} className="shrink-0" />Talk to Zeus</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
