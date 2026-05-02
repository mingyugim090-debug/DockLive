'use client';

import { motion } from 'framer-motion';
import type { TimelineItem as TItem } from '@/lib/types';
import { TimelineItem } from './TimelineItem';

interface TimelineProps {
  items: TItem[];
}

export function Timeline({ items }: TimelineProps) {
  const today = new Date().toISOString().split('T')[0];
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const firstFutureIdx = sorted.findIndex((item) => item.date >= today);

  if (sorted.length === 0) {
    return <div className="py-10 text-center text-text2">추출된 일정 정보가 없습니다.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      {sorted.map((item, index) => {
        const showTodayMarker = firstFutureIdx > 0 && index === firstFutureIdx;
        return (
          <div key={item.id}>
            {showTodayMarker && (
              <div className="mb-2 ml-1.5 flex items-center gap-3">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                <div className="h-px flex-1 bg-primary/30" />
                <span className="text-xs font-bold text-primary">오늘</span>
              </div>
            )}
            <TimelineItem item={item} index={index} isLast={index === sorted.length - 1} />
          </div>
        );
      })}
    </motion.div>
  );
}
