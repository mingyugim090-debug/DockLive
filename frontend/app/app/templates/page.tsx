'use client';

import Link from 'next/link';
import { useState } from 'react';
import { noticeTemplates, type NoticeTemplate } from '@/data/mockTemplates';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoticeTemplatePreviewModal } from '@/components/templates/NoticeTemplatePreview';

export default function TemplatesPage() {
  const [previewTemplate, setPreviewTemplate] = useState<NoticeTemplate | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <p className="text-sm font-bold text-[#3A7A68]">공고문 유형 템플릿</p>
        <h2 className="mt-2 text-3xl font-bold text-[#24312D]">기관 업무에 맞는 공고문 유형을 선택하세요.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
          모집공고, 지원사업 공고, 행사 안내문 등 자주 쓰는 행정 공고문 구조를 미리 준비했습니다.
          미리보기에서 HWPX 샘플 화면을 확인하고 바로 작성할 수 있습니다.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {noticeTemplates.map((template) => (
          <Card key={template.id} hover className="flex min-h-[390px] flex-col rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: template.accent }}>
                {template.purpose}
              </span>
              <span className="rounded-full bg-[#F3F7F5] px-3 py-1 text-xs font-bold text-[#65736E]">
                {template.inputCount}개 입력
              </span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-[#24312D]">{template.name}</h3>
            <p className="mt-2 text-sm leading-6 text-[#65736E]">{template.description}</p>
            <div className="mt-5 rounded-xl border border-[#E4EBE7] bg-[#FBFCFB] p-4">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-bold text-[#7B8782]">사용 목적</dt>
                  <dd className="mt-1 text-sm text-[#34443F]">{template.purpose}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-bold text-[#7B8782]">입력 항목</dt>
                    <dd className="mt-1 text-sm text-[#34443F]">{template.inputCount}개</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-[#7B8782]">출력 형식</dt>
                    <dd className="mt-1 text-sm text-[#34443F]">{template.outputFormats.join('/')}</dd>
                  </div>
                </div>
              </dl>
            </div>
            <div className="mt-auto flex gap-2 pt-5">
              <Button type="button" variant="secondary" className="flex-1 px-3" onClick={() => setPreviewTemplate(template)}>
                미리보기
              </Button>
              <Link
                href={`/app?template=${template.id}`}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[#245D50] px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
              >
                이 템플릿으로 작성하기
              </Link>
            </div>
          </Card>
        ))}
      </section>

      <NoticeTemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}
