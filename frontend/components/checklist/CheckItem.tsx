'use client';

import { motion } from 'framer-motion';
import type { ChecklistItem as CItem } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';

interface CheckItemProps {
  item: CItem;
  index: number;
}

export function CheckItem({ item, index }: CheckItemProps) {
  const { checkedItems, toggleCheck } = useAppStore();
  const isChecked = checkedItems.has(item.id);
  const isRequired = item.category === 'required';

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={() => toggleCheck(item.id)}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
        isChecked ? 'border-primary/30 bg-primary/5' : 'border-white/7 bg-transparent hover:border-white/20 hover:bg-white/3'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 text-xs ${
          isChecked ? 'border-primary bg-primary text-white' : 'border-white/20 text-transparent'
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${isChecked ? 'text-text3 line-through' : 'text-text'}`}>
            {item.label}
          </span>
          <Badge variant={isRequired ? 'required' : 'optional'}>{isRequired ? '필수' : '선택'}</Badge>
          {item.file_format && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-text2">
              {item.file_format}
            </span>
          )}
        </span>
        {item.description && <span className="mt-1.5 block text-xs leading-relaxed text-text2">{item.description}</span>}
      </span>
    </motion.button>
  );
}
