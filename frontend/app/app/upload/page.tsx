'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUploadBox } from '@/components/upload/FileUploadBox';
import { JobOptionSelector } from '@/components/upload/JobOptionSelector';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { analyzeDocument, getDemo } from '@/lib/api';
import { saveResult } from '@/lib/resultCache';
import { useAppStore } from '@/lib/store';
import type { AnalysisResult } from '@/lib/types';

const stages = ['업로드 완료', '공고 분석', '결과 생성', '다음 단계 준비'];

interface GeneratedOutput {
  title: string;
  summary: string;
  checklist: string[];
  missingQuestions: string[];
  href: string;
  sourceLabel: string;
}

function buildOutput(result: AnalysisResult, href = `/result/${result.id}`, sourceLabel = '서버 분석 결과'): GeneratedOutput {
  return {
    title: result.title,
    summary: result.summary,
    checklist: result.checklist.slice(0, 4).map((item) => item.label),
    missingQuestions: result.missing_questions.slice(0, 3).map((item) => item.question),
    href,
    sourceLabel,
  };
}

function localFallbackOutput(fileName: string): GeneratedOutput {
  return {
    title: fileName || '지원사업 신청 공고',
    summary: '백엔드 연결이 되지 않아 로컬 데모 결과를 표시합니다. 실제 연결 시 공고문에서 마감일, 자격, 제출 서류, 평가 기준과 근거 문장을 추출합니다.',
    checklist: ['참가 신청서', '사업계획서', '증빙 서류', '제출 전 확인 항목'],
    missingQuestions: ['팀의 핵심 강점과 증빙 가능한 성과는 무엇인가요?', '6개월 실행 계획과 주요 마일스톤이 있나요?'],
    href: '/app/documents/doc-001',
    sourceLabel: '로컬 데모 결과',
  };
}

export default function UploadPage() {
  const router = useRouter();
  const { setResult } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>(['공고문 요구사항 분석', '필수 입력 질문 만들기', '신청서 초안 작성']);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileName = selectedFile?.name ?? '';
  const currentStage = progress >= 100 ? 3 : progress >= 70 ? 2 : progress >= 35 ? 1 : fileName ? 0 : -1;
  const selectedSummary = useMemo(() => selected.join(' → '), [selected]);

  const runAgent = async () => {
    if (!selectedFile || running) return;

    setRunning(true);
    setError(null);
    setOutput(null);
    setProgress(22);

    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 86 ? value : value + 8));
    }, 360);

    try {
      let result: AnalysisResult | null = null;
      let sourceLabel = '서버 분석 결과';

      try {
        const response = await analyzeDocument(selectedFile);
        result = response.data;
      } catch {
        const demo = await getDemo();
        result = demo.data;
        sourceLabel = '데모 분석 결과';
      }

      saveResult(result);
      setResult(result);
      setOutput(buildOutput(result, `/result/${result.id}`, sourceLabel));
      setProgress(100);
    } catch (err) {
      const fallback = localFallbackOutput(selectedFile.name);
      setOutput(fallback);
      setError(err instanceof Error ? `${err.message} 로컬 데모 결과로 대신 표시합니다.` : '분석 서버에 연결하지 못해 로컬 데모 결과로 대신 표시합니다.');
      setProgress(100);
    } finally {
      window.clearInterval(timer);
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <FileUploadBox
        fileName={fileName}
        onFile={(file) => {
          setSelectedFile(file);
          setProgress(18);
          setOutput(null);
          setError(null);
        }}
      />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#273044]">업로드 후 실행할 작업</h2>
            <p className="mt-2 text-sm text-[#7B8190]">공고 분석부터 신청서 초안까지 필요한 단계를 선택하세요.</p>
          </div>
          <Button disabled={!selectedFile || selected.length === 0 || running} onClick={runAgent}>
            {running ? 'AI Agent 실행 중' : 'AI Agent 실행'}
          </Button>
        </div>
        <div className="mt-5">
          <JobOptionSelector selected={selected} onChange={setSelected} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#273044]">처리 상태</h2>
            <p className="mt-2 text-sm text-[#7B8190]">
              {progress >= 100 ? '결과가 준비되었습니다. 아래 생성 결과에서 다음 단계로 이동하세요.' : selectedFile ? selectedSummary : '공고문을 먼저 선택해 주세요.'}
            </p>
          </div>
          <span className="text-sm font-bold text-[#5263E8]">{progress}%</span>
        </div>
        <div className="mt-5">
          <Progress value={progress} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {stages.map((stage, index) => (
            <div key={stage} className={['rounded-[20px] border p-4 text-sm font-semibold', index <= currentStage ? 'border-[#D8DDFC] bg-[#EEF2FF] text-[#5263E8]' : 'border-[#ECECF1] bg-[#FBFBFD] text-[#9AA1AD]'].join(' ')}>
              {stage}
            </div>
          ))}
        </div>
      </Card>

      {output ? (
        <Card className="border-[#D8DDFC] bg-[#FBFBFD]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[#5263E8]">생성 결과 · {output.sourceLabel}</p>
              <h2 className="mt-2 text-2xl font-bold text-[#273044]">{output.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6B7280]">{output.summary}</p>
              {error ? <p className="mt-3 text-sm font-semibold text-amber-700">{error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push(output.href)}>결과 열기</Button>
              <Link href="/app/documents" className="inline-flex items-center justify-center rounded-full border border-[#ECECF1] bg-white px-5 py-2.5 text-sm font-semibold text-[#273044]">
                문서 목록 보기
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-[#ECECF1] bg-white p-5">
              <h3 className="font-bold text-[#273044]">제출 준비 체크리스트</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#6B7280]">
                {output.checklist.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="rounded-[22px] border border-[#ECECF1] bg-white p-5">
              <h3 className="font-bold text-[#273044]">사용자에게 물어볼 정보</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#6B7280]">
                {output.missingQuestions.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
