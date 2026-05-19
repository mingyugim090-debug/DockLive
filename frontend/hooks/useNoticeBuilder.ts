'use client';

import { useCallback, useMemo, useState } from 'react';
import { getNoticeTemplate, type NoticeTemplate } from '@/data/mockTemplates';
import {
  exportNoticeDocx,
  exportNoticeHwpx,
  exportNoticePdf,
  generateNoticeDocument,
} from '@/lib/api';
import type { ExportResponse, NoticeDocument } from '@/lib/types';

export type NoticeBuilderStep = 'template' | 'info' | 'generate' | 'preview' | 'download';

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
    setWarnings([]);
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
      const response = await generateNoticeDocument(selectedTemplateId, payloadInputs);
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
  }, [draftDocument, inputValues, selectedTemplate, selectedTemplateId]);

  const updateDraft = useCallback((updater: (document: NoticeDocument) => NoticeDocument) => {
    setDraftDocument((current) => {
      const next = normalizeNoticeDocument(updater(normalizeNoticeDocument(current)));
      setInputValues((values) => documentToInputs(next, values));
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
        format === 'HWPX'
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
  }, [draftDocument]);

  const reset = useCallback(() => {
    setCurrentStep('template');
    setInputValues({});
    setDraftDocument(null);
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
    warnings,
    error,
    isGenerating,
    exporting,
    missingRequired,
    setCurrentStep,
    selectTemplate,
    setInputValue,
    generateDraft,
    updateDraft,
    download,
    reset,
  };
}
