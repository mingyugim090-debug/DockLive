import type {
  AgencyNoticeBrief,
  AgencyNoticeDraftResponse,
  AgencyNoticeListResponse,
  AgencyPriorNoticeRecallResponse,
  AgencyPriorNoticeResponse,
  ApiResponse,
  ClauseLibraryEntryResponse,
  ClauseLibraryListResponse,
  CompanyProfile,
  DraftStreamEvent,
  ExportListResponse,
  ExportResponse,
  DocumentStyleProfile,
  HwpxComposeResponse,
  HwpxConvertResponse,
  HwpxFormSessionResponse,
  HwpxRegionDraftPreviewResponse,
  NoticeDocument,
  NoticeGenerateResponse,
  HwpxPlaceholderMapResponse,
  HwpxStatusResponse,
  HwpxTemplateAnalysisResponse,
  IrisNoticeDetailResponse,
  IrisNoticeListResponse,
  WorkflowSession,
  WorkflowResponse,
  ScoreResponse,
  DocumentWorkspaceResponse,
  GeneratedDocumentResponse,
  InlineTransformCommand,
  VisualBlockResponse,
  WorkbookPlanResponse,
  WorkspaceArtifactResponse,
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

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 45000,
  timeoutMessage = 'AI 초안 생성 응답이 지연되고 있습니다. 현재 초안을 기준으로 자동 보강을 계속합니다.',
): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
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

export type IntegrityCheck = {
  code: string;
  label: string;
  passed: boolean;
  detail?: string | null;
  /** 실패 시 점프할 5단계 섹션 id */
  section_id?: string | null;
};

export type IntegrityReport = {
  passed: boolean;
  checks: IntegrityCheck[];
  checked_at?: string | null;
};

/** 무결성 검사 (DockLive 본체 Phase 9 계약: GET /api/projects/:id/integrity).
 * 백엔드 미구현(404 등)이면 null을 반환 — 호출부는 "검사 준비 중"으로 표시한다. */
export async function getProjectIntegrity(id: string): Promise<IntegrityReport | null> {
  try {
    const res = await fetch(`${API_URL}/api/projects/${id}/integrity`);
    if (!res.ok) return null;
    const body = await res.json();
    const data = body?.data ?? body;
    if (!data || !Array.isArray(data.checks)) return null;
    return data as IntegrityReport;
  } catch {
    return null;
  }
}

export async function restoreWorkflow(id: string, workflow: WorkflowSession): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) throw await readError(res, `워크플로 복구 실패: ${res.status}`);
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

export async function scoreWorkflow(id: string): Promise<ScoreResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/score`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `평가기준 채점 실패: ${res.status}`);
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

export async function analyzeHwpxTemplate(file: File): Promise<HwpxTemplateAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/hwpx/analyze-template`, { method: 'POST', body: formData });
  if (!res.ok) throw await readError(res, `HWPX 양식 분석 실패: ${res.status}`);
  return res.json();
}

export async function createHwpxFormSession(file: File): Promise<HwpxFormSessionResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithTimeout(`${API_URL}/api/hwpx/sessions`, { method: 'POST', body: formData }, 90000);
  if (!res.ok) throw await readError(res, `HWPX 세션 생성 실패: ${res.status}`);
  return res.json();
}

export async function getHwpxFormSession(id: string): Promise<HwpxFormSessionResponse> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/hwpx/sessions/${id}`,
    {},
    10000,
    '이전 HWPX 세션 응답이 지연되어 새 업로드로 시작합니다.',
  );
  if (!res.ok) throw await readError(res, `HWPX 세션 조회 실패: ${res.status}`);
  return res.json();
}

export async function updateHwpxRegion(
  sessionId: string,
  regionId: string,
  payload: { value: string; prompt?: string; draftStatus?: 'empty' | 'drafted' | 'revised' },
): Promise<HwpxFormSessionResponse> {
  const res = await fetch(`${API_URL}/api/hwpx/sessions/${sessionId}/regions/${regionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: payload.value, prompt: payload.prompt ?? '', draft_status: payload.draftStatus }),
  });
  if (!res.ok) throw await readError(res, `HWPX 입력 영역 저장 실패: ${res.status}`);
  return res.json();
}

export async function previewHwpxRegionDraft(
  sessionId: string,
  regionId: string,
  payload: { baseInput: string; prompt: string },
): Promise<HwpxRegionDraftPreviewResponse> {
  const res = await fetchWithTimeout(`${API_URL}/api/hwpx/sessions/${sessionId}/regions/${regionId}/draft-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_input: payload.baseInput, prompt: payload.prompt }),
  }, 90000);
  if (!res.ok) throw await readError(res, `AI 제안 생성 실패: ${res.status}`);
  return res.json();
}

export async function draftHwpxRegion(
  sessionId: string,
  regionId: string,
  payload: { baseInput: string; prompt: string },
): Promise<HwpxFormSessionResponse> {
  const res = await fetchWithTimeout(`${API_URL}/api/hwpx/sessions/${sessionId}/regions/${regionId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_input: payload.baseInput, prompt: payload.prompt }),
  }, 90000);
  if (!res.ok) throw await readError(res, `AI 초안 생성 실패: ${res.status}`);
  return res.json();
}

export async function draftAllHwpxRegions(
  sessionId: string,
  payload: { baseInput: string; globalPrompt: string; overwriteExisting?: boolean },
): Promise<HwpxFormSessionResponse> {
  const res = await fetchWithTimeout(`${API_URL}/api/hwpx/sessions/${sessionId}/draft-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_input: payload.baseInput,
      global_prompt: payload.globalPrompt,
      overwrite_existing: payload.overwriteExisting ?? false,
    }),
  }, 120000);
  if (!res.ok) throw await readError(res, `전체 HWPX 자동완성 실패: ${res.status}`);
  return res.json();
}

export async function addHwpxComponent(
  sessionId: string,
  payload: { kind: 'text' | 'textarea' | 'signature' | 'table'; label: string; value?: string },
): Promise<HwpxFormSessionResponse> {
  const res = await fetch(`${API_URL}/api/hwpx/sessions/${sessionId}/components`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: payload.kind, label: payload.label, value: payload.value ?? '' }),
  });
  if (!res.ok) throw await readError(res, `HWPX 구성요소 추가 실패: ${res.status}`);
  return res.json();
}

export async function exportHwpxFormSession(sessionId: string): Promise<ExportResponse> {
  const res = await fetchWithTimeout(`${API_URL}/api/hwpx/sessions/${sessionId}/export`, { method: 'POST' }, 90000);
  if (!res.ok) throw await readError(res, `HWPX 다운로드 생성 실패: ${res.status}`);
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
  if (!res.ok) throw await readError(res, `초안 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportNoticeHwpx(document: NoticeDocument, styleProfile?: DocumentStyleProfile): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/notices/export/hwpx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, style_profile: styleProfile }),
  });
  if (!res.ok) throw await readError(res, `HWPX 다운로드 생성 실패: ${res.status}`);
  return res.json();
}

export async function exportNoticePdf(document: NoticeDocument, styleProfile?: DocumentStyleProfile): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/notices/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, style_profile: styleProfile }),
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

export async function listAgencyNoticeDrafts(
  organizationId = '00000000-0000-4000-8000-000000000001',
): Promise<AgencyNoticeListResponse> {
  const params = new URLSearchParams({ organization_id: organizationId });
  const res = await fetch(`${API_URL}/api/agency/notices/drafts?${params.toString()}`);
  if (!res.ok) throw await readError(res, `기관 공고 목록 조회 실패: ${res.status}`);
  return res.json();
}

export async function createAgencyNoticeDraft(brief: AgencyNoticeBrief): Promise<AgencyNoticeDraftResponse> {
  const res = await fetch(`${API_URL}/api/agency/notices/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief }),
  });
  if (!res.ok) throw await readError(res, `기관 공고 초안 생성 실패: ${res.status}`);
  return res.json();
}

export async function createAgencyPriorNotice(payload: {
  organization_id: string;
  title: string;
  program_type?: string;
  budget?: string;
  program_period?: string;
  text: string;
  source_filename?: string;
}): Promise<AgencyPriorNoticeResponse> {
  const res = await fetch(`${API_URL}/api/agency/prior-notices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await readError(res, `과거 공고 저장 실패: ${res.status}`);
  return res.json();
}

export async function recallAgencyPriorNotices(brief: AgencyNoticeBrief): Promise<AgencyPriorNoticeRecallResponse> {
  const res = await fetch(`${API_URL}/api/agency/prior-notices/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organization_id: brief.organization_id, brief, limit: 5 }),
  });
  if (!res.ok) throw await readError(res, `유사 과거 공고 검색 실패: ${res.status}`);
  return res.json();
}

export async function aiReviseAgencyNoticeSection(
  draftId: string,
  sectionId: string,
  instruction = '',
): Promise<AgencyNoticeDraftResponse> {
  const res = await fetch(
    `${API_URL}/api/agency/notices/drafts/${encodeURIComponent(draftId)}/sections/${encodeURIComponent(sectionId)}/ai-revise`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction }),
    },
  );
  if (!res.ok) throw await readError(res, `AI 다듬기 실패: ${res.status}`);
  return res.json();
}

export async function listIrisNotices(page = 1, keyword = '', progress = 'ancmIng'): Promise<IrisNoticeListResponse> {
  const params = new URLSearchParams({ page: String(page), keyword, progress });
  const res = await fetch(`${API_URL}/api/agency/iris/notices?${params.toString()}`);
  if (!res.ok) throw await readError(res, `IRIS 공고 목록 조회 실패: ${res.status}`);
  return res.json();
}

export async function getIrisNoticeDetail(ancmId: string, progress = 'ancmIng'): Promise<IrisNoticeDetailResponse> {
  const params = new URLSearchParams({ progress });
  const res = await fetch(`${API_URL}/api/agency/iris/notices/${encodeURIComponent(ancmId)}?${params.toString()}`);
  if (!res.ok) throw await readError(res, `IRIS 공고 상세 조회 실패: ${res.status}`);
  return res.json();
}

export async function saveIrisNoticeAsReference(
  ancmId: string,
  organizationId = '00000000-0000-4000-8000-000000000001',
  progress = 'ancmIng',
): Promise<AgencyPriorNoticeResponse> {
  const res = await fetch(`${API_URL}/api/agency/iris/notices/${encodeURIComponent(ancmId)}/save-reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organization_id: organizationId, progress }),
  });
  if (!res.ok) throw await readError(res, `참고자료 저장 실패: ${res.status}`);
  return res.json();
}

export async function listClauseLibrary(
  organizationId = '00000000-0000-4000-8000-000000000001',
  programType?: string,
): Promise<ClauseLibraryListResponse> {
  const params = new URLSearchParams({ organization_id: organizationId });
  if (programType) params.set('program_type', programType);
  const res = await fetch(`${API_URL}/api/agency/clause-library?${params.toString()}`);
  if (!res.ok) throw await readError(res, `조항 라이브러리 조회 실패: ${res.status}`);
  return res.json();
}

export async function createClauseLibraryEntry(payload: {
  organization_id: string;
  clause_type: string;
  label: string;
  required_for_program_types: string[];
  template_text: string;
  source?: 'org_default' | 'agency_supplied';
  active?: boolean;
}): Promise<ClauseLibraryEntryResponse> {
  const res = await fetch(`${API_URL}/api/agency/clause-library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'agency_supplied',
      active: true,
      ...payload,
    }),
  });
  if (!res.ok) throw await readError(res, `조항 라이브러리 저장 실패: ${res.status}`);
  return res.json();
}

export async function updateAgencyNoticeSection(
  draftId: string,
  sectionId: string,
  contentMarkdown: string,
): Promise<AgencyNoticeDraftResponse> {
  const res = await fetch(`${API_URL}/api/agency/notices/drafts/${draftId}/sections/${sectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content_markdown: contentMarkdown,
      change_summary: `${sectionId} 섹션을 수정했습니다.`,
    }),
  });
  if (!res.ok) throw await readError(res, `기관 공고 섹션 저장 실패: ${res.status}`);
  return res.json();
}

export async function addAgencyNoticeComment(
  draftId: string,
  body: string,
  sectionId?: string | null,
): Promise<AgencyNoticeDraftResponse> {
  const res = await fetch(`${API_URL}/api/agency/notices/drafts/${draftId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, section_id: sectionId ?? null }),
  });
  if (!res.ok) throw await readError(res, `기관 공고 댓글 저장 실패: ${res.status}`);
  return res.json();
}

export async function transitionAgencyNoticeDraft(
  draftId: string,
  action: 'submit-review' | 'request-revision' | 'approve' | 'publish',
  note = '',
): Promise<AgencyNoticeDraftResponse> {
  const res = await fetch(`${API_URL}/api/agency/notices/drafts/${draftId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw await readError(res, `기관 공고 상태 전환 실패: ${res.status}`);
  return res.json();
}

export async function exportAgencyNoticeDraft(
  draftId: string,
  format: 'hwpx' | 'pdf' | 'docx',
): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/agency/notices/drafts/${draftId}/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await readError(res, `기관 공고 ${format.toUpperCase()} export 실패: ${res.status}`);
  return res.json();
}

export async function getDemo(docType?: string): Promise<ApiResponse> {
  const url = docType ? `${API_URL}/api/demo?type=${encodeURIComponent(docType)}` : `${API_URL}/api/demo`;
  const res = await fetch(url);
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

// --- Document workspace (Inline-AI style multi-file project) ---

export async function createWorkspace(title = ''): Promise<DocumentWorkspaceResponse> {
  const res = await fetch(`${API_URL}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw await readError(res, `워크스페이스 생성 실패: ${res.status}`);
  return res.json();
}

export async function createDemoWorkspace(): Promise<DocumentWorkspaceResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/demo`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `데모 워크스페이스 생성 실패: ${res.status}`);
  return res.json();
}

export async function getWorkspace(workspaceId: string): Promise<DocumentWorkspaceResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}`);
  if (!res.ok) throw await readError(res, `워크스페이스 조회 실패: ${res.status}`);
  return res.json();
}

export async function uploadWorkspaceFile(
  workspaceId: string,
  file: File,
  fileKind = '',
): Promise<DocumentWorkspaceResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (fileKind) formData.append('file_kind', fileKind);
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/files`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw await readError(res, `파일 업로드 실패: ${res.status}`);
  return res.json();
}

export async function analyzeWorkspace(
  workspaceId: string,
  fileId = '',
): Promise<DocumentWorkspaceResponse> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/workspaces/${workspaceId}/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    },
    90000,
    '공고 분석 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  );
  if (!res.ok) throw await readError(res, `공고 분석 실패: ${res.status}`);
  return res.json();
}

export async function buildWorkspaceBlueprint(workspaceId: string): Promise<DocumentWorkspaceResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/blueprint`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `문서 구조 설계 실패: ${res.status}`);
  return res.json();
}

export async function generateWorkspaceDocument(
  workspaceId: string,
): Promise<GeneratedDocumentResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/generate`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `문서 생성 실패: ${res.status}`);
  return res.json();
}

export async function transformWorkspaceBlock(
  workspaceId: string,
  blockId: string,
  command: InlineTransformCommand,
  instruction = '',
): Promise<VisualBlockResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/blocks/${blockId}/transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, instruction }),
  });
  if (!res.ok) throw await readError(res, `블록 변환 실패: ${res.status}`);
  return res.json();
}

export async function planWorkspaceExcelArtifact(workspaceId: string): Promise<WorkbookPlanResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/artifacts/excel/plan`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `Excel 계획 생성 실패: ${res.status}`);
  return res.json();
}

export async function generateWorkspaceExcelArtifact(workspaceId: string): Promise<WorkspaceArtifactResponse> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/workspaces/${workspaceId}/artifacts/excel/generate`,
    { method: 'POST' },
    120000,
    'Excel 파일 생성 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  );
  if (!res.ok) throw await readError(res, `Excel 파일 생성 실패: ${res.status}`);
  return res.json();
}

export async function openWorkspaceArtifact(
  workspaceId: string,
  artifactId: string,
): Promise<WorkspaceArtifactResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/artifacts/${artifactId}/open`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `산출물 열기 실패: ${res.status}`);
  return res.json();
}

export async function syncWorkspaceArtifact(
  workspaceId: string,
  artifactId: string,
): Promise<WorkspaceArtifactResponse> {
  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/artifacts/${artifactId}/sync`, { method: 'POST' });
  if (!res.ok) throw await readError(res, `산출물 동기화 실패: ${res.status}`);
  return res.json();
}

export type WorkspaceExportFormat = 'markdown' | 'html' | 'docx' | 'hwpx' | 'pdf';

export async function exportWorkspace(
  workspaceId: string,
  format: WorkspaceExportFormat,
): Promise<ExportResponse> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/workspaces/${workspaceId}/export/${format}`,
    {},
    120000,
    '내보내기 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  );
  if (!res.ok) throw await readError(res, `내보내기 실패: ${res.status}`);
  return res.json();
}
