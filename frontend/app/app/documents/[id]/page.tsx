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

const tabs = ['개요', '핵심 키워드', '공고문 구조', '생성 결과', '원본 미리보기'];

type ActionKey = 'overview' | 'notice' | 'template' | 'export';

const actionCopy: Record<ActionKey, { label: string; title: string; body: string; bullets: string[] }> = {
  overview: {
    label: '공고문 개요 확인',
    title: '공고문 개요가 정리되었습니다.',
    body: '신청 기간, 운영 일정, 모집 대상, 제출 서류를 공고문 작성 순서에 맞춰 정리했습니다.',
    bullets: ['중요 일정 상단 배치', '모집 대상과 제출 서류 분리', '문의처 영역 확인'],
  },
  notice: {
    label: '공고문 다시 생성',
    title: '공고문 초안이 다시 생성되었습니다.',
    body: '사업 개요부터 붙임 문서 목록까지 행정 공고문 구조로 다시 구성했습니다.',
    bullets: ['공고 안내문 작성', '9개 본문 항목 구성', 'HWPX 출력 구조 준비'],
  },
  template: {
    label: '템플릿 적용',
    title: '공고문 템플릿 적용 결과입니다.',
    body: '선택한 공고문 유형에 맞춰 사업 개요, 모집 대상, 신청 방법, 선정 기준을 정리했습니다.',
    bullets: ['유형별 항목 구성', '본문 문안 정리', 'HWPX export를 위한 문단 구조 준비'],
  },
  export: {
    label: '결과 다운로드',
    title: '내보내기 준비가 완료되었습니다.',
    body: '검증된 HWPX, DOCX, PDF 파일을 내려받을 수 있습니다.',
    bullets: ['최종 문서 생성 전 문의처 확인', 'HWPX 구조 검증 수행', '생성된 파일 저장'],
  },
};

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [storedDocument, setStoredDocument] = useState<MockDocument | null>(null);
  const mockDocument = useMemo(() => mockDocuments.find((item) => item.id === params.id) ?? null, [params.id]);
  const document = storedDocument ?? mockDocument;
  const [active, setActive] = useState('개요');
  const [result, setResult] = useState(actionCopy.overview);

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
    setActive(key === 'overview' ? '개요' : '생성 결과');
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
              <p className="mt-1 text-sm text-[#7B8190]">공고문 생성 결과를 확인하고 필요한 후속 작업을 실행합니다.</p>
            </div>
            <Tabs tabs={tabs} active={active} onChange={setActive} />
          </div>
          <div className="mt-6 rounded-[24px] bg-[#FBFBFD] p-6">
            {active === '개요' ? <p className="leading-8 text-[#6B7280]">{document.summary}</p> : null}
            {active === '핵심 키워드' ? (
              <div className="flex flex-wrap gap-2">
                {document.keywords.map((keyword) => <Badge key={keyword} tone="info">{keyword}</Badge>)}
              </div>
            ) : null}
            {active === '공고문 구조' ? (
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
                원본 문서 미리보기 영역입니다.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-[#273044]">작업 실행 패널</h3>
          <p className="mt-2 text-sm leading-6 text-[#7B8190]">
            공고문별 후속 작업을 한곳에서 실행합니다. 초안 검토와 HWPX 다운로드까지 이어갈 수 있습니다.
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
