'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { SampleTemplate } from '@/data/sampleTemplates';
import { HwpxSamplePreview } from './HwpxSamplePreview';

export function NoticeTemplatePreviewModal({
  template,
  onClose,
}: {
  template: SampleTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2937]/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#FBFAF6] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">HWPX 샘플 미리보기</p>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-[#24312D]">{template.sample.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65736E]">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Link
              href={`/app?template=${template.id}`}
              className="inline-flex items-center justify-center rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
              onClick={onClose}
            >
              이 초안으로 작성하기
            </Link>
          </div>
        </div>

        {/* Body: preview + metadata panel */}
        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          {/* Left: HWPX preview */}
          <HwpxSamplePreview template={template} />

          {/* Right: metadata panel */}
          <aside className="rounded-2xl border border-[#DDE7E2] bg-white p-5">
            <p className="text-sm font-bold text-[#24312D]">샘플 구성</p>

            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">카테고리</dt>
                <dd className="mt-1">
                  <span className="inline-block rounded-full bg-[#EEF3F0] px-3 py-0.5 text-xs font-semibold text-[#245D50]">
                    {template.category}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-[#7B8782]">사용 목적</dt>
                <dd className="mt-1 text-[#24312D]">{template.purpose}</dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-[#7B8782]">참고 공개 양식</dt>
                <dd className="mt-1">
                  <a
                    href={template.sample.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#245D50] underline-offset-4 hover:underline"
                  >
                    {template.sample.sourceName}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-[#7B8782]">필요한 입력 항목 수</dt>
                <dd className="mt-1 text-[#24312D]">{template.inputCount}개</dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-[#7B8782]">출력 형식</dt>
                <dd className="mt-1 text-[#24312D]">{template.outputFormats.join(' / ')}</dd>
              </div>

              {template.previewFeatures.length > 0 && (
                <div>
                  <dt className="text-xs font-bold text-[#7B8782]">미리보기 반영 특징</dt>
                  <dd className="mt-2 space-y-2 text-xs leading-5 text-[#52615B]">
                    {template.previewFeatures.map((note) => (
                      <p key={note} className="rounded-lg bg-[#F6FAF8] px-3 py-2">
                        {note}
                      </p>
                    ))}
                  </dd>
                </div>
              )}

              {template.editableFields.length > 0 && (
                <div>
                  <dt className="text-xs font-bold text-[#7B8782]">수정 가능 항목</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {template.editableFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-md border border-[#DDE7E2] bg-[#F6FAF8] px-2 py-1 text-[11px] text-[#52615B]"
                      >
                        {field}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {template.hwpxPath && (
                <div className="border-t border-[#F3F4F6] pt-4">
                  <dt className="text-xs font-bold text-[#7B8782]">HWPX 파일</dt>
                  <dd className="mt-1">
                    <a
                      href={template.hwpxPath}
                      download={template.fileName}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245D50] underline-offset-4 hover:underline"
                    >
                      <span>↓</span>
                      {template.fileName}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </Card>
    </div>
  );
}
