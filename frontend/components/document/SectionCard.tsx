'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { DocumentSection, DocType } from '@/lib/types';

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
      transition={{ delay: index * 0.07, duration: 0.25 }}
      className="group flex gap-4 p-4 rounded-xl border transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.14)';
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.035)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
      }}
    >
      {/* 번호 */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
        style={{ background: colorBg, color: colorText }}
      >
        {section.order}
      </div>

      {/* 내용 */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <span className="text-text font-semibold text-sm">{section.title}</span>
        <p className="text-text2 text-xs leading-relaxed">{section.hint}</p>
      </div>

      {/* 힌트 복사 버튼 */}
      <button
        onClick={handleCopy}
        className="flex-shrink-0 self-start mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-lg"
        style={{
          background: copied ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
          color: copied ? '#4ADE80' : 'rgba(255,255,255,0.4)',
          border: `1px solid ${copied ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.1)'}`,
        }}
        title="힌트 복사"
      >
        {copied ? '✓' : '복사'}
      </button>
    </motion.div>
  );
}
