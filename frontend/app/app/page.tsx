'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { noticeTemplates, type NoticeTemplate } from '@/data/mockTemplates';
import { noticeSteps, useNoticeBuilder } from '@/hooks/useNoticeBuilder';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoticeTemplatePreviewModal } from '@/components/templates/NoticeTemplatePreview';
import { NoticeWebEditor } from '@/components/workspace/NoticeWebEditor';

export default function NoticeBuilderPage() {
  const searchParams = useSearchParams();
  const initialTemplateId = useMemo(() => searchParams.get('template'), [searchParams]);
  const builder = useNoticeBuilder(initialTemplateId);
  const [previewTemplate, setPreviewTemplate] = useState<NoticeTemplate | null>(null);

  const coreFields = builder.selectedTemplate.fields.filter((field) => field.required);
  const optionalFields = builder.selectedTemplate.fields.filter((field) => !field.required);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">공고문 AI Agent</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">
              유형을 고르면 HWPX 초안이 먼저 열립니다.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
              샘플 공고문을 왼쪽 HWPX 화면에서 바로 수정하고, 필요한 순간 AI 초안 생성으로 내용을 보강한 뒤 HWPX, DOCX, PDF로 내려받을 수 있습니다.
            </p>
          </div>
          <Button variant="secondary" onClick={builder.reset}>새 공고문 작성</Button>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-[#E4EBE7] bg-white p-3 shadow-sm md:grid-cols-4">
        {noticeSteps.map((step, index) => {
          const active = builder.currentStep === step.id;
          const complete = index < builder.stepIndex || (step.id === 'preview' && Boolean(builder.draftDocument));
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (step.id === 'template' || builder.draftDocument) builder.setCurrentStep(step.id);
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
            <Card key={template.id} hover className="flex min-h-[300px] flex-col rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: template.accent }}>
                  {template.purpose}
                </span>
                <span className="text-xs font-semibold text-[#7B8782]">{template.inputCount}개 입력</span>
              </div>
              <h2 className="mt-4 text-lg font-bold text-[#24312D]">{template.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#65736E]">{template.description}</p>
              <div className="mt-4 rounded-xl bg-[#F8FBFA] p-3 text-xs leading-5 text-[#65736E]">
                <p>샘플 원본: {template.sample.sourceName}</p>
                <p>출력 형식: {template.outputFormats.join(' / ')}</p>
              </div>
              <div className="mt-auto flex gap-2 pt-5">
                <Button type="button" variant="secondary" className="flex-1 px-3" onClick={() => setPreviewTemplate(template)}>
                  샘플 보기
                </Button>
                <Button type="button" className="flex-1 px-3" onClick={() => builder.selectTemplate(template)}>
                  초안 열기
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {builder.currentStep === 'info' ? (
        <Card className="rounded-2xl">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">선택 정보 보완</p>
            <h2 className="mt-1 text-2xl font-bold text-[#24312D]">{builder.selectedTemplate.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#65736E]">
              이 단계는 선택 사항입니다. HWPX 초안 화면에서 바로 수정해도 되고, 여기서 AI에게 전달할 기본 정보를 조금 더 적어도 됩니다.
            </p>
          </div>
          <FieldGrid fields={coreFields} values={builder.inputValues} onChange={builder.setInputValue} />
          <details className="mt-5 rounded-2xl border border-[#E4EBE7] bg-[#FBFCFB] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#245D50]">선택 입력 더보기</summary>
            <FieldGrid fields={optionalFields} values={builder.inputValues} onChange={builder.setInputValue} />
          </details>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => builder.setCurrentStep('preview')}>HWPX 초안으로 돌아가기</Button>
            <Button disabled={builder.isGenerating} onClick={builder.generateDraft}>
              {builder.isGenerating ? 'AI 초안 생성 중' : 'AI 초안 생성'}
            </Button>
          </div>
        </Card>
      ) : null}

      {builder.currentStep === 'generate' ? (
        <Card className="rounded-2xl text-center">
          <p className="text-sm font-bold text-[#3A7A68]">AI 초안 생성</p>
          <h2 className="mt-2 text-2xl font-bold text-[#24312D]">공고문 구조와 문장을 정리하고 있습니다.</h2>
          <div className="mx-auto mt-6 h-3 max-w-xl overflow-hidden rounded-full bg-[#E4EBE7]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#6A9C89]" />
          </div>
          <p className="mt-4 text-sm text-[#65736E]">현재 HWPX 초안의 제목, 일정, 본문, 문의처를 기준으로 보강합니다.</p>
        </Card>
      ) : null}

      {builder.currentStep === 'preview' && builder.draftDocument ? (
        <Card className="rounded-2xl p-4 lg:p-5">
          <NoticeWebEditor
            document={builder.draftDocument}
            warnings={builder.warnings}
            exporting={builder.exporting}
            onChange={(document) => builder.updateDraft(() => document)}
            onBackToInfo={() => builder.setCurrentStep('info')}
            onRegenerate={builder.generateDraft}
            onDownload={builder.download}
          />
        </Card>
      ) : null}

      {builder.currentStep === 'download' && builder.draftDocument ? (
        <Card className="rounded-2xl">
          <p className="text-sm font-bold text-[#3A7A68]">다운로드</p>
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">검토한 공고문을 HWPX, DOCX, PDF로 내려받을 수 있습니다.</h2>
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

function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: NoticeTemplate['fields'];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <label key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
          <span className="text-sm font-bold text-[#34443F]">
            {field.label}
            {field.required ? <span className="ml-1 text-[#B95050]">*</span> : null}
          </span>
          {field.type === 'textarea' ? (
            <textarea
              value={values[field.id] ?? ''}
              onChange={(event) => onChange(field.id, event.target.value)}
              placeholder={field.placeholder}
              className="mt-2 min-h-24 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 text-[#24312D] outline-none transition focus:border-[#6A9C89]"
            />
          ) : (
            <input
              value={values[field.id] ?? ''}
              onChange={(event) => onChange(field.id, event.target.value)}
              placeholder={field.placeholder}
              type={field.type === 'date' ? 'text' : field.type}
              className="mt-2 h-12 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 text-sm text-[#24312D] outline-none transition focus:border-[#6A9C89]"
            />
          )}
        </label>
      ))}
    </div>
  );
}
