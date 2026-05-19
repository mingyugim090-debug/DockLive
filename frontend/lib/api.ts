import type {
  ApiResponse,
  CompanyProfile,
  DraftStreamEvent,
  ExportListResponse,
  ExportResponse,
  HwpxComposeResponse,
  HwpxConvertResponse,
  NoticeDocument,
  NoticeGenerateResponse,
  HwpxPlaceholderMapResponse,
  HwpxStatusResponse,
  WorkflowResponse,
} from './types';

function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  if (
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    configured.includes('docklive.onrender.com')
  ) {
    return 'http://127.0.0.1:8000';
  }
  return configured;
}

const API_URL = resolveApiUrl();

export function getApiUrl(): string {
  return API_URL;
}

type ApiErrorPayload =
  | string
  | {
      detail?: unknown;
      error?: unknown;
      message?: unknown;
    }
  | unknown[];

function stringifyErrorDetail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const messages = value
      .map((item) => stringifyErrorDetail(item))
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join('\n') : null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct = stringifyErrorDetail(record.message ?? record.msg ?? record.detail ?? record.error);
    if (direct) {
      const loc = Array.isArray(record.loc) ? record.loc.join('.') : null;
      return loc ? `${loc}: ${direct}` : direct;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

async function readError(res: Response, fallback: string): Promise<Error> {
  const contentType = res.headers.get('content-type') ?? '';
  const payload: ApiErrorPayload | null = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);
  const message = stringifyErrorDetail(payload) ?? fallback;
  return new Error(message);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 45000): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI 초안 생성 응답이 지연되고 있습니다. 현재 초안을 기준으로 자동 보강을 계속합니다.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function getHwpxStatus(): Promise<HwpxStatusResponse> {
  const res = await fetch(`${API_URL}/api/hwpx/status`);
  if (!res.ok) throw await readError(res, `HWPX 상태 조회 실패: ${res.status}`);
  return res.json();
}

export async function analyzeDocument(file: File, company?: CompanyProfile): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (company) {
    formData.append('company_name', company.name);
    formData.append('company_industry', company.industry);
    formData.append('company_stage', company.stage);
    formData.append('company_region', company.region);
    formData.append('company_strengths', company.strengths);
    formData.append('company_needs', company.needs);
  }

  const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: formData });
  if (!res.ok) throw await readError(res, `분석 실패: ${res.status}`);
  return res.json();
}

export async function analyzeUrl(url: string, company?: CompanyProfile): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/analyze/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, company_profile: company }),
  });
  if (!res.ok) throw await readError(res, `URL 분석 실패: ${res.status}`);
  return res.json();
}

export async function analyzeText(text: string, title: string, company?: CompanyProfile): Promise<ApiResponse> {
  const sourceName = title || '직접 입력한 공고문';
  const res = await fetch(`${API_URL}/api/analyze/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title, source_name: sourceName, company_profile: company }),
  });
  if (!res.ok) throw await readError(res, `텍스트 분석 실패: ${res.status}`);
  return res.json();
}

export async function getResult(id: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/result/${id}`);
  if (!res.ok) throw await readError(res, `결과 조회 실패: ${res.status}`);
  return res.json();
}

export async function getWorkflow(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}`);
  if (!res.ok) throw await readError(res, `워크플로 조회 실패: ${res.status}`);
  return res.json();
}

export async function saveWorkflowInputs(
  id: string,
  inputs: Array<{ field_id: string; value: string }>,
): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) throw await readError(res, `입력 저장 실패: ${res.status}`);
  return res.json();
}

export async function generateDraft(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/draft`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `초안 생성 실패: ${res.status}`);
  return res.json();
}

export function createDraftStream(id: string, onEvent: (event: DraftStreamEvent) => void): EventSource {
  const source = new EventSource(`${API_URL}/api/workflow/${id}/draft/stream`);
  source.onmessage = (message) => {
    onEvent(JSON.parse(message.data) as DraftStreamEvent);
  };
  return source;
}

export async function saveDraftFeedback(
  id: string,
  sectionId: string,
  feedback: string,
): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/draft/${sectionId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw await readError(res, `피드백 저장 실패: ${res.status}`);
  return res.json();
}

export async function reviseDraft(id: string, sectionId: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/draft/${sectionId}/revise`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `초안 수정 실패: ${res.status}`);
  return res.json();
}

export async function confirmWorkflow(id: string, confirmedItems: string[] = []): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed_items: confirmedItems }),
  });
  if (!res.ok) throw await readError(res, `초안 확인 실패: ${res.status}`);
  return res.json();
}

export async function finalizeWorkflow(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/finalize`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `최종 문서 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportWorkflowHtml(id: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/export/html`);
  if (!res.ok) throw await readError(res, `HTML export 실패: ${res.status}`);
  return res.json();
}

export async function exportWorkflowHwpx(id: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/export/hwpx`);
  if (!res.ok) throw await readError(res, `HWPX export 실패: ${res.status}`);
  return res.json();
}

export async function exportWorkflowPdf(id: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/export/pdf`);
  if (!res.ok) throw await readError(res, `PDF export failed: ${res.status}`);
  return res.json();
}

export async function createWorkflowHwpxPlaceholderMap(
  id: string,
  templateId = 'basic_application_v1',
): Promise<HwpxPlaceholderMapResponse> {
  const params = new URLSearchParams({ template_id: templateId });
  const res = await fetch(`${API_URL}/api/workflow/${id}/export/hwpx/placeholder-map?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) throw await readError(res, `HWPX placeholder map 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportWorkflowHwpxTemplate(
  id: string,
  template: File,
  replacementsJson = '{}',
  keywordsJson = '{}',
): Promise<ExportResponse> {
  const formData = new FormData();
  formData.append('template', template);
  formData.append('replacements_json', replacementsJson || '{}');
  formData.append('keywords_json', keywordsJson || '{}');

  const res = await fetch(`${API_URL}/api/workflow/${id}/export/hwpx/template`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw await readError(res, `HWPX 템플릿 export 실패: ${res.status}`);
  return res.json();
}

export async function listWorkflowExports(id: string): Promise<ExportListResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/exports`);
  if (!res.ok) throw await readError(res, `Export 목록 조회 실패: ${res.status}`);
  return res.json();
}

export async function downloadWorkflowExport(workflowId: string, exportId: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${workflowId}/exports/${exportId}`);
  if (!res.ok) throw await readError(res, `저장된 export 다운로드 실패: ${res.status}`);
  return res.json();
}

export async function composeHwpxDocument(
  template: File,
  requestText: string,
  applicantContext = '',
  title = '',
): Promise<HwpxComposeResponse> {
  const formData = new FormData();
  formData.append('template', template);
  formData.append('request_text', requestText);
  formData.append('applicant_context', applicantContext);
  formData.append('title', title);

  const res = await fetch(`${API_URL}/api/hwpx/compose`, { method: 'POST', body: formData });
  if (!res.ok) throw await readError(res, `HWPX 자동 작성 실패: ${res.status}`);
  return res.json();
}

export async function convertHwpToHwpx(file: File): Promise<HwpxConvertResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/hwpx/convert-hwp`, { method: 'POST', body: formData });
  if (!res.ok) throw await readError(res, `HWP 변환 실패: ${res.status}`);
  return res.json();
}

export async function exportMarkdownToHwpx(markdown: string, title: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/hwpx/from-markdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, title }),
  });
  if (!res.ok) throw await readError(res, `Markdown HWPX export 실패: ${res.status}`);
  return res.json();
}

export async function exportHwpxToPdf(content: string, filename: string, title: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/hwpx/to-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename, title }),
  });
  if (!res.ok) throw await readError(res, `HWPX PDF export failed: ${res.status}`);
  return res.json();
}

export async function exportPersistedHwpxToPdf(downloadId: string, filename: string): Promise<ExportResponse> {
  const params = new URLSearchParams({ filename });
  const res = await fetch(`${API_URL}/api/hwpx/download/${downloadId}/pdf?${params.toString()}`);
  if (!res.ok) throw await readError(res, `HWPX PDF export failed: ${res.status}`);
  return res.json();
}

export async function generateNoticeDocument(
  templateId: string,
  inputs: Record<string, string>,
  files: File[] = [],
): Promise<NoticeGenerateResponse> {
  const formData = new FormData();
  formData.append('payload_json', JSON.stringify({ template_id: templateId, inputs }));
  files.forEach((file) => formData.append('files', file));

  const res = await fetchWithTimeout(`${API_URL}/api/notices/generate`, { method: 'POST', body: formData }, 45000);
  if (!res.ok) throw await readError(res, `공고문 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportNoticeHwpx(document: NoticeDocument): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/notices/export/hwpx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document }),
  });
  if (!res.ok) throw await readError(res, `HWPX 다운로드 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportNoticePdf(document: NoticeDocument): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/notices/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document }),
  });
  if (!res.ok) throw await readError(res, `PDF 다운로드 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportNoticeDocx(document: NoticeDocument): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/notices/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document }),
  });
  if (!res.ok) throw await readError(res, `DOCX 다운로드 생성 실패: ${res.status}`);
  return res.json();
}

export async function getDemo(): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/demo`);
  if (!res.ok) throw await readError(res, `Demo 실패: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
