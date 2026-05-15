'use client';

import { useState } from 'react';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { Card } from '@/components/ui/Card';
import { mockTemplates } from '@/data/mockTemplates';

export default function TemplatesPage() {
  const [selected, setSelected] = useState('tpl-report');

  return (
    <div className="space-y-6">
      <Card className="bg-[#EEF2FF]">
        <h2 className="text-2xl font-bold text-[#273044]">템플릿을 선택해 문서 구조를 자동으로 정리하세요.</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">회의록, 보고서, 기획서, 공문서처럼 반복되는 문서 구조를 빠르게 적용할 수 있습니다.</p>
      </Card>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {mockTemplates.map((template) => (
          <TemplateCard key={template.id} template={template} selected={selected === template.id} onSelect={() => setSelected(template.id)} />
        ))}
      </div>
    </div>
  );
}
