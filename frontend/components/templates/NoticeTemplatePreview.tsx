'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { NoticeTemplate } from '@/data/mockTemplates';

function HwpTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="mt-5 w-full border-collapse text-[11px] leading-5 text-[#202833]">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th className="w-24 border border-[#AEB8B2] bg-[#F0F3F1] px-2 py-1.5 text-left font-bold">
              {label}
            </th>
            <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SampleHwpxPage({ template }: { template: NoticeTemplate }) {
  const { sample } = template;

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="rounded-t-sm border border-b-0 border-[#D5DDD8] bg-[#EEF3F0] px-4 py-2 text-[11px] font-semibold text-[#52615B]">
        {sample.title}.hwpx
      </div>
      <article className="aspect-[210/297] w-full overflow-hidden border border-[#C9D2CD] bg-white px-8 py-9 text-[#202833] shadow-[0_28px_80px_rgba(36,49,45,0.18)]">
        <header className="text-center">
          <p className="text-[11px] text-[#5D6770]">{sample.documentNo}</p>
          <h3 className="mt-5 text-[22px] font-extrabold leading-snug tracking-normal">{sample.title}</h3>
          <p className="mt-4 text-sm font-bold">{sample.organization}</p>
        </header>

        <section className="mt-8 border-y border-[#C9D2CD] py-4">
          <h4 className="text-sm font-extrabold">공고 안내문</h4>
          <p className="mt-2 text-[12px] leading-6 text-[#34443F]">{sample.intro}</p>
        </section>

        <HwpTable rows={sample.overviewRows} />

        <div className="mt-6 space-y-4">
          {sample.sections.map((section) => (
            <section key={section.heading}>
              <h4 className="border-b border-[#DDE5E0] pb-1 text-[13px] font-extrabold">
                {section.heading}
              </h4>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#34443F]">
                {section.body.map((line) => (
                  <li key={line} className="grid grid-cols-[12px_1fr] gap-1">
                    <span>가.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-6">
          <h4 className="border-b border-[#DDE5E0] pb-1 text-[13px] font-extrabold">붙임 문서 목록</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[11px] leading-5 text-[#34443F]">
            {sample.attachments.map((item) => (
              <li key={item}>{item} 1부</li>
            ))}
          </ol>
        </section>

        <footer className="mt-7 text-center text-[12px] font-bold text-[#202833]">
          2026년 5월 18일
          <br />
          {sample.organization}
        </footer>
      </article>
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
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#FBFAF6] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">HWPX 샘플 미리보기</p>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-[#24312D]">{template.sample.title}</h2>
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

        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <SampleHwpxPage template={template} />
          <aside className="rounded-2xl border border-[#DDE7E2] bg-white p-5">
            <p className="text-sm font-bold text-[#24312D]">샘플 구성</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">사용 목적</dt>
                <dd className="mt-1 text-[#24312D]">{template.purpose}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">참고한 공개 양식</dt>
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
            </dl>
          </aside>
        </div>
      </Card>
    </div>
  );
}
