'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createMockGeneratedDocument,
  getFileExtension,
  getTaskById,
  isSupportedDocument,
  processingSteps,
  type GeneratedDocument,
  type OutputFormat,
  type WorkflowTaskId,
} from '@/data/workspaceTasks';
import { exportMarkdownToHwpx } from '@/lib/api';
import { buildMarkdownResult, downloadMarkdownResult } from '@/lib/workflow/downloadMarkdown';
import {
  consumePendingTemplate,
  loadWorkflowSettings,
  saveCompletedWorkflow,
  type PendingTemplateSelection,
  type WorkflowSettings,
} from '@/lib/workflow/workflowStore';

export type WorkflowStep = 'upload' | 'task' | 'instructions' | 'review' | 'processing' | 'result';

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
          window.setTimeout(() => {
            const generated = createMockGeneratedDocument(selectedTaskId, uploadedFile, instructions, {
              processingMode: settings.processingMode,
              templateName: selectedTemplate?.templateName,
            });
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

    const date = new Date();
    const yyyymmdd = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');

    setDownloadError(null);
    setSavedDocumentId(null);
    const markdown = buildMarkdownResult({
      result,
      task: selectedTask,
      sourceFileName: uploadedFile?.name ?? 'uploaded-document',
      instructions,
    });

    try {
      const exported = await exportMarkdownToHwpx(markdown, result.title);
      const bytes = Uint8Array.from(atob(exported.content), (char) => char.charCodeAt(0));
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: exported.content_type || 'application/vnd.hancom.hwpx' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exported.filename || `docklive-result-${yyyymmdd}.hwpx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? `${err.message} 백엔드 HWPX 생성 서버를 확인해 주세요. 손상된 HWPX를 대신 내려받지 않도록 차단했습니다.`
          : 'HWPX 생성에 실패했습니다. 손상된 HWPX를 대신 내려받지 않도록 차단했습니다.',
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
    downloadMarkdown,
  };
}
