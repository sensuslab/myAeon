"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { CircleHelp, ShieldCheck } from "lucide-react";
import type { ThemeMode } from "./types";

type Props = {
  sunSign?: { name: string; symbol: string } | null;
  currentTime?: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenTour: () => void;
};

export default function AppHeader({ sunSign, currentTime, theme, onToggleTheme, onOpenTour }: Props) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed top-0 left-0 right-0 z-30 flex items-start justify-between gap-3 px-4 py-3 md:items-center md:px-8 md:py-4 pointer-events-none"
    >
      <div className="flex items-center gap-3 pointer-events-auto">
        <div>
          <div className="hidden text-[10px] uppercase tracking-[0.4em] text-astral-cyan/70 sm:block">
            Cosmic Astrological Guide
          </div>
          <Image
            className="aeon-header-wordmark"
            src="/brand/my-aeon-wordmark.png"
            alt="myAeon"
            width={1456}
            height={449}
            sizes="(max-width: 640px) 7.5rem, 9.5rem"
            priority
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto md:gap-5">
        <Link href="/privacy" title="Privacy policy" aria-label="Privacy policy" className="grid h-11 w-11 place-items-center rounded-lg glass text-astral-gold"><ShieldCheck size={18} /></Link>
        <button type="button" onClick={onOpenTour} aria-label="Quick tour" title="Quick tour" className="grid h-11 w-11 place-items-center rounded-lg glass text-astral-gold"><CircleHelp size={18} /></button>
        <div className="hidden md:flex items-center gap-6 text-xs text-white/50">
          {currentTime && (
            <span className="tabular-nums tracking-wider">{currentTime}</span>
          )}
          {sunSign && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full glass">
              <span className="text-astral-cyan text-base leading-none">{sunSign.symbol}</span>
              <span className="text-white/80">{sunSign.name}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextTheme} mode`}
          title={`Switch to ${nextTheme} mode`}
          className="group grid h-10 w-10 place-items-center rounded-full glass text-base text-astral-gold transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-astral-cyan/40 md:h-9 md:w-9"
        >
          <span className="relative grid h-5 w-5 place-items-center rounded-full border border-astral-gold/40 bg-astral-gold/10 leading-none shadow-[0_0_18px_rgba(212,164,55,0.2)] transition group-hover:scale-105">
            {theme === "dark" ? "☼" : "☾"}
          </span>
        </button>
      </div>
    </motion.header>
  );
}
