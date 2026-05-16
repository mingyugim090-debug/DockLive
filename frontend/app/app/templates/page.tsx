'use client';

import { useState } from 'react';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateWorkflowPanel } from '@/components/templates/TemplateWorkflowPanel';
import { Card } from '@/components/ui/Card';
import { mockDocuments } from '@/data/mockDocuments';
import { mockTemplates } from '@/data/mockTemplates';

export default function TemplatesPage() {
  const [selected, setSelected] = useState('tpl-report');
  const selectedTemplate = mockTemplates.find((template) => template.id === selected) ?? mockTemplates[0];

  const scrollToWorkflow = () => {
    window.setTimeout(() => {
      document.getElementById('template-workflow-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#EEF2FF]">
        <h2 className="text-2xl font-bold text-[#273044]">템플릿을 선택하고, 문서 생성 워크플로우까지 이어가세요.</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
          각 템플릿은 단순한 보기용 카드가 아니라 기존 문서 선택, 작성 방향 입력, 결과 생성으로 이어지는 작업 흐름을 가집니다.
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="grid gap-5 md:grid-cols-2">
          {mockTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selected === template.id}
              onSelect={() => setSelected(template.id)}
              onStart={scrollToWorkflow}
            />
          ))}
        </div>
        <TemplateWorkflowPanel template={selectedTemplate} documents={mockDocuments} />
      </div>
    </div>
  );
}
