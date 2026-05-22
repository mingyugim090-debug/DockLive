'use client';

import { useMemo, useState } from 'react';
import { sampleTemplates, type SampleTemplate } from '@/data/sampleTemplates';
import { exportNoticeHwpx } from '@/lib/api';
import type { HwpxBlock, HwpxDocumentModel, HwpxPage, HwpxTableBlock, NoticeDocument } from '@/lib/types';
import { HwpxSamplePreview } from './HwpxSamplePreview';

type NoticeRequestValues = {
  title: string;
  organization: string;
  target: string;
  capacity: string;
  applicationPeriod: string;
  eventPeriod: string;
  applicationMethod: string;
  selectionCriteria: string;
  benefit: string;
  documents: string;
  department: string;
  phone: string;
  email: string;
  attachments: string;
  requestMemo: string;
};

type ExportState = {
  status: 'idle' | 'exporting' | 'done' | 'error';
  message: string;
};

const fieldGroups: Array<{
  title: string;
  fields: Array<{
    id: keyof NoticeRequestValues;
    label: string;
    type?: 'text' | 'textarea';
    required?: boolean;
    placeholder: string;
  }>;
}> = [
  {
    title: '기본 정보',
    fields: [
      { id: 'title', label: '공고 제목', required: true, placeholder: '예: 2026년 청년 창업캠프 참가자 모집 공고' },
      { id: 'organization', label: '기관명', required: true, placeholder: '예: OO시청 / OO산업진흥원' },
    ],
  },
  {
    title: '공고 요건',
    fields: [
      { id: 'target', label: '대상', type: 'textarea', required: true, placeholder: '신청 자격, 제외 대상, 우대 조건' },
      { id: 'capacity', label: '규모', placeholder: '예: 30명 내외 / 20개사 내외' },
      { id: 'applicationPeriod', label: '접수 기간', required: true, placeholder: '예: 2026. 6. 1.(월) ~ 6. 20.(금) 18:00' },
      { id: 'eventPeriod', label: '운영 기간', placeholder: '예: 선정 이후 ~ 2026. 11. 30.' },
    ],
  },
  {
    title: '제출 및 심사',
    fields: [
      { id: 'applicationMethod', label: '신청 방법', type: 'textarea', required: true, placeholder: '접수처, 제출 방식, 파일명 규칙' },
      { id: 'selectionCriteria', label: '선정 기준', type: 'textarea', placeholder: '심사 항목, 배점, 평가 절차' },
      { id: 'benefit', label: '지원 내용', type: 'textarea', placeholder: '지원금, 교육, 멘토링, 공간, 홍보 등' },
      { id: 'documents', label: '제출 서류', type: 'textarea', placeholder: '신청서, 사업계획서, 개인정보 동의서' },
    ],
  },
  {
    title: '문의 및 붙임',
    fields: [
      { id: 'department', label: '담당 부서', placeholder: '예: 창업지원팀' },
      { id: 'phone', label: '연락처', placeholder: '예: 02-000-0000' },
      { id: 'email', label: '이메일', placeholder: '예: notice@example.go.kr' },
      { id: 'attachments', label: '붙임 문서', type: 'textarea', placeholder: '붙임 1. 신청서\n붙임 2. 개인정보 동의서' },
      { id: 'requestMemo', label: '작성 요청사항', type: 'textarea', placeholder: '표현 톤, 반드시 들어갈 문구, 기관 내부 기준' },
    ],
  },
];

function rowValue(template: SampleTemplate, keywords: string[], fallback = '') {
  const row = template.sample.overviewRows.find(([label]) => keywords.some((keyword) => label.includes(keyword)));
  return row?.[1] ?? fallback;
}

function initialValues(template: SampleTemplate): NoticeRequestValues {
  return {
    title: template.sample.title,
    organization: template.sample.organization,
    target: rowValue(template, ['대상', '자격'], template.sample.sections.find((section) => /대상|자격/.test(section.heading))?.body.join('\n') ?? ''),
    capacity: rowValue(template, ['규모', '인원', '정원']),
    applicationPeriod: rowValue(template, ['신청 기간', '접수 기간', '제출 기간', '기간']),
    eventPeriod: rowValue(template, ['운영 기간', '사업 기간', '교육 기간', '행사 일시', '일정']),
    applicationMethod: template.sample.sections.find((section) => /방법|제출/.test(section.heading))?.body.join('\n') ?? '',
    selectionCriteria: template.sample.sections.find((section) => /선정|평가|심사/.test(section.heading))?.body.join('\n') ?? '',
    benefit: rowValue(template, ['지원 내용', '혜택'], template.sample.sections.find((section) => /지원|내용/.test(section.heading))?.body.join('\n') ?? ''),
    documents: template.sample.attachments.join('\n'),
    department: '담당 부서',
    phone: '02-000-0000',
    email: 'notice@example.go.kr',
    attachments: template.sample.attachments.map((item) => `${item} 1부`).join('\n'),
    requestMemo: '',
  };
}

function splitLines(value: string, fallback: string[] = []) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
}

function normalizeCellText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function fillValueByLabel(label: string, values: NoticeRequestValues) {
  if (/공고명|사업명|교육명|행사명|과업명/.test(label)) return values.title;
  if (/기관명|주관|소관|운영 기관/.test(label)) return values.organization;
  if (/모집 대상|지원 대상|참가 대상|신청 자격|참여 대상|대상/.test(label)) return values.target;
  if (/모집 규모|모집 인원|지원 규모|정원/.test(label)) return values.capacity;
  if (/신청 기간|접수 기간|제출 기간|공고 기간/.test(label)) return values.applicationPeriod;
  if (/운영 기간|사업 기간|교육 기간|행사 일시|참여 기간|수행 기간/.test(label)) return values.eventPeriod;
  if (/신청 방법|접수 방법|제출 방법/.test(label)) return values.applicationMethod;
  if (/선정 기준|평가 기준|심사 기준/.test(label)) return values.selectionCriteria;
  if (/지원 내용|혜택|운영 내용/.test(label)) return values.benefit;
  if (/제출 서류|필수 서류|서류/.test(label)) return values.documents;
  if (/담당 부서|부서|담당/.test(label)) return values.department;
  if (/연락처|전화/.test(label)) return values.phone;
  if (/이메일|메일/.test(label)) return values.email;
  return '';
}

function applyTableValues(block: HwpxTableBlock, values: NoticeRequestValues): HwpxTableBlock {
  const autoInputs = [
    values.title,
    values.organization,
    values.target,
    values.capacity,
    values.phone || values.email,
    values.applicationMethod,
  ].filter(Boolean);
  let inputCursor = 0;

  return {
    ...block,
    rows: block.rows.map((row) => {
      const cells = row.cells.map((cell) => ({ ...cell }));
      cells.forEach((cell, index) => {
        const label = normalizeCellText(cell.text);
        const next = cells[index + 1];
        const direct = fillValueByLabel(label, values);
        if (direct && next && !fillValueByLabel(normalizeCellText(next.text), values)) {
          next.text = direct;
        }
        if (/입력 필요|작성 내용|OOO/.test(label) && autoInputs[inputCursor]) {
          cell.text = autoInputs[inputCursor];
          inputCursor += 1;
        }
      });
      return { ...row, cells };
    }),
  };
}

function applyParagraphValue(block: HwpxBlock, lastHeading: string, values: NoticeRequestValues): HwpxBlock {
  if (block.type === 'heading' && block.level === 1) {
    return { ...block, text: values.title || block.text };
  }
  if (block.type !== 'paragraph') return block;
  if (/기관|지원단|진흥원|재단|센터|시청|군청|구청/.test(block.text) && block.style?.align === 'center') {
    return { ...block, text: values.organization || block.text };
  }
  if (/개요|목적/.test(lastHeading) && values.benefit) {
    return { ...block, text: `가. ${values.benefit}` };
  }
  if (/대상|자격/.test(lastHeading) && values.target) {
    return { ...block, text: `가. ${values.target}` };
  }
  if (/기간|일정/.test(lastHeading) && (values.applicationPeriod || values.eventPeriod)) {
    return { ...block, text: `가. 접수 기간: ${values.applicationPeriod || '공고문 참조'}\n나. 운영 기간: ${values.eventPeriod || '선정 이후 별도 안내'}` };
  }
  if (/선정|평가|심사/.test(lastHeading) && values.selectionCriteria) {
    return { ...block, text: `가. ${values.selectionCriteria}` };
  }
  if (/방법|제출/.test(lastHeading) && values.applicationMethod) {
    return { ...block, text: `가. ${values.applicationMethod}` };
  }
  if (/문의/.test(lastHeading) && (values.department || values.phone || values.email)) {
    return { ...block, text: `${values.department || '담당 부서'} / ${values.phone || '연락처'} / ${values.email || '이메일'}` };
  }
  if (/붙임/.test(lastHeading) && values.attachments) {
    return { ...block, text: splitLines(values.attachments).join('\n') };
  }
  return block;
}

function applyValuesToDocumentModel(template: SampleTemplate, values: NoticeRequestValues): HwpxDocumentModel | undefined {
  if (!template.sample.documentModel) return undefined;
  const model = JSON.parse(JSON.stringify(template.sample.documentModel)) as HwpxDocumentModel;
  model.title = values.title || model.title;
  model.metadata = {
    ...model.metadata,
    updatedAt: new Date().toISOString(),
  };
  model.pages = model.pages.map((page: HwpxPage) => {
    let lastHeading = '';
    return {
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.type === 'heading') lastHeading = block.text;
        if (block.type === 'table') return applyTableValues(block, values);
        if (block.type === 'signature') {
          return {
            ...block,
            dateText: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/\s/g, ''),
            organizationText: values.organization || block.organizationText,
          };
        }
        return applyParagraphValue(block, lastHeading, values);
      }),
    };
  });
  return model;
}

function buildNoticeDocument(template: SampleTemplate, values: NoticeRequestValues): NoticeDocument {
  const attachments = splitLines(values.attachments, template.sample.attachments);
  const sections = [
    {
      heading: '1. 사업 개요',
      body: values.benefit || template.sample.intro,
    },
    {
      heading: '2. 신청 자격 및 규모',
      body: [values.target, values.capacity ? `모집 규모: ${values.capacity}` : ''].filter(Boolean).join('\n'),
    },
    {
      heading: '3. 신청 기간 및 방법',
      body: [`접수 기간: ${values.applicationPeriod || '공고문 참조'}`, values.eventPeriod ? `운영 기간: ${values.eventPeriod}` : '', values.applicationMethod].filter(Boolean).join('\n'),
    },
    {
      heading: '4. 선정 기준',
      body: values.selectionCriteria || '제출 서류, 신청 자격, 사업 목적 적합성을 종합 검토하여 선정합니다.',
    },
    {
      heading: '5. 제출 서류',
      body: splitLines(values.documents, template.sample.attachments).join('\n'),
    },
  ];

  if (values.requestMemo.trim()) {
    sections.push({ heading: '6. 작성 요청사항', body: values.requestMemo.trim() });
  }

  return {
    documentType: template.id,
    title: values.title || template.sample.title,
    organization: values.organization || template.sample.organization,
    purpose: template.purpose,
    applicationMethod: values.applicationMethod || '붙임 서식을 작성하여 담당 부서로 제출합니다.',
    schedule: {
      applicationPeriod: values.applicationPeriod || '공고문 참조',
      eventPeriod: values.eventPeriod || '선정 이후 별도 안내',
    },
    contact: {
      department: values.department || '담당 부서',
      phone: values.phone,
      email: values.email,
    },
    sections,
    attachments,
    documentModel: applyValuesToDocumentModel(template, values),
  };
}

function downloadExport(content: string, contentType: string, filename: string) {
  const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function GovernmentNoticeTemplateStudio() {
  const [selectedId, setSelectedId] = useState(sampleTemplates[0]?.id ?? '');
  const selectedTemplate = sampleTemplates.find((template) => template.id === selectedId) ?? sampleTemplates[0]!;
  const [values, setValues] = useState<NoticeRequestValues>(() => initialValues(selectedTemplate));
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle', message: '' });

  const requestDocument = useMemo(() => buildNoticeDocument(selectedTemplate, values), [selectedTemplate, values]);
  const requiredDone = [values.title, values.organization, values.target, values.applicationPeriod, values.applicationMethod].filter((value) => value.trim()).length;

  function selectTemplate(template: SampleTemplate) {
    setSelectedId(template.id);
    setValues(initialValues(template));
    setExportState({ status: 'idle', message: '' });
  }

  function updateValue(id: keyof NoticeRequestValues, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    if (exportState.status !== 'idle') setExportState({ status: 'idle', message: '' });
  }

  async function exportHwpx() {
    setExportState({ status: 'exporting', message: 'HWPX 파일을 생성하고 있습니다.' });
    try {
      const exported = await exportNoticeHwpx(requestDocument);
      downloadExport(exported.content, exported.content_type, exported.filename);
      setExportState({ status: 'done', message: `${exported.filename} 다운로드를 준비했습니다.` });
    } catch (error) {
      setExportState({
        status: 'error',
        message: error instanceof Error ? error.message : 'HWPX 다운로드 생성에 실패했습니다.',
      });
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-[#DDE4EA] bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#475569]">Sample HWPX</p>
              <h2 className="mt-1 text-lg font-extrabold text-[#172033]">샘플 공고문</h2>
            </div>
            <span className="rounded-md bg-[#EDF4FF] px-2 py-1 text-xs font-bold text-[#2563EB]">{sampleTemplates.length}개</span>
          </div>
          <div className="mt-4 max-h-[660px] space-y-2 overflow-y-auto pr-1">
            {sampleTemplates.map((template) => {
              const active = template.id === selectedTemplate.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  aria-pressed={active}
                  className={[
                    'w-full rounded-lg border p-3 text-left transition',
                    active
                      ? 'border-[#2563EB] bg-[#F8FBFF] shadow-sm'
                      : 'border-[#E3E8EF] bg-white hover:border-[#B6C7E6] hover:bg-[#F8FAFC]',
                  ].join(' ')}
                >
                  <span className="text-[11px] font-bold text-[#64748B]">{template.category}</span>
                  <span className="mt-1 block text-sm font-extrabold leading-5 text-[#172033]">{template.name}</span>
                  <span className="mt-2 block text-xs leading-5 text-[#64748B]">{template.description}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {template.editableFields.slice(0, 4).map((field) => (
                      <span key={field} className="rounded-md bg-[#F1F5F9] px-2 py-1 text-[11px] font-semibold text-[#475569]">
                        {field}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-lg border border-[#DDE4EA] bg-[#F8FAFC] p-4 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-[#DDE4EA] pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold text-[#2563EB]">HWPX 구조 미리보기</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-normal text-[#172033]">{selectedTemplate.sample.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">{selectedTemplate.description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <span className="rounded-md border border-[#C9D6E8] bg-white px-3 py-2 text-xs font-bold text-[#334155]">{selectedTemplate.fileName}</span>
              <span className="rounded-md bg-[#ECFDF5] px-3 py-2 text-xs font-bold text-[#047857]">HWPX 출력</span>
            </div>
          </div>
          <div className="mt-4">
            <HwpxSamplePreview template={selectedTemplate} />
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-[#DDE4EA] bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-[#E3E8EF] pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold text-[#475569]">Production Request</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#172033]">공고문 제작 요청</h2>
            </div>
            <div className="w-full rounded-md bg-[#F8FAFC] p-2 md:w-56">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B]">
                <span>필수 입력</span>
                <span>{requiredDone}/5</span>
              </div>
              <div
                className="mt-2 h-2 rounded-full bg-[#E2E8F0]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={requiredDone}
              >
                <div className="h-2 rounded-full bg-[#2563EB]" style={{ width: `${(requiredDone / 5) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {fieldGroups.map((group) => (
              <fieldset key={group.title} className="rounded-lg border border-[#E3E8EF] p-4">
                <legend className="px-1 text-sm font-extrabold text-[#172033]">{group.title}</legend>
                <div className="mt-3 space-y-3">
                  {group.fields.map((field) => (
                    <label key={field.id} className="block">
                      <span className="flex items-center gap-1 text-xs font-bold text-[#475569]">
                        {field.label}
                        {field.required ? <span className="text-[#DC2626]">*</span> : null}
                      </span>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={values[field.id]}
                          onChange={(event) => updateValue(field.id, event.target.value)}
                          placeholder={field.placeholder}
                          required={Boolean(field.required)}
                          aria-invalid={field.required && !values[field.id].trim()}
                          rows={field.id === 'requestMemo' ? 5 : 3}
                          className="mt-1 min-h-24 w-full resize-y rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm leading-6 text-[#172033] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#DBEAFE]"
                        />
                      ) : (
                        <input
                          value={values[field.id]}
                          onChange={(event) => updateValue(field.id, event.target.value)}
                          placeholder={field.placeholder}
                          required={Boolean(field.required)}
                          aria-invalid={field.required && !values[field.id].trim()}
                          className="mt-1 h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm text-[#172033] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#DBEAFE]"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[#DDE4EA] bg-white p-4 shadow-panel">
          <div className="border-b border-[#E3E8EF] pb-4">
            <p className="text-xs font-bold text-[#475569]">Draft Output</p>
            <h2 className="mt-1 text-lg font-extrabold text-[#172033]">제작 결과 요약</h2>
          </div>

          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs font-bold text-[#64748B]">제목</p>
              <p className="mt-1 font-bold leading-6 text-[#172033]">{requestDocument.title}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B]">접수 기간</p>
              <p className="mt-1 leading-6 text-[#334155]">{requestDocument.schedule.applicationPeriod}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B]">문의처</p>
              <p className="mt-1 leading-6 text-[#334155]">
                {requestDocument.contact.department} / {requestDocument.contact.phone || '연락처'} / {requestDocument.contact.email || '이메일'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B]">문서 섹션</p>
              <div className="mt-2 space-y-2">
                {requestDocument.sections.map((section) => (
                  <div key={section.heading} className="rounded-md bg-[#F8FAFC] px-3 py-2">
                    <p className="text-xs font-extrabold text-[#172033]">{section.heading}</p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-[#64748B]">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B]">붙임</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-[#F8FAFC] px-3 py-2 text-xs leading-5 text-[#334155]">
                {requestDocument.attachments.join('\n')}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-[#E3E8EF] pt-4">
            <button
              type="button"
              onClick={exportHwpx}
              disabled={exportState.status === 'exporting'}
              className="h-11 w-full rounded-md bg-[#172033] px-4 text-sm font-bold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportState.status === 'exporting' ? 'HWPX 생성 중' : 'HWPX 다운로드'}
            </button>
            {exportState.message ? (
              <p className={['rounded-md px-3 py-2 text-xs leading-5', exportState.status === 'error' ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F0FDF4] text-[#047857]'].join(' ')}>
                {exportState.message}
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
