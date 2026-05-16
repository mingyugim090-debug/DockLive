'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createMockGeneratedDocument,
  getFileExtension,
  getTaskById,
  isSupportedDocument,
  processingSteps,
  type GeneratedDocument,
  type WorkflowTaskId,
} from '@/data/workspaceTasks';
import { createMockHwpxBlob } from '@/lib/mockHwpx';

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
            setResult(createMockGeneratedDocument(selectedTaskId, uploadedFile, instructions));
            setIsProcessing(false);
            setCurrentStep('result');
          }, 350);
        }

        return next;
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, [instructions, isProcessing, selectedTaskId, uploadedFile]);

  const setFile = (file: File) => {
    if (!isSupportedDocument(file)) {
      setError('지원하지 않는 파일 형식입니다. PDF, DOCX, HWP, HWPX 파일을 업로드해 주세요.');
      return;
    }

    setUploadedFile(file);
    setResult(null);
    setError(null);
    setProgress(0);
    setProcessingIndex(0);
    setCurrentStep('task');
  };

  const removeFile = () => {
    setUploadedFile(null);
    setResult(null);
    setError(null);
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

  const downloadResult = () => {
    if (!result || !selectedTask) return;

    const date = new Date();
    const yyyymmdd = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');

    const blob = createMockHwpxBlob({
      result,
      task: selectedTask,
      sourceFileName: uploadedFile?.name ?? 'uploaded-document',
      instructions,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `docklive-result-${yyyymmdd}.hwpx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
    fileExtension: uploadedFile ? getFileExtension(uploadedFile.name).toUpperCase() : '',
    setCurrentStep,
    setFile,
    removeFile,
    selectTask,
    setInstructions,
    goToReview,
    startGeneration,
    regenerate,
    resetWorkflow,
    downloadResult,
  };
}
