"use client";

import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * "How This Works" transparency section — describes what the AI does,
 * what it doesn't do, and where the data comes from.
 */
export default function HowItWorksModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 22 }}
            className="fixed top-1/2 left-1/2 z-50 max-h-[82svh] w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto glass-strong rounded-2xl p-5 md:p-8"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-astral-cyan/80">
                  Transparency
                </p>
                <h2 className="text-2xl font-light gold-text mt-1">How This Works</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full glass hover:bg-white/10 transition flex items-center justify-center text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-white/85 leading-relaxed">
              <Section title="What you&apos;re seeing">
                A live 3D model of our solar system. The Sun provides the main
                light while a soft celestial fill keeps each planet legible.
                The positions of the planets are calculated using the <code className="text-astral-cyan">astronomy-engine</code> library
                from your current time and date, so the scene is a faithful
                snapshot of the real solar system right now.
              </Section>

              <Section title="Where the reading comes from">
                When you submit your birth date, Aeon sends a single
                privacy-preserving request to <code className="text-astral-cyan">api.deepseek.com</code> using the
                DeepSeek V4 Pro language model. The model is asked to write a
                structured reading across four life domains (love, purpose,
                body, inner world), four time horizons (today, three days,
                this week, this month), and a personal note for each visible
                planet. The response is parsed and rendered in the right-hand
                panel.
              </Section>

              <Section title="What Aeon is careful about">
                The model is instructed to write poetically and specifically,
                but never to make deterministic life claims. It will not
                predict medical outcomes, deaths, lottery wins, or relationship
                outcomes. It frames everything as an invitation to reflection,
                not a forecast. If you are in distress, please reach out to a
                qualified human — a therapist, a doctor, a trusted friend.
              </Section>

              <Section title="Your data">
                Your birth date, time, and place are sent to the model only
                for the duration of the request. Nothing is logged or stored.
                The <code className="text-astral-cyan">DEEPSEEK_API_KEY</code> lives only on the server, never in your browser.
                No tracking, no analytics, no cookies.
              </Section>

              <Section title="The source">
                The 3D scene uses React Three Fiber on top of three.js. The
                planetary positions are computed via the open-source
                astronomy-engine (Don Cross, MIT licensed). The reading model
                is DeepSeek V4 Pro (DeepSeek).
              </Section>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm uppercase tracking-widest text-white/80"
            >
              Close
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-astral-gold text-[11px] uppercase tracking-widest mb-2">
        {title}
      </h3>
      <p>{children}</p>
    </div>
  );
}
