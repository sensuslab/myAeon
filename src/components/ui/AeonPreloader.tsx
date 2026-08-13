"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ThemeMode } from "./types";

type Props = {
  ready: boolean;
  theme: ThemeMode;
};

const ENTER_EASE = [0.22, 1, 0.36, 1] as const;

export default function AeonPreloader({ ready, theme }: Props) {
  const reduceMotion = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceExit, setForceExit] = useState(false);
  const [visible, setVisible] = useState(true);
  const iconSrc =
    theme === "light"
      ? "/icons/aeon-icon-light-512.png"
      : "/icons/aeon-icon-dark-512.png";

  useEffect(() => {
    const minTimer = window.setTimeout(
      () => setMinElapsed(true),
      reduceMotion ? 300 : 1750
    );
    const maxTimer = window.setTimeout(
      () => setForceExit(true),
      reduceMotion ? 700 : 4200
    );

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if ((ready && minElapsed) || forceExit) {
      setVisible(false);
    }
  }, [forceExit, minElapsed, ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          className="aeon-preloader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: {
              duration: reduceMotion ? 0.12 : 0.28,
              ease: ENTER_EASE,
            },
          }}
        >
          <div className="aeon-preloader-stars" aria-hidden="true" />

          <motion.div
            className="aeon-preloader-mark"
            initial={{
              opacity: 0,
              y: reduceMotion ? 0 : 10,
              scale: reduceMotion ? 1 : 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: reduceMotion ? 0.01 : 0.62,
                ease: ENTER_EASE,
              },
            }}
          >
            <div className="aeon-preloader-icon-wrap" aria-hidden="true">
              <span className="aeon-preloader-orbit aeon-preloader-orbit-a" />
              <span className="aeon-preloader-orbit aeon-preloader-orbit-b" />
              <Image
                className="aeon-preloader-icon"
                src={iconSrc}
                alt=""
                width={512}
                height={512}
                sizes="(max-width: 768px) 34vw, 9rem"
                priority
              />
            </div>

            <Image
              className="aeon-preloader-wordmark"
              src="/brand/my-aeon-wordmark.png"
              alt="myAeon"
              width={1456}
              height={449}
              sizes="(max-width: 768px) 78vw, 28rem"
              priority
            />

            <div className="aeon-preloader-line" aria-hidden="true">
              <span />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
