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
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="flex gap-4"
    >
      {/* 타임라인 선 + 마커 */}
      <div className="flex flex-col items-center">
        <motion.div
          animate={
            isDanger
              ? { scale: [1, 1.3, 1], boxShadow: [`0 0 0 0 ${style.text}40`, `0 0 0 8px transparent`] }
              : {}
          }
          transition={isDanger ? { duration: 1.5, repeat: Infinity } : {}}
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ background: style.text, border: `2px solid ${style.border}` }}
        />
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
        )}
      </div>

      {/* 내용 */}
      <div className={`pb-6 flex-1 ${isLast ? '' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-text font-semibold text-sm leading-snug">{item.label}</span>
            <span className="text-text2 text-xs">{formatDate(item.date)}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {item.is_deadline && (
              <span
                className="text-xs px-2 py-0.5 rounded-md font-semibold"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}
              >
                마감
              </span>
            )}
            <span
              className="text-xs px-2.5 py-1 rounded-lg font-bold"
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
