'use client';

import { motion } from 'framer-motion';
import type { TimelineItem as TItem } from '@/lib/types';
import { TimelineItem } from './TimelineItem';

interface TimelineProps {
  items: TItem[];
}

export function Timeline({ items }: TimelineProps) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 오늘 날짜 기준으로 정렬 (passed 먼저, 그 다음 upcoming)
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  // 오늘 이후 첫 번째 미래 항목 인덱스 찾기
  const firstFutureIdx = sorted.findIndex((item) => item.date >= today);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <p className="text-4xl mb-3">📅</p>
        <p>추출된 일정 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col"
    >
      {sorted.map((item, i) => {
        // 오늘 기준선 삽입: 첫 미래 항목 바로 앞
        const showTodayMarker = firstFutureIdx > 0 && i === firstFutureIdx;

        return (
          <div key={item.id}>
            {showTodayMarker && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: i * 0.1 + 0.05, duration: 0.3 }}
                className="flex items-center gap-3 mb-2 ml-1.5"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#7C6FF7', boxShadow: '0 0 6px #7C6FF780' }} />
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(124,111,247,0.6), transparent)' }} />
                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#B89EFF' }}>오늘</span>
              </motion.div>
            )}
            <TimelineItem
              item={item}
              index={i}
              isLast={i === sorted.length - 1}
            />
          </div>
        );
      })}
    </motion.div>
  );
}
