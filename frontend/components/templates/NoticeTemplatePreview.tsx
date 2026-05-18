'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { NoticeTemplate } from '@/data/mockTemplates';

function SampleHwpxPage({ template }: { template: NoticeTemplate }) {
  return (
    <div className="mx-auto aspect-[210/297] w-full max-w-[430px] overflow-hidden rounded-sm border border-[#D8DED9] bg-white p-7 text-[#1F2937] shadow-[0_24px_70px_rgba(39,48,68,0.18)]">
      <div className="text-center">
        <p className="text-[11px] text-[#6B7280]">○○기관 공고 제2026-00호</p>
        <h3 className="mt-4 text-xl font-extrabold leading-snug">{template.name}</h3>
        <p className="mt-3 text-sm font-semibold">○○기관</p>
      </div>
      <div className="mt-6 border-y border-[#DDE7E2] py-4">
        <p className="text-sm font-bold">공고 안내문</p>
        <p className="mt-2 text-xs leading-6 text-[#4B5563]">
          ○○기관은 {template.purpose}을(를) 다음과 같이 공고하오니 관심 있는 대상자의 많은 신청 바랍니다.
        </p>
      </div>
      <div className="mt-5 space-y-3">
        {template.previewSections.slice(1, 10).map((section) => (
          <div key={section}>
            <p className="text-xs font-extrabold">{section}</p>
            <div className="mt-1.5 space-y-1">
              <div className="h-1.5 w-full rounded-full bg-[#E8EEF0]" />
              <div className="h-1.5 w-10/12 rounded-full bg-[#E8EEF0]" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <p className="text-xs font-extrabold">붙임 문서 목록</p>
        <p className="mt-1.5 text-[11px] leading-5 text-[#4B5563]">1. 신청서 1부<br />2. 개인정보 수집 및 이용 동의서 1부</p>
      </div>
    </div>
  );
}

export function NoticeTemplatePreviewModal({
  template,
  onClose,
}: {
  template: NoticeTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2937]/45 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-[#F8FAF9] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">HWPX 샘플 미리보기</p>
            <h2 className="mt-1 text-2xl font-bold text-[#24312D]">{template.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65736E]">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>닫기</Button>
            <Link
              href={`/app?template=${template.id}`}
              className="inline-flex items-center justify-center rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
            >
              이 템플릿으로 작성하기
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <SampleHwpxPage template={template} />
          <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5">
            <p className="text-sm font-bold text-[#24312D]">샘플 구성</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">사용 목적</dt>
                <dd className="mt-1 text-[#24312D]">{template.purpose}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">필요한 입력 항목 수</dt>
                <dd className="mt-1 text-[#24312D]">{template.inputCount}개</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">출력 형식</dt>
                <dd className="mt-1 text-[#24312D]">{template.outputFormats.join(' / ')}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}
