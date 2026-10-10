"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';
import BirthDetailsForm, { type BirthFormProps } from './BirthDetailsForm';
export type { BirthInput } from './BirthDetailsForm';
type Props = BirthFormProps & { onViewChange: (flat: boolean) => void; flat: boolean; onHowItWorks: () => void };
export default function ControlPanel({ onViewChange, flat, onHowItWorks, ...form }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return <motion.aside initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="birth-panel fixed bottom-24 left-4 top-20 z-20 w-80 pointer-events-none">
    <div className="glass-strong h-full overflow-y-auto rounded-2xl p-5 pointer-events-auto scrollbar-hide">
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.3em] text-astral-cyan/80">Birth details</p><h2 className="text-lg font-light gold-text">Your Cosmos</h2></div><button type="button" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} aria-expanded={!collapsed} className="h-11 w-11 rounded-full glass">{collapsed ? '▸' : '◂'}</button></div>
      {!collapsed && <><BirthDetailsForm {...form} /><div className="mt-4 flex gap-2 border-t border-[var(--panel-border)] pt-4"><button type="button" onClick={() => onViewChange(!flat)} className="min-h-11 flex-1 rounded-lg border border-[var(--panel-border)] text-sm">{flat ? 'Switch to 3D' : 'Switch to flat'}</button><button type="button" onClick={onHowItWorks} className="min-h-11 flex-1 text-sm text-astral-cyan">How this works</button></div></>}
    </div>
  </motion.aside>;
}
