'use client';

import { motion } from 'framer-motion';
import type { TimelineItem as TItem } from '@/lib/types';
import { formatDate, formatDDay } from '@/lib/utils';

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  safe: {
    bg: 'rgba(74,222,128,0.12)',
    text: '#4ADE80',
    border: 'rgba(74,222,128,0.25)',
  },
  warning: {
    bg: 'rgba(251,191,36,0.12)',
    text: '#FBBF24',
    border: 'rgba(251,191,36,0.25)',
  },
  danger: {
    bg: 'rgba(248,113,113,0.12)',
    text: '#F87171',
    border: 'rgba(248,113,113,0.25)',
  },
  passed: {
    bg: 'rgba(255,255,255,0.05)',
    text: '#4A4A6A',
    border: 'rgba(255,255,255,0.08)',
  },
};

interface TimelineItemProps {
  item: TItem;
  index: number;
  isLast: boolean;
}

export function TimelineItem({ item, index, isLast }: TimelineItemProps) {
  const style = statusStyles[item.status] ?? statusStyles.safe;
  const isDanger = item.status === 'danger';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="flex gap-4"
    >
      <div className="flex flex-col items-center">
        <motion.div
          animate={isDanger ? { scale: [1, 1.25, 1] } : {}}
          transition={isDanger ? { duration: 1.5, repeat: Infinity } : {}}
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
          style={{ background: style.text, border: `2px solid ${style.border}` }}
        />
        {!isLast && <div className="mt-1 w-px flex-1 bg-white/7" />}
      </div>

      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold leading-snug text-text">{item.label}</span>
            <span className="text-xs text-text2">{formatDate(item.date)}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {item.is_deadline && (
              <span className="rounded-md bg-red-400/10 px-2 py-0.5 text-xs font-semibold text-red-300">
                마감
              </span>
            )}
            <span
              className="rounded-lg px-2.5 py-1 text-xs font-bold"
              style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
            >
              {formatDDay(item.d_day)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
