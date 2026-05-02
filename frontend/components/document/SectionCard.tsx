'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { DocumentSection } from '@/lib/types';

interface SectionCardProps {
  section: DocumentSection;
  index: number;
  colorBg: string;
  colorText: string;
}

export function SectionCard({ section, index, colorBg, colorText }: SectionCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(section.hint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="group flex gap-4 rounded-xl border border-white/7 bg-white/3 p-4 transition hover:border-white/20"
    >
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ background: colorBg, color: colorText }}>
        {section.order}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-sm font-semibold text-text">{section.title}</span>
        <p className="text-xs leading-relaxed text-text2">{section.hint}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="self-start rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-text2 opacity-0 transition group-hover:opacity-100"
      >
        {copied ? '복사됨' : '힌트 복사'}
      </button>
    </motion.div>
  );
}
