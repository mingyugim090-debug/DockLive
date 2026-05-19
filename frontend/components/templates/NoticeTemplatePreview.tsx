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
            <th className="w-28 border border-[#AEB8B2] bg-[#F0F3F1] px-2 py-1.5 text-left font-bold">{label}</th>
            <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ApplicationFormBlock({ template }: { template: NoticeTemplate }) {
  const { sample } = template;
  return (
    <section className="mt-5">
      <h4 className="text-center text-sm font-extrabold">참가 신청서</h4>
      <table className="mt-3 w-full border-collapse text-[11px] leading-5">
        <tbody>
          {[
            ['신청자/기업명', 'OOO'],
            ['소속/대표자', sample.organization],
            ['신청 분야', template.purpose],
            ['연락처', '010-0000-0000 / notice@example.go.kr'],
          ].map(([label, value]) => (
            <tr key={label}>
              <th className="w-28 border border-[#AEB8B2] bg-[#F0F3F1] px-2 py-1.5 text-left">{label}</th>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 border border-[#AEB8B2]">
        <div className="bg-[#F0F3F1] px-2 py-1.5 text-[11px] font-bold">신청 내용 및 추진 계획</div>
        <div className="min-h-20 px-3 py-2 text-[11px] leading-5 text-[#34443F]">{sample.sections[0]?.body[0]}</div>
      </div>
    </section>
  );
}

function ProgramTableBlock({ rows }: { rows: Array<[string, string]> }) {
  return (
    <section className="mt-5">
      <h4 className="text-[13px] font-extrabold">프로그램별 모집 현황</h4>
      <table className="mt-2 w-full border-collapse text-[11px] leading-5">
        <thead>
          <tr className="bg-[#F0F3F1]">
            {['구분', '기간/인원', '운영 내용'].map((item) => (
              <th key={item} className="border border-[#AEB8B2] px-2 py-1.5 text-left">{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 3).map(([label, value], index) => (
            <tr key={label}>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{label}</td>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{index === 0 ? '강의 및 실습' : index === 1 ? '접수 및 선발' : '수료 관리'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RfpBlock({ template }: { template: NoticeTemplate }) {
  return (
    <section className="mt-5">
      <h4 className="text-center text-sm font-extrabold">제안요청서 구성</h4>
      <HwpTable rows={template.sample.overviewRows} />
      <div className="mt-4 border border-[#AEB8B2]">
        <div className="bg-[#F0F3F1] px-2 py-1.5 text-[11px] font-bold">제안서 작성 목차</div>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2 text-[11px] leading-5">
          {['사업 이해도', '수행 조직 및 인력', '추진 전략', '과업 수행 방안', '품질 관리', '보안 및 사후관리'].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ScholarshipBlock({ template }: { template: NoticeTemplate }) {
  return (
    <section className="mt-5">
      <HwpTable rows={template.sample.overviewRows} />
      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] leading-5">
        <div className="border border-[#AEB8B2]">
          <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">공통 제출서류</div>
          <ol className="list-decimal px-5 py-2">
            {template.sample.attachments.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
        <div className="border border-[#AEB8B2]">
          <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">평가 항목</div>
          <p className="px-2 py-2">학업 성취도, 성장 가능성, 경제 여건, 제출 서류 충실도</p>
        </div>
      </div>
    </section>
  );
}

function ResearchBlock({ template }: { template: NoticeTemplate }) {
  return (
    <section className="mt-5">
      <HwpTable rows={template.sample.overviewRows} />
      <div className="mt-4 border border-[#AEB8B2] text-[11px] leading-5">
        <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">연구윤리 및 보안 확인</div>
        <div className="grid grid-cols-[24px_1fr] gap-y-1 px-3 py-2">
          {['개인정보 보호 기준 준수', '연구자료 외부 반출 금지', '이해상충 및 참여 제한 여부 확인'].map((item) => (
            <div key={item} className="contents">
              <span>□</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SampleBody({ template }: { template: NoticeTemplate }) {
  if (template.sample.layout === 'application') return <ApplicationFormBlock template={template} />;
  if (template.sample.layout === 'program') return <ProgramTableBlock rows={template.sample.overviewRows} />;
  if (template.sample.layout === 'rfp') return <RfpBlock template={template} />;
  if (template.sample.layout === 'scholarship') return <ScholarshipBlock template={template} />;
  if (template.sample.layout === 'research') return <ResearchBlock template={template} />;
  return <HwpTable rows={template.sample.overviewRows} />;
}

function SampleHwpxPage({ template }: { template: NoticeTemplate }) {
  const { sample } = template;
  return (
    <div className="mx-auto w-full max-w-[600px]">
      <div className="rounded-t-sm border border-b-0 border-[#D5DDD8] bg-[#EEF3F0] px-4 py-2 text-[11px] font-semibold text-[#52615B]">
        {sample.title}.hwpx
      </div>
      <article className="max-h-[76vh] w-full overflow-y-auto border border-[#C9D2CD] bg-white px-8 py-9 text-[#202833] shadow-[0_28px_80px_rgba(36,49,45,0.18)]">
        <header className="text-center">
          <p className="text-[11px] text-[#5D6770]">{sample.documentNo}</p>
          <h3 className="mt-5 text-[22px] font-extrabold leading-snug tracking-normal">{sample.title}</h3>
          <p className="mt-4 text-sm font-bold">{sample.organization}</p>
        </header>

        <section className="mt-8 border-y border-[#C9D2CD] py-4">
          <h4 className="text-sm font-extrabold">공고 안내문</h4>
          <p className="mt-2 text-[12px] leading-6 text-[#34443F]">{sample.intro}</p>
        </section>

        <SampleBody template={template} />

        <div className="mt-6 space-y-4">
          {sample.sections.map((section) => (
            <section key={section.heading}>
              <h4 className="border-b border-[#DDE5E0] pb-1 text-[13px] font-extrabold">{section.heading}</h4>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#34443F]">
                {section.body.map((line) => (
                  <li key={line} className="grid grid-cols-[18px_1fr] gap-1">
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
            {sample.attachments.map((item) => <li key={item}>{item} 1부</li>)}
          </ol>
        </section>

        <footer className="mt-7 text-center text-[12px] font-bold text-[#202833]">
          2026. 5. 18.
          <br />
          {sample.organization}
        </footer>
      </article>
    </div>
  );
}

export function NoticeTemplatePreviewModal({ template, onClose }: { template: NoticeTemplate | null; onClose: () => void }) {
  if (!template) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2937]/45 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <Card className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#FBFAF6] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">HWPX 샘플 미리보기</p>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-[#24312D]">{template.sample.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65736E]">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>닫기</Button>
            <Link href={`/app?template=${template.id}`} className="inline-flex items-center justify-center rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105">
              이 초안으로 작성하기
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
                <dt className="text-xs font-bold text-[#7B8782]">참고 공개 양식</dt>
                <dd className="mt-1">
                  <a href={template.sample.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#245D50] underline-offset-4 hover:underline">
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
