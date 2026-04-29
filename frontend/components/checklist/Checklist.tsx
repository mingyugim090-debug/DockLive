'use client';

import { motion } from 'framer-motion';
import type { ChecklistItem as CItem } from '@/lib/types';
import { CheckItem } from './CheckItem';
import { Progress } from '@/components/ui/Progress';
import { useAppStore } from '@/lib/store';

interface ChecklistProps {
  items: CItem[];
}

export function Checklist({ items }: ChecklistProps) {
  const { checkedItems } = useAppStore();

  const required = items.filter((i) => i.category === 'required');
  const optional = items.filter((i) => i.category === 'optional');
  const checkedCount = items.filter((i) => checkedItems.has(i.id)).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  if (items.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <p className="text-4xl mb-3">✅</p>
        <p>추출된 서류 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-5"
    >
      {/* 진행률 */}
      <div
        className="p-4 rounded-xl"
        style={{ background: 'rgba(124,111,247,0.06)', border: '1px solid rgba(124,111,247,0.15)' }}
      >
        <Progress
          value={progress}
          label="준비 완료"
          sublabel={`${checkedCount} / ${items.length}`}
        />
        {checkedCount === items.length && items.length > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs mt-2 font-semibold text-center"
            style={{ color: '#4ADE80' }}
          >
            🎉 모든 서류 준비 완료!
          </motion.p>
        )}
      </div>

      {/* 필수 서류 */}
      {required.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
            📋 필수 서류 ({required.length})
          </h3>
          <div className="flex flex-col gap-2">
            {required.map((item, i) => (
              <CheckItem key={item.id} item={item} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* 선택 서류 */}
      {optional.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
            📂 선택 서류 ({optional.length})
          </h3>
          <div className="flex flex-col gap-2">
            {optional.map((item, i) => (
              <CheckItem key={item.id} item={item} index={required.length + i} />
            ))}
          </div>
        </div>
      )}

      {/* 안내 */}
      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
        💡 항목 이름을 클릭하면 상세 설명을 볼 수 있습니다
      </p>
    </motion.div>
  );
}
