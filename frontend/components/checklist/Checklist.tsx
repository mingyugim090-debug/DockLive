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

  const required = items.filter((item) => item.category === 'required');
  const optional = items.filter((item) => item.category === 'optional');
  const checkedCount = items.filter((item) => checkedItems.has(item.id)).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-text2">
        <p>추출된 제출 서류 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <Progress value={progress} label="준비 완료" sublabel={`${checkedCount} / ${items.length}`} />
      </div>

      {required.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text2">필수 서류 ({required.length})</h3>
          {required.map((item, index) => (
            <CheckItem key={item.id} item={item} index={index} />
          ))}
        </div>
      )}

      {optional.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text2">선택 서류 ({optional.length})</h3>
          {optional.map((item, index) => (
            <CheckItem key={item.id} item={item} index={required.length + index} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
