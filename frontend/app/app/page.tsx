'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { noticeTemplates, type NoticeTemplate } from '@/data/mockTemplates';
import { noticeSteps, useNoticeBuilder } from '@/hooks/useNoticeBuilder';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoticeTemplatePreviewModal } from '@/components/templates/NoticeTemplatePreview';

export default function NoticeBuilderPage() {
  const searchParams = useSearchParams();
  const initialTemplateId = useMemo(() => searchParams.get('template'), [searchParams]);
  const builder = useNoticeBuilder(initialTemplateId);
  const [previewTemplate, setPreviewTemplate] = useState<NoticeTemplate | null>(null);

  const canContinueInfo = builder.missingRequired.length === 0;
  const coreFields = builder.selectedTemplate.fields.filter((field) => field.required);
  const optionalFields = builder.selectedTemplate.fields.filter((field) => !field.required);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">공고문 AI Agent</p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">유형을 고르고 필요한 정보만 입력하면 공고문이 완성됩니다.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
              공공기관, 대학, 지자체 담당자가 쓰는 모집공고와 지원사업 공고를 HWPX, DOCX, PDF로 내려받을 수 있습니다.
            </p>
          </div>
          <Button variant="secondary" onClick={builder.reset}>새 공고문 작성</Button>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-[#E4EBE7] bg-white p-3 shadow-sm md:grid-cols-6">
        {noticeSteps.map((step, index) => {
          const active = builder.currentStep === step.id;
          const complete = index < builder.stepIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (index <= builder.stepIndex || builder.draftDocument) builder.setCurrentStep(step.id);
              }}
              className={[
                'flex min-h-14 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition',
                active ? 'bg-[#E7F1ED] text-[#245D50]' : complete ? 'bg-[#F5F8F6] text-[#3A7A68]' : 'text-[#8A9692]',
              ].join(' ')}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs shadow-sm">{index + 1}</span>
              <span>{step.label}</span>
            </button>
          );
        })}
      </section>

      {builder.error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{builder.error}</div>
      ) : null}

      {builder.currentStep === 'template' ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {noticeTemplates.map((template) => (
            <Card key={template.id} hover className="flex min-h-[280px] flex-col rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: template.accent }}>
                  {template.purpose}
                </span>
                <span className="text-xs font-semibold text-[#7B8782]">{template.inputCount}개 입력</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#24312D]">{template.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#65736E]">{template.description}</p>
              <div className="mt-4 rounded-xl bg-[#F8FBFA] p-3 text-xs leading-5 text-[#65736E]">
                <p>입력 항목 {template.inputCount}개</p>
                <p>출력 형식 {template.outputFormats.join(' / ')}</p>
              </div>
              <div className="mt-auto flex gap-2 pt-5">
                <Button type="button" variant="secondary" className="flex-1 px-3" onClick={() => setPreviewTemplate(template)}>
                  미리보기
                </Button>
                <Button type="button" className="flex-1 px-3" onClick={() => builder.selectTemplate(template)}>
                  이 템플릿으로 작성하기
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {builder.currentStep === 'info' ? (
        <Card className="rounded-2xl">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-[#3A7A68]">Step 2. 필수 정보 입력</p>
            <h2 className="text-2xl font-bold text-[#24312D]">{builder.selectedTemplate.name}</h2>
            <p className="text-sm leading-6 text-[#65736E]">
              핵심 항목만 입력하면 내장된 HWPX 샘플 양식 기준으로 초안을 만듭니다. 세부 일정과 제출 서류는 필요할 때만 펼쳐서 보완하세요.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {coreFields.map((field) => (
              <label key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                <span className="text-sm font-bold text-[#34443F]">
                  {field.label}
                  {field.required ? <span className="ml-1 text-[#B95050]">*</span> : null}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    value={builder.inputValues[field.id] ?? ''}
                    onChange={(event) => builder.setInputValue(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-2 min-h-28 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 text-[#24312D] outline-none transition focus:border-[#6A9C89]"
                  />
                ) : (
                  <input
                    value={builder.inputValues[field.id] ?? ''}
                    onChange={(event) => builder.setInputValue(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    type={field.type === 'date' ? 'text' : field.type}
                    className="mt-2 h-12 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 text-sm text-[#24312D] outline-none transition focus:border-[#6A9C89]"
                  />
                )}
              </label>
            ))}
          </div>
          <details className="mt-5 rounded-2xl border border-[#E4EBE7] bg-[#FBFCFB] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#245D50]">
              선택 입력 더보기
              <span className="ml-2 font-semibold text-[#7B8782]">일정, 지원 내용, 제출 서류 등은 비워도 AI가 샘플 양식 기준으로 채웁니다.</span>
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {optionalFields.map((field) => (
                <label key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <span className="text-sm font-bold text-[#34443F]">{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={builder.inputValues[field.id] ?? ''}
                      onChange={(event) => builder.setInputValue(field.id, event.target.value)}
                      placeholder={field.placeholder}
                      className="mt-2 min-h-24 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 text-[#24312D] outline-none transition focus:border-[#6A9C89]"
                    />
                  ) : (
                    <input
                      value={builder.inputValues[field.id] ?? ''}
                      onChange={(event) => builder.setInputValue(field.id, event.target.value)}
                      placeholder={field.placeholder}
                      type={field.type === 'date' ? 'text' : field.type}
                      className="mt-2 h-12 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 text-sm text-[#24312D] outline-none transition focus:border-[#6A9C89]"
                    />
                  )}
                </label>
              ))}
            </div>
          </details>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#65736E]">
              {canContinueInfo ? '필수 정보가 입력되었습니다.' : `남은 필수 항목: ${builder.missingRequired.map((field) => field.label).join(', ')}`}
            </p>
            <Button disabled={!canContinueInfo || builder.isGenerating} onClick={builder.generateDraft}>
              {builder.isGenerating ? 'AI 초안 생성 중' : 'AI 초안 생성'}
            </Button>
          </div>
        </Card>
      ) : null}

      {builder.currentStep === 'generate' ? (
        <Card className="rounded-2xl text-center">
          <p className="text-sm font-bold text-[#3A7A68]">Step 4. AI 초안 생성</p>
          <h2 className="mt-2 text-2xl font-bold text-[#24312D]">공고문 구조를 정리하고 있습니다.</h2>
          <div className="mx-auto mt-6 h-3 max-w-xl overflow-hidden rounded-full bg-[#E4EBE7]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#6A9C89]" />
          </div>
          <p className="mt-4 text-sm text-[#65736E]">행정 공고문 형식에 맞춰 제목, 안내문, 본문 항목, 문의처를 정리합니다.</p>
        </Card>
      ) : null}

      {builder.currentStep === 'preview' && builder.draftDocument ? (
        <Card className="rounded-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[#3A7A68]">Step 5. 문서 미리보기 및 수정</p>
              <input
                value={builder.draftDocument.title}
                onChange={(event) => builder.updateDraft((doc) => ({ ...doc, title: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-transparent bg-transparent text-2xl font-bold text-[#24312D] outline-none focus:border-[#DDE7E2] focus:bg-white"
              />
              <p className="mt-2 text-sm text-[#65736E]">{builder.draftDocument.organization}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => builder.setCurrentStep('info')}>정보 수정</Button>
              <Button variant="secondary" onClick={builder.generateDraft} disabled={builder.isGenerating}>다시 생성</Button>
              <Button onClick={() => builder.setCurrentStep('download')}>다운로드로 이동</Button>
            </div>
          </div>

          {builder.warnings.length ? (
            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              {builder.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-[#E4EBE7] bg-[#FBFCFB] p-5">
            <div className="rounded-xl bg-white p-6 text-[#24312D] shadow-sm">
              <h1 className="text-center text-2xl font-extrabold">{builder.draftDocument.title}</h1>
              <table className="mt-6 w-full border-collapse text-sm">
                <tbody>
                  {[
                    ['기관명', builder.draftDocument.organization],
                    ['공고 유형', builder.draftDocument.purpose],
                    ['신청 기간', builder.draftDocument.schedule.applicationPeriod],
                    ['운영 기간', builder.draftDocument.schedule.eventPeriod],
                    ['접수 방법', builder.draftDocument.applicationMethod],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="w-32 border border-[#DDE7E2] bg-[#F3F7F5] px-3 py-2 text-left">{label}</th>
                      <td className="border border-[#DDE7E2] px-3 py-2">{value || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 space-y-5">
                {builder.draftDocument.sections.map((section, index) => (
                  <section key={`${section.heading}-${index}`}>
                    <input
                      value={section.heading}
                      onChange={(event) => builder.updateDraft((doc) => ({
                        ...doc,
                        sections: doc.sections.map((item, itemIndex) => itemIndex === index ? { ...item, heading: event.target.value } : item),
                      }))}
                      className="w-full rounded-lg border border-transparent bg-transparent text-lg font-bold outline-none focus:border-[#DDE7E2] focus:bg-white"
                    />
                    <textarea
                      value={section.body}
                      onChange={(event) => builder.updateDraft((doc) => ({
                        ...doc,
                        sections: doc.sections.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item),
                      }))}
                      className="mt-2 min-h-24 w-full rounded-xl border border-[#EEF3F0] bg-white px-3 py-3 text-sm leading-7 outline-none focus:border-[#6A9C89]"
                    />
                  </section>
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-bold">문의처</h3>
                  <p className="mt-2 text-sm leading-7">
                    {builder.draftDocument.contact.department} / {builder.draftDocument.contact.phone} / {builder.draftDocument.contact.email}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">붙임</h3>
                  <ol className="mt-2 list-decimal pl-5 text-sm leading-7">
                    {builder.draftDocument.attachments.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {builder.currentStep === 'download' && builder.draftDocument ? (
        <Card className="rounded-2xl">
          <p className="text-sm font-bold text-[#3A7A68]">Step 6. 다운로드</p>
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">검토한 공고문을 HWPX, DOCX, PDF로 내려받으세요.</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button disabled={Boolean(builder.exporting)} onClick={() => builder.download('HWPX')}>
              {builder.exporting === 'HWPX' ? 'HWPX 생성 중' : 'HWPX 다운로드'}
            </Button>
            <Button variant="secondary" disabled={Boolean(builder.exporting)} onClick={() => builder.download('PDF')}>
              {builder.exporting === 'PDF' ? 'PDF 생성 중' : 'PDF 다운로드'}
            </Button>
            <Button variant="secondary" disabled={Boolean(builder.exporting)} onClick={() => builder.download('DOCX')}>
              {builder.exporting === 'DOCX' ? 'DOCX 생성 중' : 'DOCX 다운로드'}
            </Button>
            <Button variant="ghost" onClick={() => builder.setCurrentStep('preview')}>미리보기로 돌아가기</Button>
          </div>
        </Card>
      ) : null}

      <NoticeTemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}
