'use client';

import { motion } from 'framer-motion';
import type { DocumentSection, DocType } from '@/lib/types';
import { getDocTypeLabel } from '@/lib/utils';
import { SectionCard } from './SectionCard';

const docTypeColors: Record<DocType, { bg: string; text: string }> = {
  competition: { bg: 'rgba(124,111,247,0.15)', text: '#B89EFF' },
  research: { bg: 'rgba(59,130,246,0.15)', text: '#7DB9FF' },
  scholarship: { bg: 'rgba(74,222,128,0.15)', text: '#4ADE80' },
  startup: { bg: 'rgba(232,132,92,0.15)', text: '#F8A87C' },
};

interface DocTemplateProps {
  docType: DocType;
  sections: DocumentSection[];
}

export function DocTemplate({ docType, sections }: DocTemplateProps) {
  const color = docTypeColors[docType] ?? docTypeColors.competition;
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <p className="text-4xl mb-3">📝</p>
        <p>문서 구조 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4"
    >
      {/* 공고 유형 배너 */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: color.bg, border: `1px solid ${color.text}25` }}
      >
        <span
          className="text-xs px-2.5 py-1 rounded-full font-bold"
          style={{ background: `${color.text}22`, color: color.text }}
        >
          {getDocTypeLabel(docType)}
        </span>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          유형의 제출 문서 구조입니다
        </span>
        <span
          className="ml-auto text-xs"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {sorted.length}개 섹션
        </span>
      </div>

      {/* 힌트 안내 */}
      <p className="text-xs px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
        💡 각 섹션 카드에 마우스를 올리면 힌트를 복사할 수 있습니다
      </p>

      {/* 섹션 목록 */}
      <div className="flex flex-col gap-2.5">
        {sorted.map((section, i) => (
          <SectionCard
            key={section.id}
            section={section}
            index={i}
            colorBg={color.bg}
            colorText={color.text}
          />
        ))}
      </div>
    </motion.div>
  );
}
