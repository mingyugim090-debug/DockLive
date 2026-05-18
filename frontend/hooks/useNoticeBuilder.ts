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

export type NoticeBuilderStep = 'template' | 'info' | 'upload' | 'generate' | 'preview' | 'download';

export const noticeSteps: Array<{ id: NoticeBuilderStep; label: string }> = [
  { id: 'template', label: '공고문 유형 선택' },
  { id: 'info', label: '기본 정보 입력' },
  { id: 'upload', label: '참고자료 업로드' },
  { id: 'generate', label: 'AI 초안 생성' },
  { id: 'preview', label: '문서 미리보기' },
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

export function useNoticeBuilder(initialTemplateId?: string | null) {
  const [currentStep, setCurrentStep] = useState<NoticeBuilderStep>(initialTemplateId ? 'info' : 'template');
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId || 'startup_camp_notice');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [draftDocument, setDraftDocument] = useState<NoticeDocument | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exporting, setExporting] = useState<'HWPX' | 'PDF' | 'DOCX' | null>(null);

  const selectedTemplate = useMemo(() => getNoticeTemplate(selectedTemplateId), [selectedTemplateId]);
  const stepIndex = noticeSteps.findIndex((step) => step.id === currentStep);

  const selectTemplate = useCallback((template: NoticeTemplate | string) => {
    const templateId = typeof template === 'string' ? template : template.id;
    setSelectedTemplateId(templateId);
    setDraftDocument(null);
    setWarnings([]);
    setError(null);
    setCurrentStep('info');
  }, []);

  const setInputValue = useCallback((id: string, value: string) => {
    setInputValues((current) => ({ ...current, [id]: value }));
  }, []);

  const missingRequired = useMemo(
    () => selectedTemplate.fields.filter((field) => field.required && !inputValues[field.id]?.trim()),
    [inputValues, selectedTemplate.fields],
  );

  const addReferenceFiles = useCallback((files: FileList | File[]) => {
    const next = Array.from(files);
    setReferenceFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}`));
      return [...current, ...next.filter((file) => !seen.has(`${file.name}-${file.size}`))];
    });
  }, []);

  const removeReferenceFile = useCallback((name: string) => {
    setReferenceFiles((current) => current.filter((file) => file.name !== name));
  }, []);

  const generateDraft = useCallback(async () => {
    if (missingRequired.length > 0) {
      setError('필수 정보를 먼저 입력해 주세요.');
      setCurrentStep('info');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setWarnings([]);
    setCurrentStep('generate');
    try {
      const response = await generateNoticeDocument(selectedTemplateId, inputValues, referenceFiles);
      setDraftDocument(response.data);
      setWarnings(response.warnings ?? []);
      setCurrentStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '공고문 초안 생성에 실패했습니다.');
      setCurrentStep('upload');
    } finally {
      setIsGenerating(false);
    }
  }, [inputValues, missingRequired.length, referenceFiles, selectedTemplateId]);

  const updateDraft = useCallback((updater: (document: NoticeDocument) => NoticeDocument) => {
    setDraftDocument((current) => (current ? updater(current) : current));
  }, []);

  const download = useCallback(async (format: 'HWPX' | 'PDF' | 'DOCX') => {
    if (!draftDocument) return;
    setExporting(format);
    setError(null);
    try {
      const exported =
        format === 'HWPX'
          ? await exportNoticeHwpx(draftDocument)
          : format === 'PDF'
            ? await exportNoticePdf(draftDocument)
            : await exportNoticeDocx(draftDocument);
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
    setReferenceFiles([]);
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
    referenceFiles,
    draftDocument,
    warnings,
    error,
    isGenerating,
    exporting,
    missingRequired,
    setCurrentStep,
    selectTemplate,
    setInputValue,
    addReferenceFiles,
    removeReferenceFile,
    generateDraft,
    updateDraft,
    download,
    reset,
  };
}
