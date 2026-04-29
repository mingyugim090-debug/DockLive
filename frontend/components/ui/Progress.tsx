'use client';

import { motion } from 'framer-motion';

interface ProgressProps {
  value: number; // 0~100
  label?: string;
  sublabel?: string;
}

export function Progress({ value, label, sublabel }: ProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      {(label || sublabel) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="text-text2">{label}</span>}
          {sublabel && <span className="font-bold" style={{ color: '#B89EFF' }}>{sublabel}</span>}
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #7C6FF7, #B89EFF)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
