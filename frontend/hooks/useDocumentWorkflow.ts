'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getFileExtension,
  getTaskById,
  isSupportedDocument,
  processingSteps,
  type GeneratedDocument,
  type OutputFormat,
  type WorkflowTask,
  type WorkflowTaskId,
} from '@/data/workspaceTasks';
import {
  analyzeDocument,
  composeHwpxDocument,
  confirmWorkflow,
  exportHwpxToPdf,
  exportMarkdownToHwpx,
  exportPersistedHwpxToPdf,
  exportWorkflowHwpx,
  exportWorkflowPdf,
  finalizeWorkflow,
  generateDraft,
  getWorkflow,
  saveWorkflowInputs,
} from '@/lib/api';
import { saveResult } from '@/lib/resultCache';
import { buildMarkdownResult, downloadMarkdownResult } from '@/lib/workflow/downloadMarkdown';
import {
  consumePendingTemplate,
  loadWorkflowSettings,
  saveCompletedWorkflow,
  type PendingTemplateSelection,
  type WorkflowSettings,
} from '@/lib/workflow/workflowStore';
import type { WorkflowSession } from '@/lib/types';

export type WorkflowStep = 'upload' | 'task' | 'instructions' | 'review' | 'processing' | 'result';

function isHwpxTemplateFile(file: File | null): boolean {
  if (!file) return false;
  return ['.hwp', '.hwpx'].includes(getFileExtension(file.name));
}

function baseTitleFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '');
}

function downloadExportResponse(exported: { filename: string; content_type: string; content: string; encoding: 'text' | 'base64' }) {
  const payload = exported.encoding === 'base64'
    ? Uint8Array.from(atob(exported.content), (char) => char.charCodeAt(0))
    : exported.content;
  const blob = new Blob([payload], { type: exported.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildComposeRequest(task: WorkflowTask, instructions: string): string {
  const trimmed = instructions.trim();
  return [
    `작업 유형: ${task.name}`,
    '생성 목표: 업로드한 HWPX 신청서 양식의 표와 서식을 보존하면서 각 칸에 들어갈 제출용 초안을 작성합니다.',
    '작성 기준: 학교 제출용으로 단정하고 공식적인 문체를 사용하고, 서비스 설명이나 MVP 테스트 문구는 본문에 쓰지 않습니다.',
    '개인정보, 실제 날짜, 금액, 기관명처럼 확인되지 않은 정보는 임의로 확정하지 말고 확인 필요 항목으로 분리합니다.',
    `사용자 지시사항: ${trimmed || task.instructionHint}`,
  ].join('\n');
}

function composeToGeneratedDocument(
  file: File,
  task: WorkflowTask,
  instructions: string,
  composed: Awaited<ReturnType<typeof composeHwpxDocument>>,
): GeneratedDocument {
  const fields = composed.generated_fields ?? {};
  const title = fields.document_title || composed.filename.replace(/\.hwpx$/i, '') || `${baseTitleFromFile(file)} 자동작성 결과`;
  const confirmationItems = composed.confirmation_required ?? [];
  const markdown = [
    `# ${title}`,
    '',
    '## 동아리 소개 및 신청동기',
    fields.motivation || '확인 필요',
    '',
    '## 동아리목표',
    fields.goals || '확인 필요',
    '',
    '## 운영방법',
    fields.operation_plan || '확인 필요',
    '',
    '## 지원금 사용계획',
    fields.budget_plan || '확인 필요',
    fields.budget_items || '',
    '',
    '## 월별 활동계획',
    `- 학습내용: ${fields.monthly_plan || '확인 필요'}`,
    `- 학습방법: ${fields.monthly_method || '확인 필요'}`,
    '',
    '## 제출 전 확인 필요',
    ...(confirmationItems.length ? confirmationItems.map((item) => `- ${item}`) : ['- 개인정보와 실제 제출 기준을 확인해 주세요.']),
  ].filter(Boolean).join('\n');

  return {
    title,
    markdown,
    previewBlocks: [
      {
        title: '양식 보존 생성',
        body: `${composed.template_id} 양식으로 인식했고, 원본 HWPX 표와 서식을 보존한 상태로 필드별 내용을 채웠습니다.`,
      },
      {
        title: '핵심 작성 내용',
        body: fields.motivation || '동아리 소개와 신청동기 필드를 생성했습니다.',
        items: [fields.goals, fields.operation_plan, fields.budget_plan]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.slice(0, 120)),
      },
      {
        title: '검증 결과',
        body: composed.verification?.validation_passed
          ? 'HWPX 구조 검증을 통과했습니다. 제출 전 확인 필요 항목만 검토하면 됩니다.'
          : 'HWPX 구조 검증 결과를 확인해야 합니다.',
        items: confirmationItems,
      },
    ],
    hwpxCompose: composed,
  };
}

function workflowToGeneratedDocument(workflow: WorkflowSession, file: File, task: WorkflowTask): GeneratedDocument {
  const finalDocument = workflow.final_document;
  const markdown = finalDocument?.content_markdown || workflow.draft_sections.map((draft) => draft.content_markdown).filter(Boolean).join('\n\n');
  const confirmationItems = [
    ...workflow.analysis.uncertain_fields,
    ...workflow.draft_sections.flatMap((draft) => [...(draft.confirmation_required ?? []), ...(draft.needs_confirmation ?? [])]),
  ].filter(Boolean);

  return {
    title: finalDocument?.title || workflow.analysis.title || `${baseTitleFromFile(file)} generated document`,
    markdown,
    workflowId: workflow.id,
    previewBlocks: [
      {
        title: 'Analysis',
        body: workflow.analysis.summary || 'The uploaded document was analyzed by the backend workflow.',
        items: workflow.analysis.checklist.slice(0, 4).map((item) => item.label),
      },
      {
        title: 'Draft sections',
        body: `${workflow.draft_sections.length} sections were drafted from the analysis and user instructions.`,
        items: workflow.draft_sections.slice(0, 4).map((draft) => draft.title),
      },
      {
        title: 'Export readiness',
        body: 'The final document can be exported through the shared workflow HWPX/PDF endpoints.',
        items: confirmationItems.slice(0, 4),
      },
    ],
  };
}

function buildWorkflowInputs(workflow: WorkflowSession, file: File, task: WorkflowTask, instructions: string) {
  const fallback = [
    `Source file: ${file.name}`,
    `Task: ${task.name}`,
    instructions.trim() ? `User instructions: ${instructions.trim()}` : `Default instructions: ${task.instructionHint}`,
  ].join('\n');

  return workflow.user_inputs.map((field) => ({
    field_id: field.id,
    value:
      field.value ||
      (field.id === 'applicant_name'
        ? 'LiveDock user'
        : field.id === 'project_summary'
          ? instructions.trim() || task.description
          : fallback),
  }));
}

async function runBackendWorkflow(file: File, task: WorkflowTask, instructions: string): Promise<GeneratedDocument> {
  const analyzed = await analyzeDocument(file);
  saveResult(analyzed.data);
  const workflowRes = await getWorkflow(analyzed.data.id);
  const inputs = buildWorkflowInputs(workflowRes.data, file, task, instructions);
  await saveWorkflowInputs(workflowRes.data.id, inputs);
  const drafted = await generateDraft(workflowRes.data.id);
  const confirmationItems = [
    ...drafted.data.analysis.uncertain_fields,
    ...drafted.data.draft_sections.flatMap((draft) => [...(draft.confirmation_required ?? []), ...(draft.needs_confirmation ?? [])]),
  ].filter(Boolean);
  await confirmWorkflow(drafted.data.id, Array.from(new Set(confirmationItems)));
  const finalized = await finalizeWorkflow(drafted.data.id);
  return workflowToGeneratedDocument(finalized.data, file, task);
}

export function useDocumentWorkflow() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<WorkflowTaskId | null>(null);
  const [instructions, setInstructions] = useState('');
  const [progress, setProgress] = useState(0);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<GeneratedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<WorkflowSettings>(() => loadWorkflowSettings());
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(settings.outputFormat);
  const [selectedTemplate, setSelectedTemplate] = useState<PendingTemplateSelection | null>(null);
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);

  const selectedTask = useMemo(() => (selectedTaskId ? getTaskById(selectedTaskId) : null), [selectedTaskId]);

  useEffect(() => {
    if (!isProcessing || !uploadedFile || !selectedTaskId) return;

    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = Math.min(value + 7, 100);
        const nextIndex = Math.min(Math.floor((next / 100) * processingSteps.length), processingSteps.length - 1);
        setProcessingIndex(nextIndex);

        if (next >= 100) {
          window.clearInterval(timer);
          window.setTimeout(async () => {
            try {
              const task = getTaskById(selectedTaskId);
              let generated: GeneratedDocument;
              if (outputFormat === 'HWPX' && isHwpxTemplateFile(uploadedFile)) {
                const composed = await composeHwpxDocument(
                  uploadedFile,
                  buildComposeRequest(task, instructions),
                  '',
                  baseTitleFromFile(uploadedFile),
                );
                generated = composeToGeneratedDocument(uploadedFile, task, instructions, composed);
              } else {
                generated = await runBackendWorkflow(uploadedFile, task, instructions);
              }

              setResult(generated);
              const saved = saveCompletedWorkflow({
                file: uploadedFile,
                taskId: selectedTaskId,
                instructions,
                result: generated,
                outputFormat,
                templateName: selectedTemplate?.templateName,
              });
              setSavedDocumentId(saved.id);
              setIsProcessing(false);
              setCurrentStep('result');
            } catch (err) {
              setIsProcessing(false);
              setError(
                err instanceof Error
                  ? `${err.message} HWPX 양식 자동작성 서버를 확인해 주세요. 손상된 파일은 다운로드하지 않습니다.`
                  : 'HWPX 양식 자동작성에 실패했습니다. 손상된 파일은 다운로드하지 않습니다.',
              );
              setCurrentStep('review');
            }
          }, 350);
        }

        return next;
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, [instructions, isProcessing, outputFormat, selectedTaskId, selectedTemplate?.templateName, settings.processingMode, uploadedFile]);

  useEffect(() => {
    const pending = consumePendingTemplate();
    if (!pending) return;
    setSelectedTemplate(pending);
    setSelectedTaskId(pending.taskId);
    setOutputFormat(pending.outputFormat);
    setCurrentStep('upload');
  }, []);

  const setFile = (file: File) => {
    if (!isSupportedDocument(file)) {
      setError('지원하지 않는 파일 형식입니다. PDF, DOCX, HWP, HWPX, TXT, MD 파일을 업로드해 주세요.');
      return;
    }

    setUploadedFile(file);
    setResult(null);
    setError(null);
    setDownloadError(null);
    setSavedDocumentId(null);
    setProgress(0);
    setProcessingIndex(0);
    setCurrentStep('task');
  };

  const removeFile = () => {
    setUploadedFile(null);
    setResult(null);
    setError(null);
    setDownloadError(null);
    setSavedDocumentId(null);
    setProgress(0);
    setProcessingIndex(0);
    setCurrentStep('upload');
  };

  const selectTask = (taskId: WorkflowTaskId) => {
    setSelectedTaskId(taskId);
    setError(null);
    setCurrentStep('instructions');
  };

  const goToReview = () => {
    if (!uploadedFile) {
      setError('문서를 먼저 업로드해 주세요.');
      setCurrentStep('upload');
      return;
    }
    if (!selectedTaskId) {
      setError('문서 자동화 작업 유형을 선택해 주세요.');
      setCurrentStep('task');
      return;
    }
    setError(null);
    setCurrentStep('review');
  };

  const startGeneration = () => {
    if (!uploadedFile || !selectedTaskId || isProcessing) return;
    setResult(null);
    setError(null);
    setDownloadError(null);
    setProgress(0);
    setProcessingIndex(0);
    setIsProcessing(true);
    setCurrentStep('processing');
  };

  const regenerate = () => {
    startGeneration();
  };

  const resetWorkflow = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setSelectedTaskId(null);
    setInstructions('');
    setProgress(0);
    setProcessingIndex(0);
    setIsProcessing(false);
    setResult(null);
    setError(null);
  };

  const downloadHwpxResult = async () => {
    if (!result || !selectedTask) return;

    setDownloadError(null);
    const markdown = buildMarkdownResult({
      result,
      task: selectedTask,
      sourceFileName: uploadedFile?.name ?? 'uploaded-document',
      instructions,
    });

    try {
      const exported = result.workflowId
        ? await exportWorkflowHwpx(result.workflowId)
        : result.hwpxCompose ?? await exportMarkdownToHwpx(markdown, result.title);
      downloadExportResponse(exported);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? `${err.message} 백엔드 HWPX 생성 서버를 확인해 주세요. 손상된 HWPX를 대신 내려받지 않도록 차단했습니다.`
          : 'HWPX 생성에 실패했습니다. 손상된 HWPX를 대신 내려받지 않도록 차단했습니다.',
      );
    }
  };

  const downloadPdfResult = async () => {
    if (!result || !selectedTask) return;

    setDownloadError(null);
    const markdown = buildMarkdownResult({
      result,
      task: selectedTask,
      sourceFileName: uploadedFile?.name ?? 'uploaded-document',
      instructions,
    });

    try {
      let exported;
      if (result.workflowId) {
        exported = await exportWorkflowPdf(result.workflowId);
      } else if (result.hwpxCompose?.download_id) {
        exported = await exportPersistedHwpxToPdf(result.hwpxCompose.download_id, result.hwpxCompose.filename);
      } else if (result.hwpxCompose) {
        exported = await exportHwpxToPdf(result.hwpxCompose.content, result.hwpxCompose.filename, result.title);
      } else {
        const hwpx = await exportMarkdownToHwpx(markdown, result.title);
        exported = await exportHwpxToPdf(hwpx.content, hwpx.filename, result.title);
      }
      downloadExportResponse(exported);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? `${err.message} PDF export is available only when the server can run HWPX to PDF conversion.`
          : 'PDF export failed. The server did not return a downloadable PDF.',
      );
    }
  };

  const downloadMarkdown = () => {
    if (!result) return;
    downloadMarkdownResult({
      result,
      task: selectedTask,
      sourceFileName: uploadedFile?.name ?? 'uploaded-document',
      instructions,
    });
  };

  return {
    currentStep,
    uploadedFile,
    selectedTaskId,
    selectedTask,
    instructions,
    progress,
    processingIndex,
    processingSteps,
    isProcessing,
    result,
    error,
    downloadError,
    outputFormat,
    selectedTemplate,
    savedDocumentId,
    fileExtension: uploadedFile ? getFileExtension(uploadedFile.name).toUpperCase() : '',
    setCurrentStep,
    setFile,
    removeFile,
    selectTask,
    setInstructions,
    setOutputFormat,
    setSettings,
    goToReview,
    startGeneration,
    regenerate,
    resetWorkflow,
    downloadHwpxResult,
    downloadPdfResult,
    downloadMarkdown,
  };
}
