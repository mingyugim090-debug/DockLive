'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { mockDocuments } from '@/data/mockDocuments';

const tabs = ['요약', '핵심 키워드', '문서 구조', '자동 생성 결과', '원본 미리보기'];

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const document = useMemo(() => mockDocuments.find((item) => item.id === params.id), [params.id]);
  const [active, setActive] = useState('요약');
  const [resultMessage, setResultMessage] = useState('최근 분석 결과를 표시하고 있습니다.');

  if (!document) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-[#273044]">문서를 찾을 수 없습니다.</h2>
        <p className="mt-2 text-sm text-[#7B8190]">목록에서 다시 문서를 선택해 주세요.</p>
        <Link href="/app/documents" className="mt-5 inline-flex text-sm font-bold text-[#5263E8]">문서 목록으로 이동</Link>
      </Card>
    );
  }

  const runAction = (label: string) => {
    setResultMessage(`${label} 작업이 완료되었습니다. 아래 결과 영역에서 mock 결과를 확인하세요.`);
    if (label.includes('키워드')) setActive('핵심 키워드');
    else if (label.includes('템플릿') || label.includes('보고서') || label.includes('회의록')) setActive('자동 생성 결과');
    else setActive('요약');
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
            <h3 className="text-xl font-bold text-[#273044]">AI 분석 결과</h3>
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
            {active === '자동 생성 결과' ? (
              <div className="document-preview">
                <h3>생성 결과</h3>
                <p>{document.generatedResult}</p>
                <ul>
                  <li>핵심 내용은 제출용 문장으로 다시 정리했습니다.</li>
                  <li>필요한 경우 템플릿을 적용해 문서 구조를 맞출 수 있습니다.</li>
                </ul>
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
          <p className="mt-2 text-sm leading-6 text-[#7B8190]">필요한 작업을 선택하면 결과 영역이 mock으로 갱신됩니다.</p>
          <div className="mt-5 grid gap-3">
            {['다시 요약하기', '보고서로 변환', '회의록으로 변환', '템플릿 적용', '결과 다운로드'].map((label) => (
              <Button key={label} variant={label === '결과 다운로드' ? 'primary' : 'secondary'} onClick={() => runAction(label)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="mt-6 rounded-[22px] bg-[#EEF2FF] p-4 text-sm leading-6 text-[#5263E8]">{resultMessage}</div>
        </Card>
      </section>
    </div>
  );
}
