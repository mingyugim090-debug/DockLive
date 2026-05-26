'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, Textarea } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import type { MockDocument, MockTemplate } from '@/data/types';

const stages = ['템플릿 선택', '문서 선택', '작성 방향 입력', '결과 생성'];

export function TemplateWorkflowPanel({
  template,
  documents,
}: {
  template: MockTemplate;
  documents: MockDocument[];
}) {
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? '');
  const [request, setRequest] = useState('');
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const selectedDocument = useMemo(() => documents.find((document) => document.id === documentId) ?? documents[0], [documentId, documents]);

  useEffect(() => {
    setProgress(0);
    setRunning(false);
    setCompleted(false);
    setRequest('');
  }, [template.id]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          window.clearInterval(timer);
          setRunning(false);
          setCompleted(true);
          return 100;
        }
        return value + 12;
      });
    }, 360);
    return () => window.clearInterval(timer);
  }, [running]);

  const currentStage = progress >= 100 ? 3 : progress >= 66 ? 2 : progress >= 30 ? 1 : 0;
  const canRun = Boolean(selectedDocument && request.trim().length >= 8);

  return (
    <Card id="template-workflow-panel" className="scroll-mt-24 xl:sticky xl:top-24 xl:h-fit">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#5263E8]">Template workflow</p>
          <h2 className="mt-2 text-xl font-bold text-[#273044]">{template.name} 사용하기</h2>
          <p className="mt-2 text-sm leading-6 text-[#7B8190]">{template.useCase}</p>
        </div>
      </div>

      <div className="mt-6 rounded-[22px] bg-[#FBFBFD] p-4">
        <p className="text-xs font-bold text-[#8A91A0]">이 워크플로우의 목적</p>
        <p className="mt-2 text-sm leading-6 text-[#273044]">{template.sampleResult}</p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-[#6B7280]">
          기준 문서 선택
          <Select className="mt-2" value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm font-semibold text-[#6B7280]">
          작성 방향
          <Textarea
            className="mt-2 min-h-[110px]"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="예: 공고 평가 기준에 맞춰 사업계획서 초안을 만들고, 팀 강점과 실행 계획을 자연스럽게 반영해 주세요."
          />
        </label>

        <Button
          className="w-full"
          disabled={!canRun || running}
          onClick={() => {
            setCompleted(false);
            setProgress(18);
            setRunning(true);
          }}
        >
          {running ? '문서 생성 중' : '선택한 템플릿으로 문서 만들기'}
        </Button>
      </div>

      <div className="mt-6">
        <Progress value={progress} label={completed ? '결과 생성 완료' : running ? '템플릿 적용 중' : '대기 중'} sublabel={`${progress}%`} />
      </div>

      <div className="mt-5 grid gap-2">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className={[
              'flex items-center gap-3 rounded-[18px] border p-3 text-sm font-semibold',
              index <= currentStage ? 'border-[#D8DDFC] bg-[#EEF2FF] text-[#5263E8]' : 'border-[#ECECF1] bg-white text-[#8A91A0]',
            ].join(' ')}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs">{index + 1}</span>
            {stage}
          </div>
        ))}
      </div>

      {completed ? (
        <div className="mt-6 rounded-[22px] border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-800">생성 결과가 준비되었습니다.</p>
          <p className="mt-2 text-sm leading-6 text-emerald-700">
            {selectedDocument?.name}에 {template.name} 구조를 적용했습니다. 실제 제품에서는 이 결과가 문서 상세의 초안 검토, 확인 필요 주장, HWPX export 단계로 저장됩니다.
          </p>
          <div className="mt-4 rounded-[18px] bg-white p-4">
            <p className="text-sm font-bold text-[#273044]">생성된 초안 구성</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[#6B7280]">
              {template.workflow.map((step) => <li key={step}>- {step}</li>)}
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/app/documents/${selectedDocument?.id ?? 'doc-001'}`} className="inline-flex items-center justify-center rounded-full bg-[#5263E8] px-5 py-2.5 text-sm font-semibold text-white">
              문서 상세에서 이어가기
            </Link>
            <Link href="/app/upload" className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800">
              새 공고문 업로드
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
