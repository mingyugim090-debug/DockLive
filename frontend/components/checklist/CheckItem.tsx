'use client';

import { motion } from 'framer-motion';
import type { ChecklistItem as CItem } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { Tooltip } from './Tooltip';
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.25 }}
      className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200"
      style={{
        borderColor: isChecked ? 'rgba(124,111,247,0.3)' : 'rgba(255,255,255,0.07)',
        background: isChecked ? 'rgba(124,111,247,0.05)' : 'transparent',
      }}
      onClick={() => toggleCheck(item.id)}
      onMouseEnter={(e) => {
        if (!isChecked) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124,111,247,0.2)';
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isChecked) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }
      }}
    >
      {/* 체크박스 */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 mt-0.5"
        style={{
          background: isChecked ? '#7C6FF7' : 'transparent',
          borderColor: isChecked ? '#7C6FF7' : 'rgba(255,255,255,0.2)',
        }}
      >
        {isChecked && (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-3 h-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </motion.svg>
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip description={item.description} fileFormat={item.file_format}>
            <span
              className={`text-sm font-semibold transition-colors ${
                isChecked ? 'line-through' : ''
              }`}
              style={{ color: isChecked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)' }}
            >
              {item.label}
            </span>
          </Tooltip>

          <Badge variant={isRequired ? 'required' : 'optional'}>
            {isRequired ? '필수' : '선택'}
          </Badge>

          {item.file_format && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
            >
              {item.file_format}
            </span>
          )}
        </div>

        {item.description && (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {item.description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
