'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateWorkflowPanel } from '@/components/templates/TemplateWorkflowPanel';
import { Card } from '@/components/ui/Card';
import { mockDocuments } from '@/data/mockDocuments';
import { mockTemplates } from '@/data/mockTemplates';
import type { OutputFormat, WorkflowTaskId } from '@/data/workspaceTasks';
import { savePendingTemplate } from '@/lib/workflow/workflowStore';

const templateTaskMap: Record<string, { taskId: WorkflowTaskId; outputFormat: OutputFormat; instructionHint: string }> = {
  'tpl-meeting': {
    taskId: 'minutes',
    outputFormat: 'Markdown',
    instructionHint: '회의 목적, 참석자, 강조할 결정사항을 입력하세요.',
  },
  'tpl-report': {
    taskId: 'report',
    outputFormat: 'Markdown',
    instructionHint: '보고 목적, 대상 독자, 강조할 결론을 입력하세요.',
  },
  'tpl-plan': {
    taskId: 'plan',
    outputFormat: 'HWPX',
    instructionHint: '대상 사용자, 핵심 문제, 실행 계획을 입력하세요.',
  },
  'tpl-assignment': {
    taskId: 'report',
    outputFormat: 'Markdown',
    instructionHint: '과제 주제, 분량, 반드시 포함할 참고 자료를 입력하세요.',
  },
  'tpl-official': {
    taskId: 'official',
    outputFormat: 'HWPX',
    instructionHint: '수신 기관, 요청 목적, 포함해야 할 첨부 항목을 입력하세요.',
  },
  'tpl-slide': {
    taskId: 'custom',
    outputFormat: 'Markdown',
    instructionHint: '청중, 발표 시간, 꼭 강조할 메시지를 입력하세요.',
  },
};

export default function TemplatesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState('tpl-report');
  const selectedTemplate = mockTemplates.find((template) => template.id === selected) ?? mockTemplates[0];

  const startTemplateWorkflow = (templateId: string) => {
    const template = mockTemplates.find((item) => item.id === templateId) ?? mockTemplates[0];
    const mapping = templateTaskMap[template.id] ?? templateTaskMap['tpl-report'];
    savePendingTemplate({
      templateId: template.id,
      templateName: template.name,
      taskId: mapping.taskId,
      outputFormat: mapping.outputFormat,
      instructionHint: mapping.instructionHint,
    });
    router.push('/app');
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
              onStart={() => startTemplateWorkflow(template.id)}
            />
          ))}
        </div>
        <TemplateWorkflowPanel template={selectedTemplate} documents={mockDocuments} />
      </div>
    </div>
  );
}
