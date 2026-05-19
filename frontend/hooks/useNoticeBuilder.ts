'use client';

import { useCallback, useMemo, useState } from 'react';
import { getNoticeTemplate, type NoticeTemplate } from '@/data/mockTemplates';
import {
  composeHwpxDocument,
  exportHwpxToPdf,
  exportNoticeDocx,
  exportNoticeHwpx,
  exportNoticePdf,
  generateNoticeDocument,
} from '@/lib/api';
import type { ExportResponse, NoticeDocument } from '@/lib/types';

export type NoticeBuilderStep = 'template' | 'info' | 'generate' | 'preview' | 'download';
export type NoticeAiTarget =
  | { type: 'title' }
  | { type: 'summary' }
  | { type: 'section'; index: number }
  | { type: 'original'; id: string; label: string }
  | { type: 'schedule' }
  | { type: 'contact' }
  | { type: 'attachments' };

export type HwpxOriginalEdits = Record<string, { before: string; after: string }>;

export const noticeSteps: Array<{ id: NoticeBuilderStep; label: string }> = [
  { id: 'template', label: '공고문 유형 선택' },
  { id: 'preview', label: 'HWPX 초안 편집' },
  { id: 'generate', label: 'AI 초안 생성' },
  { id: 'download', label: '다운로드' },
];

function downloadExportResponse(exported: ExportResponse) {
  const bytes = Uint8Array.from(atob(exported.content), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: exported.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function linesToText(lines: string[]) {
  return lines.filter(Boolean).join('\n');
}

function isHwpxLikeFile(file: File) {
  return /\.(hwp|hwpx)$/i.test(file.name);
}

function inferTemplateIdFromFile(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.includes('장학')) return 'scholarship_notice';
  if (lower.includes('입찰') || lower.includes('제안') || lower.includes('rfp')) return 'bid_rfp_notice';
  if (lower.includes('입주')) return 'tenant_company_notice';
  if (lower.includes('교육') || lower.includes('수강')) return 'education_program_notice';
  if (lower.includes('연구')) return 'research_participant_notice';
  if (lower.includes('행사') || lower.includes('참가')) return 'event_participant_notice';
  if (lower.includes('지원') || lower.includes('기업')) return 'business_support_notice';
  return 'startup_camp_notice';
}

function titleFromFile(file: File) {
  return file.name.replace(/\.(hwp|hwpx)$/i, '').replace(/[_+]+/g, ' ').trim() || '업로드한 HWPX 신청서';
}

export function createDraftFromTemplate(template: NoticeTemplate): NoticeDocument {
  const row = (label: string) => template.sample.overviewRows.find(([name]) => name.includes(label))?.[1] ?? '';
  return normalizeNoticeDocument({
    documentType: template.id,
    title: template.sample.title,
    organization: template.sample.organization,
    purpose: template.purpose,
    applicationMethod: row('신청') || row('제출') || '붙임 서식을 작성하여 담당 부서 이메일 또는 접수 시스템으로 제출합니다.',
    schedule: {
      applicationPeriod: row('기간') || '2026. 6. 1.(월) ~ 6. 20.(금) 18:00',
      eventPeriod: row('운영') || row('사업') || '선정 이후 별도 안내',
    },
    contact: {
      department: '담당 부서',
      phone: '02-000-0000',
      email: 'notice@example.go.kr',
    },
    sections: template.sample.sections.map((section) => ({
      heading: section.heading,
      body: linesToText(section.body),
    })),
    attachments: template.sample.attachments,
  });
}

export function createDraftFromUploadedFile(file: File, template: NoticeTemplate): NoticeDocument {
  const title = titleFromFile(file);
  return normalizeNoticeDocument({
    documentType: `uploaded:${template.id}`,
    title,
    organization: template.sample.organization,
    purpose: template.purpose,
    applicationMethod: '업로드한 원본 HWPX 양식의 안내에 따라 제출합니다.',
    schedule: {
      applicationPeriod: '원본 공고문 확인 필요',
      eventPeriod: '원본 공고문 확인 필요',
    },
    contact: {
      department: '원본 공고문 확인 필요',
      phone: '',
      email: '',
    },
    sections: [
      { heading: '1. 기본정보', body: '문서 왼쪽의 제목, 일정, 문의처, 신청자 정보 영역을 클릭해 직접 입력하세요.' },
      { heading: '2. 신청동기 및 필요성', body: '요청사항 프롬프트를 입력하면 AI가 원본 양식 맥락에 맞춰 긴 글 초안을 작성합니다.' },
      { heading: '3. 세부 추진계획', body: '목표, 실행 일정, 역할 분담, 운영 방식 등 신청서의 핵심 서술을 작성합니다.' },
      { heading: '4. 예산 및 자원 활용계획', body: '금액을 확정할 수 없으면 항목 중심으로 작성하고, 제출 전 실제 기준을 확인합니다.' },
      { heading: '5. 제출 전 확인사항', body: '개인정보, 서명·날인, 증빙서류, 마감일은 제출 전 직접 확인해야 합니다.' },
    ],
    attachments: template.sample.attachments,
  });
}

export function normalizeNoticeDocument(document: Partial<NoticeDocument> | null | undefined): NoticeDocument {
  const fallback = getNoticeTemplate('startup_camp_notice');
  const base = createPlainTemplateDraft(fallback);
  return {
    ...base,
    ...document,
    documentType: document?.documentType || base.documentType,
    title: document?.title || base.title,
    organization: document?.organization || base.organization,
    purpose: document?.purpose || base.purpose,
    applicationMethod: document?.applicationMethod || base.applicationMethod,
    schedule: {
      applicationPeriod: document?.schedule?.applicationPeriod || base.schedule.applicationPeriod,
      eventPeriod: document?.schedule?.eventPeriod || base.schedule.eventPeriod,
    },
    contact: {
      department: document?.contact?.department || base.contact.department,
      phone: document?.contact?.phone || base.contact.phone,
      email: document?.contact?.email || base.contact.email,
    },
    sections: document?.sections?.length ? document.sections : base.sections,
    attachments: document?.attachments?.length ? document.attachments : base.attachments,
  };
}

function createPlainTemplateDraft(template: NoticeTemplate): NoticeDocument {
  return {
    documentType: template.id,
    title: template.sample.title,
    organization: template.sample.organization,
    purpose: template.purpose,
    applicationMethod: '붙임 서식을 작성하여 담당 부서 이메일 또는 접수 시스템으로 제출합니다.',
    schedule: {
      applicationPeriod: '2026. 6. 1.(월) ~ 6. 20.(금) 18:00',
      eventPeriod: '선정 이후 별도 안내',
    },
    contact: {
      department: '담당 부서',
      phone: '02-000-0000',
      email: 'notice@example.go.kr',
    },
    sections: template.sample.sections.map((section) => ({ heading: section.heading, body: linesToText(section.body) })),
    attachments: template.sample.attachments,
  };
}

function documentToInputs(document: NoticeDocument, existing: Record<string, string>): Record<string, string> {
  const byHeading = (keyword: string) => document.sections.find((section) => section.heading.includes(keyword))?.body ?? '';
  return {
    ...existing,
    title: document.title,
    organization: document.organization,
    target: existing.target || byHeading('대상') || byHeading('자격'),
    capacity: existing.capacity || byHeading('인원') || byHeading('규모'),
    applicationPeriod: document.schedule.applicationPeriod,
    eventPeriod: document.schedule.eventPeriod,
    applicationMethod: document.applicationMethod,
    selectionCriteria: existing.selectionCriteria || byHeading('선정') || byHeading('평가'),
    benefit: existing.benefit || byHeading('지원'),
    documents: existing.documents || byHeading('서류'),
    department: document.contact.department,
    phone: document.contact.phone,
    email: document.contact.email,
    attachments: document.attachments.join('\n'),
  };
}

function buildComposeRequest(document: NoticeDocument, inputs: Record<string, string>): string {
  const sectionText = document.sections
    .map((section) => `${section.heading}\n${section.body}`)
    .join('\n\n');
  return [
    `문서 제목: ${document.title}`,
    `기관명: ${document.organization}`,
    `작성 목적: ${document.purpose}`,
    `신청 기간: ${document.schedule.applicationPeriod}`,
    `운영 기간: ${document.schedule.eventPeriod}`,
    `접수 방법: ${document.applicationMethod}`,
    `문의처: ${document.contact.department} / ${document.contact.phone} / ${document.contact.email}`,
    '작성 지시: 업로드한 HWPX/HWP 원본 양식의 표와 서식을 최대한 보존하고, 기본정보는 사용자가 입력한 값만 반영하며, 긴 서술형 칸은 아래 섹션 내용을 공식 신청서 문체로 채워 주세요.',
    sectionText,
    inputs.aiPrompt ? `추가 요청사항: ${inputs.aiPrompt}` : '',
  ].filter(Boolean).join('\n');
}

function buildOriginalEditInstructions(originalEdits: HwpxOriginalEdits): string {
  const edits = Object.values(originalEdits)
    .filter((edit) => edit.after.trim() && edit.after.trim() !== edit.before.trim())
    .map((edit, index) => [`[원본 수정 ${index + 1}]`, `기존: ${edit.before}`, `수정: ${edit.after}`].join('\n'));
  return edits.length
    ? ['업로드한 HWPX 원본 화면에서 사용자가 직접 수정한 내용입니다. 원본 양식의 해당 문구 또는 가장 가까운 입력 칸에 반영해 주세요.', ...edits].join('\n\n')
    : '';
}

function buildApplicantContext(inputs: Record<string, string>) {
  return Object.entries(inputs)
    .filter(([key, value]) => value.trim() && !['aiPrompt'].includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function headingKey(value: string) {
  return value.replace(/^\d+\.\s*/, '').trim();
}

function mergeGeneratedTarget(base: NoticeDocument, generated: NoticeDocument, target: NoticeAiTarget): NoticeDocument {
  if (target.type === 'title') {
    return { ...base, title: generated.title || base.title, organization: generated.organization || base.organization };
  }
  if (target.type === 'summary') {
    return { ...base, purpose: generated.purpose || base.purpose };
  }
  if (target.type === 'schedule') {
    return {
      ...base,
      schedule: generated.schedule,
      applicationMethod: generated.applicationMethod || base.applicationMethod,
    };
  }
  if (target.type === 'contact') {
    return { ...base, contact: generated.contact };
  }
  if (target.type === 'attachments') {
    return { ...base, attachments: generated.attachments.length ? generated.attachments : base.attachments };
  }
  if (target.type === 'original') {
    return base;
  }

  const baseSection = base.sections[target.index];
  const generatedSection =
    generated.sections.find((section) => headingKey(section.heading) === headingKey(baseSection?.heading ?? '')) ??
    generated.sections[target.index];
  if (!baseSection || !generatedSection) return base;
  return {
    ...base,
    sections: base.sections.map((section, index) =>
      index === target.index
        ? {
            ...section,
            heading: generatedSection.heading || section.heading,
            body: generatedSection.body || section.body,
          }
        : section,
    ),
  };
}

async function exportUploadedHwpx(
  sourceFile: File,
  document: NoticeDocument,
  inputs: Record<string, string>,
  originalEdits: HwpxOriginalEdits,
  format: 'HWPX' | 'PDF',
): Promise<ExportResponse> {
  const requestText = [buildComposeRequest(document, inputs), buildOriginalEditInstructions(originalEdits)].filter(Boolean).join('\n\n');
  const composed = await composeHwpxDocument(
    sourceFile,
    requestText,
    buildApplicantContext(inputs),
    document.title,
  );
  if (format === 'HWPX') return composed;
  return exportHwpxToPdf(composed.content, composed.filename, document.title);
}

function buildLocalAiDraft(document: NoticeDocument): NoticeDocument {
  const ensure = (headingKeyword: string, fallbackHeading: string, body: string) => {
    const existing = document.sections.find((section) => section.heading.includes(headingKeyword));
    if (existing) {
      return {
        ...existing,
        body: existing.body.includes(body.slice(0, 24)) ? existing.body : `${existing.body.trim()}\n\n${body}`,
      };
    }
    return { heading: fallbackHeading, body };
  };

  const sections = [
    ensure('개요', '1. 사업 개요', `${document.organization}은(는) ${document.purpose}의 목적에 맞는 대상자를 모집하고, 신청 접수부터 선정 안내까지 표준 절차에 따라 운영합니다.`),
    ensure('대상', '2. 신청 자격', '신청 대상은 공고 목적에 부합하고 제출 서류를 기한 내 완비할 수 있는 개인, 팀 또는 기관입니다. 세부 자격과 제외 대상은 붙임 서식 및 증빙자료로 확인합니다.'),
    ensure('선정', '3. 선정 방법', '선정은 신청 자격 충족 여부, 제출 서류의 완성도, 사업 목적과의 적합성, 수행 가능성, 기대 효과를 종합적으로 검토하여 진행합니다.'),
    ensure('방법', '4. 신청 방법', document.applicationMethod || '신청자는 공고문 붙임 양식을 작성하여 접수 기간 내 담당 부서 이메일 또는 접수 시스템으로 제출합니다.'),
    ...document.sections.filter(
      (section) => !['개요', '대상', '자격', '선정', '평가', '방법'].some((keyword) => section.heading.includes(keyword)),
    ),
  ].map((section, index) => ({
    ...section,
    heading: section.heading.match(/^\d+\./) ? section.heading : `${index + 1}. ${section.heading}`,
  }));

  return {
    ...document,
    sections,
    attachments: Array.from(new Set([...document.attachments, '제출 서류 체크리스트', '개인정보 수집 및 이용 동의서'])),
  };
}

export function useNoticeBuilder(initialTemplateId?: string | null) {
  const initialTemplate = getNoticeTemplate(initialTemplateId || 'startup_camp_notice');
  const [currentStep, setCurrentStep] = useState<NoticeBuilderStep>(initialTemplateId ? 'preview' : 'template');
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate.id);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [draftDocument, setDraftDocument] = useState<NoticeDocument | null>(
    initialTemplateId ? createDraftFromTemplate(initialTemplate) : null,
  );
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [originalEdits, setOriginalEdits] = useState<HwpxOriginalEdits>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exporting, setExporting] = useState<'HWPX' | 'PDF' | 'DOCX' | null>(null);

  const selectedTemplate = useMemo(() => getNoticeTemplate(selectedTemplateId), [selectedTemplateId]);
  const stepIndex = noticeSteps.findIndex((step) => step.id === currentStep);

  const selectTemplate = useCallback((template: NoticeTemplate | string) => {
    const resolved = typeof template === 'string' ? getNoticeTemplate(template) : template;
    const draft = createDraftFromTemplate(resolved);
    setSelectedTemplateId(resolved.id);
    setInputValues(documentToInputs(draft, {}));
    setDraftDocument(draft);
    setSourceFiles([]);
    setSourceFileName(null);
    setOriginalEdits({});
    setWarnings([]);
    setError(null);
    setCurrentStep('preview');
  }, []);

  const selectUploadedFile = useCallback((file: File) => {
    if (!isHwpxLikeFile(file)) {
      setError('업로드 편집은 HWPX 또는 HWP 양식 파일만 지원합니다.');
      return;
    }
    const resolved = getNoticeTemplate(inferTemplateIdFromFile(file.name));
    const draft = createDraftFromUploadedFile(file, resolved);
    setSelectedTemplateId(resolved.id);
    setInputValues(documentToInputs(draft, {}));
    setDraftDocument(draft);
    setSourceFiles([file]);
    setSourceFileName(file.name);
    setOriginalEdits({});
    setWarnings(['업로드한 원본 양식은 다운로드 시 HWPX 자동작성 엔진에 전달되어 가능한 한 서식을 보존합니다.']);
    setError(null);
    setCurrentStep('preview');
  }, []);

  const setInputValue = useCallback((id: string, value: string) => {
    setInputValues((current) => ({ ...current, [id]: value }));
  }, []);

  const missingRequired = useMemo(
    () => selectedTemplate.fields.filter((field) => field.required && !inputValues[field.id]?.trim()),
    [inputValues, selectedTemplate.fields],
  );

  const generateDraft = useCallback(async () => {
    const baseDraft = normalizeNoticeDocument(draftDocument ?? createDraftFromTemplate(selectedTemplate));
    const payloadInputs = documentToInputs(baseDraft, inputValues);
    setIsGenerating(true);
    setError(null);
    setWarnings([]);
    setCurrentStep('generate');
    try {
      const response = await generateNoticeDocument(selectedTemplateId, payloadInputs, sourceFiles);
      const normalized = normalizeNoticeDocument(response.data);
      setDraftDocument(normalized);
      setInputValues(documentToInputs(normalized, payloadInputs));
      setWarnings(response.warnings ?? []);
      setCurrentStep('preview');
    } catch (err) {
      const fallbackDraft = normalizeNoticeDocument(buildLocalAiDraft(baseDraft));
      setDraftDocument(fallbackDraft);
      setInputValues(documentToInputs(fallbackDraft, payloadInputs));
      setWarnings([
        err instanceof Error ? err.message : 'AI 서버 응답을 받지 못해 현재 초안을 기준으로 자동 보강했습니다.',
        '서버 응답이 복구되면 같은 버튼으로 다시 AI 초안 생성을 시도할 수 있습니다.',
      ]);
      setCurrentStep('preview');
    } finally {
      setIsGenerating(false);
    }
  }, [draftDocument, inputValues, selectedTemplate, selectedTemplateId, sourceFiles]);

  const applyAiRequest = useCallback(async ({
    prompt,
    scope,
    target,
  }: {
    prompt: string;
    scope: 'selected' | 'all';
    target: NoticeAiTarget;
  }) => {
    const command = prompt.trim();
    if (!command) return;
    const baseDraft = normalizeNoticeDocument(draftDocument ?? createDraftFromTemplate(selectedTemplate));
    const payloadInputs = {
      ...documentToInputs(baseDraft, inputValues),
      aiPrompt: command,
      aiScope: scope,
      aiTarget: target.type === 'section' ? baseDraft.sections[target.index]?.heading ?? '' : target.type,
      aiTargetBody: target.type === 'section' ? baseDraft.sections[target.index]?.body ?? '' : '',
    };
    setIsGenerating(true);
    setError(null);
    try {
      const response = await generateNoticeDocument(selectedTemplateId, payloadInputs, sourceFiles);
      const generated = normalizeNoticeDocument(response.data);
      const next =
        scope === 'all'
          ? generated
          : mergeGeneratedTarget(baseDraft, generated, target);
      setDraftDocument(next);
      setInputValues(documentToInputs(next, payloadInputs));
      setWarnings(response.warnings ?? []);
    } catch (err) {
      setWarnings([
        err instanceof Error ? err.message : 'AI 요청을 처리하지 못했습니다.',
        '현재 선택 영역은 그대로 유지했습니다. 서버 연결 후 다시 시도해 주세요.',
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [draftDocument, inputValues, selectedTemplate, selectedTemplateId, sourceFiles]);

  const updateDraft = useCallback((updater: (document: NoticeDocument) => NoticeDocument) => {
    setDraftDocument((current) => {
      const next = normalizeNoticeDocument(updater(normalizeNoticeDocument(current)));
      setInputValues((values) => documentToInputs(next, values));
      return next;
    });
  }, []);

  const updateOriginalEdit = useCallback((id: string, before: string, after: string) => {
    setOriginalEdits((current) => {
      const next = { ...current };
      if (!after.trim() || after.trim() === before.trim()) {
        delete next[id];
      } else {
        next[id] = { before, after };
      }
      return next;
    });
  }, []);

  const download = useCallback(async (format: 'HWPX' | 'PDF' | 'DOCX') => {
    if (!draftDocument) return;
    const normalized = normalizeNoticeDocument(draftDocument);
    setExporting(format);
    setError(null);
    try {
      const exported =
        sourceFiles[0] && isHwpxLikeFile(sourceFiles[0]) && format !== 'DOCX'
          ? await exportUploadedHwpx(sourceFiles[0], normalized, inputValues, originalEdits, format)
          : format === 'HWPX'
            ? await exportNoticeHwpx(normalized)
            : format === 'PDF'
              ? await exportNoticePdf(normalized)
              : await exportNoticeDocx(normalized);
      downloadExportResponse(exported);
      setCurrentStep('download');
    } catch (err) {
      setError(err instanceof Error ? err.message : `${format} 다운로드 생성에 실패했습니다.`);
    } finally {
      setExporting(null);
    }
  }, [draftDocument, inputValues, originalEdits, sourceFiles]);

  const reset = useCallback(() => {
    setCurrentStep('template');
    setInputValues({});
    setDraftDocument(null);
    setSourceFiles([]);
    setSourceFileName(null);
    setOriginalEdits({});
    setWarnings([]);
    setError(null);
  }, []);

  return {
    currentStep,
    stepIndex,
    selectedTemplate,
    selectedTemplateId,
    inputValues,
    draftDocument,
    sourceFile: sourceFiles[0] ?? null,
    sourceFileName,
    originalEdits,
    warnings,
    error,
    isGenerating,
    exporting,
    missingRequired,
    setCurrentStep,
    selectTemplate,
    selectUploadedFile,
    setInputValue,
    generateDraft,
    applyAiRequest,
    updateDraft,
    updateOriginalEdit,
    download,
    reset,
  };
}
