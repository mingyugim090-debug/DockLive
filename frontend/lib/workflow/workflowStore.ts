import { mockDocuments } from '@/data/mockDocuments';
import { mockJobs } from '@/data/mockJobs';
import type { JobStatus, JobType, MockDocument, MockJob } from '@/data/types';
import type { GeneratedDocument, OutputFormat, ProcessingMode, WorkflowTaskId } from '@/data/workspaceTasks';
import { formatFileSize, getFileExtension, getTaskById, taskToJobType } from '@/data/workspaceTasks';

export interface StoredWorkflowDocument extends MockDocument {
  resultId: string;
  taskId: WorkflowTaskId;
  outputFormat: OutputFormat;
  instructions: string;
  resultMarkdown: string;
  resultTitle: string;
  templateName?: string | null;
  errorMessage?: string | null;
}

export interface StoredWorkflowJob extends MockJob {
  resultId: string;
  taskId: WorkflowTaskId;
}

export interface WorkflowSettings {
  outputFormat: OutputFormat;
  processingMode: ProcessingMode;
  themeMode: string;
}

export interface CompleteWorkflowPayload {
  file: File;
  taskId: WorkflowTaskId;
  instructions: string;
  result: GeneratedDocument;
  outputFormat: OutputFormat;
  templateName?: string | null;
  duration?: string;
}

export interface PendingTemplateSelection {
  templateId: string;
  templateName: string;
  taskId: WorkflowTaskId;
  outputFormat: OutputFormat;
  instructionHint: string;
}

const DOCUMENTS_KEY = 'docklive:mvp:documents';
const HISTORY_KEY = 'docklive:mvp:history';
const SETTINGS_KEY = 'docklive:mvp:settings';
const PENDING_TEMPLATE_KEY = 'docklive:mvp:pending-template';

export const defaultWorkflowSettings: WorkflowSettings = {
  outputFormat: 'HWPX',
  processingMode: '보고서형 정리',
  themeMode: '시스템 기본',
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function nowLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function dateLabel(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('.');
}

function fileTypeLabel(fileName: string): MockDocument['type'] {
  const ext = getFileExtension(fileName).replace('.', '').toUpperCase();
  if (ext === 'HWP') return 'HWPX';
  if (ext === 'MD') return 'TXT';
  if (['PDF', 'DOCX', 'HWPX', 'TXT'].includes(ext)) return ext as MockDocument['type'];
  return 'TXT';
}

export function loadWorkflowSettings(): WorkflowSettings {
  return { ...defaultWorkflowSettings, ...readJson<Partial<WorkflowSettings>>(SETTINGS_KEY, {}) };
}

export function saveWorkflowSettings(settings: WorkflowSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function savePendingTemplate(selection: PendingTemplateSelection): void {
  writeJson(PENDING_TEMPLATE_KEY, selection);
}

export function consumePendingTemplate(): PendingTemplateSelection | null {
  const value = readJson<PendingTemplateSelection | null>(PENDING_TEMPLATE_KEY, null);
  if (canUseStorage()) window.localStorage.removeItem(PENDING_TEMPLATE_KEY);
  return value;
}

export function loadStoredDocuments(): StoredWorkflowDocument[] {
  return readJson<StoredWorkflowDocument[]>(DOCUMENTS_KEY, []);
}

export function loadStoredHistory(): StoredWorkflowJob[] {
  return readJson<StoredWorkflowJob[]>(HISTORY_KEY, []);
}

export function loadAllDocuments(): Array<MockDocument | StoredWorkflowDocument> {
  return [...loadStoredDocuments(), ...mockDocuments];
}

export function loadAllHistory(): Array<MockJob | StoredWorkflowJob> {
  return [...loadStoredHistory(), ...mockJobs];
}

export function findStoredDocument(id: string): StoredWorkflowDocument | null {
  return loadStoredDocuments().find((document) => document.id === id || document.resultId === id) ?? null;
}

export function saveCompletedWorkflow(payload: CompleteWorkflowPayload): StoredWorkflowDocument {
  const resultId = `wf-${Date.now()}`;
  const task = getTaskById(payload.taskId);
  const jobType: JobType = taskToJobType(payload.taskId);

  const document: StoredWorkflowDocument = {
    id: resultId,
    resultId,
    name: payload.file.name,
    type: fileTypeLabel(payload.file.name),
    size: formatFileSize(payload.file.size),
    status: '분석 완료',
    createdAt: dateLabel(),
    updatedAt: '방금 전',
    lastJob: jobType,
    category: task.name,
    summary: `${task.name} 작업으로 생성된 결과입니다. ${payload.outputFormat} 출력 형식으로 다운로드할 수 있습니다.`,
    keywords: [task.name, payload.outputFormat, 'MVP 결과', payload.templateName ?? '워크스페이스'].filter(Boolean),
    structure: payload.result.previewBlocks.map((block) => ({ title: block.title, description: block.body })),
    generatedResult: payload.result.previewBlocks[0]?.body ?? payload.result.title,
    taskId: payload.taskId,
    outputFormat: payload.outputFormat,
    instructions: payload.instructions,
    resultMarkdown: payload.result.markdown,
    resultTitle: payload.result.title,
    templateName: payload.templateName ?? null,
  };

  const job: StoredWorkflowJob = {
    id: `job-${resultId}`,
    resultId,
    taskId: payload.taskId,
    name: `${task.name} 생성`,
    documentName: payload.file.name,
    type: jobType,
    status: '완료' as JobStatus,
    duration: payload.duration ?? '약 5초',
    createdAt: nowLabel(),
  };

  writeJson(DOCUMENTS_KEY, [document, ...loadStoredDocuments()].slice(0, 30));
  writeJson(HISTORY_KEY, [job, ...loadStoredHistory()].slice(0, 50));
  return document;
}
