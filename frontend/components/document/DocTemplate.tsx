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
    return <div className="py-10 text-center text-text2">문서 작성 항목이 없습니다.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: color.bg, borderColor: `${color.text}25` }}>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${color.text}22`, color: color.text }}>
          {getDocTypeLabel(docType)}
        </span>
        <span className="text-sm text-text2">Agent가 이 구조를 기준으로 초안을 작성합니다.</span>
        <span className="ml-auto text-xs text-text2">{sorted.length}개 섹션</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {sorted.map((section, index) => (
          <SectionCard key={section.id} section={section} index={index} colorBg={color.bg} colorText={color.text} />
        ))}
      </div>
    </motion.div>
  );
}
