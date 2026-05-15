'use client';

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
    <Card className="sticky top-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#5263E8]">Template workflow</p>
          <h2 className="mt-2 text-xl font-bold text-[#273044]">{template.name} 활용하기</h2>
          <p className="mt-2 text-sm leading-6 text-[#7B8190]">{template.useCase}</p>
        </div>
      </div>

      <div className="mt-6 rounded-[22px] bg-[#FBFBFD] p-4">
        <p className="text-xs font-bold text-[#8A91A0]">생성될 결과물</p>
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
            placeholder="예: 과제 주제는 생성형 AI 활용 사례이고, 3쪽 분량의 제출 초안과 참고 자료 요약이 필요합니다."
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
          선택한 템플릿으로 문서 만들기
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
          <p className="font-bold text-emerald-800">mock 결과가 생성되었습니다.</p>
          <p className="mt-2 text-sm leading-6 text-emerald-700">
            {selectedDocument?.name}을 기준으로 {template.name} 구조를 적용했습니다. 실제 연결 단계에서는 이 결과가 문서 상세의 자동 생성 결과와 다운로드 파일로 저장됩니다.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
