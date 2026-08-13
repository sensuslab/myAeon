"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReadingPayload } from "./types";

type Props = {
  hidden: boolean;
  loading: boolean;
  reading: ReadingPayload | null;
  onOpenDrawer: () => void;
  onOpenReading: () => void;
};

export default function MobileBottomActions({
  hidden,
  loading,
  reading,
  onOpenDrawer,
  onOpenReading,
}: Props) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:hidden"
        >
          {reading ? (
            <div className="mx-auto flex max-w-sm gap-2 rounded-[1.35rem] border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] p-2 shadow-[var(--panel-shadow)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={onOpenDrawer}
                className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/80 transition active:scale-[0.98]"
              >
                Details
              </button>
              <button
                type="button"
                onClick={onOpenReading}
                className="h-12 flex-[1.25] rounded-2xl bg-gradient-to-r from-astral-gold to-astral-bronze px-4 text-sm font-semibold text-astral-deep shadow-lg shadow-astral-gold/20 transition active:scale-[0.98]"
              >
                Reading
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenDrawer}
              disabled={loading}
              className="mx-auto flex h-14 w-full max-w-sm items-center justify-center rounded-[1.35rem] bg-gradient-to-r from-astral-gold to-astral-bronze px-6 text-base font-semibold text-astral-deep shadow-[0_18px_45px_rgba(212,164,55,0.26)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Casting..." : "Cast reading"}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
