'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { mockDocuments } from '@/data/mockDocuments';
import type { MockDocument } from '@/data/types';
import { findStoredDocument } from '@/lib/workflow/workflowStore';

const tabs = ['요약', '핵심 키워드', '문서 구조', '생성 결과', '원본 미리보기'];

type ActionKey = 'summary' | 'report' | 'meeting' | 'template' | 'export';

const actionCopy: Record<ActionKey, { label: string; title: string; body: string; bullets: string[] }> = {
  summary: {
    label: '다시 요약하기',
    title: '요약본이 갱신되었습니다.',
    body: '공고문에서 신청 자격, 제출 서류, 접수 일정, 평가 기준을 우선순위 순서로 다시 정리했습니다.',
    bullets: ['중요 일정과 마감일을 상단에 배치', '필수 제출 서류와 선택 서류 분리', '확인 필요한 정보는 별도 표시'],
  },
  report: {
    label: '보고서로 변환',
    title: '보고서 초안이 생성되었습니다.',
    body: '문서 내용을 배경, 핵심 분석, 시사점, 제안 사항 흐름으로 재구성했습니다.',
    bullets: ['요약 문단 생성', '본문 목차 자동 구성', '근거가 약한 주장은 확인 필요로 표시'],
  },
  meeting: {
    label: '회의록으로 변환',
    title: '회의록 구조로 변환했습니다.',
    body: '논의 안건, 결정 사항, 후속 작업 항목으로 다시 정리했습니다.',
    bullets: ['안건별 요약', '결정 사항 분리', '담당자와 마감일 입력 필요 항목 표시'],
  },
  template: {
    label: '템플릿 적용',
    title: '신청서 템플릿 적용 결과입니다.',
    body: '지원사업 신청서 흐름에 맞춰 문제 정의, 솔루션, 실행 계획, 팀 역량 섹션을 만들었습니다.',
    bullets: ['섹션별 초안 생성', '사용자 입력이 필요한 문항 추출', 'HWPX export를 위한 문단 구조 준비'],
  },
  export: {
    label: '결과 다운로드',
    title: '내보내기 준비가 완료되었습니다.',
    body: '실제 제품에서는 이 단계에서 HTML fallback 또는 검증된 HWPX 파일을 생성합니다.',
    bullets: ['최종 문서 생성 전 확인 필요 항목 체크', 'HWPX namespace fix와 validation 수행', '생성된 export 이력 저장'],
  },
};

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [storedDocument, setStoredDocument] = useState<MockDocument | null>(null);
  const mockDocument = useMemo(() => mockDocuments.find((item) => item.id === params.id) ?? null, [params.id]);
  const document = storedDocument ?? mockDocument;
  const [active, setActive] = useState('요약');
  const [result, setResult] = useState(actionCopy.summary);

  useEffect(() => {
    setStoredDocument(findStoredDocument(params.id));
  }, [params.id]);

  if (!document) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-[#273044]">문서를 찾을 수 없습니다.</h2>
        <p className="mt-2 text-sm text-[#7B8190]">목록에서 다시 문서를 선택해 주세요.</p>
        <Link href="/app/documents" className="mt-5 inline-flex text-sm font-bold text-[#5263E8]">문서 목록으로 이동</Link>
      </Card>
    );
  }

  const runAction = (key: ActionKey) => {
    setResult(actionCopy[key]);
    setActive(key === 'summary' ? '요약' : '생성 결과');
  };

  return (
    <div className="space-y-6">
      <Link href="/app/documents" className="text-sm font-bold text-[#5263E8]">← 문서 목록으로 돌아가기</Link>

      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#5263E8]">{document.category}</p>
            <h2 className="mt-2 text-2xl font-bold text-[#273044]">{document.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#7B8190]">
              <span>{document.type}</span>
              <span>·</span>
              <span>{document.size}</span>
              <span>·</span>
              <span>업로드 {document.createdAt}</span>
            </div>
          </div>
          <Badge tone={statusTone(document.status)}>{document.status}</Badge>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#273044]">문서 작업 결과</h3>
              <p className="mt-1 text-sm text-[#7B8190]">분석 결과를 확인하고 필요한 후속 작업을 실행합니다.</p>
            </div>
            <Tabs tabs={tabs} active={active} onChange={setActive} />
          </div>
          <div className="mt-6 rounded-[24px] bg-[#FBFBFD] p-6">
            {active === '요약' ? <p className="leading-8 text-[#6B7280]">{document.summary}</p> : null}
            {active === '핵심 키워드' ? (
              <div className="flex flex-wrap gap-2">
                {document.keywords.map((keyword) => <Badge key={keyword} tone="info">{keyword}</Badge>)}
              </div>
            ) : null}
            {active === '문서 구조' ? (
              <div className="space-y-3">
                {document.structure.map((item) => (
                  <div key={item.title} className="rounded-[18px] border border-[#ECECF1] bg-white p-4">
                    <p className="font-bold text-[#273044]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#7B8190]">{item.description}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {active === '생성 결과' ? (
              <div className="document-preview">
                <h3>{result.title}</h3>
                <p>{result.body}</p>
                <ul>
                  {result.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-4 text-sm text-[#6B7280]">{document.generatedResult}</p>
              </div>
            ) : null}
            {active === '원본 미리보기' ? (
              <div className="rounded-[20px] border border-dashed border-[#D8DDFC] bg-white p-8 text-center text-sm text-[#7B8190]">
                원본 문서 미리보기 영역입니다. 실제 파일 뷰어 연결 전까지는 mock preview로 표시됩니다.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-[#273044]">작업 실행 패널</h3>
          <p className="mt-2 text-sm leading-6 text-[#7B8190]">
            이 패널의 목적은 문서별 후속 행동을 한곳에 모으는 것입니다. 실제 Agent MVP에서는 초안 검토와 HWPX export까지 여기서 이어집니다.
          </p>
          <div className="mt-5 grid gap-3">
            {(Object.keys(actionCopy) as ActionKey[]).map((key) => (
              <Button key={key} variant={key === 'export' ? 'primary' : 'secondary'} onClick={() => runAction(key)}>
                {actionCopy[key].label}
              </Button>
            ))}
          </div>
          <div className="mt-6 rounded-[22px] bg-[#EEF2FF] p-4 text-sm leading-6 text-[#5263E8]">
            현재 선택된 작업: {result.label}. 왼쪽 생성 결과 탭에서 결과를 확인하세요.
          </div>
          <Link href="/app/templates" className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#ECECF1] bg-white px-5 py-2.5 text-sm font-semibold text-[#273044]">
            템플릿으로 이어가기
          </Link>
        </Card>
      </section>
    </div>
  );
}
