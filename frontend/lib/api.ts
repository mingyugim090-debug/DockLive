import type { ApiResponse, CompanyProfile, ExportResponse, WorkflowResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function readError(res: Response, fallback: string): Promise<Error> {
  const err = await res.json().catch(() => ({ detail: fallback }));
  return new Error(err.detail ?? fallback);
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

  const res = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw await readError(res, `분석 실패: ${res.status}`);
  }

  return res.json();
}

export async function analyzeUrl(url: string, company?: CompanyProfile): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/analyze/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, company_profile: company }),
  });

  if (!res.ok) {
    throw await readError(res, `URL 분석 실패: ${res.status}`);
  }

  return res.json();
}

export async function analyzeText(text: string, title: string, company?: CompanyProfile): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/analyze/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title, source_name: title || '직접 입력한 공고문', company_profile: company }),
  });

  if (!res.ok) {
    throw await readError(res, `텍스트 분석 실패: ${res.status}`);
  }

  return res.json();
}

export async function getResult(id: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/result/${id}`);

  if (!res.ok) {
    throw await readError(res, `결과 조회 실패: ${res.status}`);
  }

  return res.json();
}

export async function getWorkflow(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}`);

  if (!res.ok) {
    throw await readError(res, `워크플로우 조회 실패: ${res.status}`);
  }

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

  if (!res.ok) {
    throw await readError(res, `입력 저장 실패: ${res.status}`);
  }

  return res.json();
}

export async function generateDraft(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/draft`, { method: 'POST' });

  if (!res.ok) {
    throw await readError(res, `초안 생성 실패: ${res.status}`);
  }

  return res.json();
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

  if (!res.ok) {
    throw await readError(res, `피드백 저장 실패: ${res.status}`);
  }

  return res.json();
}

export async function reviseDraft(id: string, sectionId: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/draft/${sectionId}/revise`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw await readError(res, `초안 재작성 실패: ${res.status}`);
  }

  return res.json();
}

export async function confirmWorkflow(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/confirm`, { method: 'POST' });

  if (!res.ok) {
    throw await readError(res, `초안 확인 실패: ${res.status}`);
  }

  return res.json();
}

export async function finalizeWorkflow(id: string): Promise<WorkflowResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/finalize`, { method: 'POST' });

  if (!res.ok) {
    throw await readError(res, `최종 문서 생성 실패: ${res.status}`);
  }

  return res.json();
}

export async function exportWorkflowHtml(id: string): Promise<ExportResponse> {
  const res = await fetch(`${API_URL}/api/workflow/${id}/export/html`);

  if (!res.ok) {
    throw await readError(res, `내보내기 실패: ${res.status}`);
  }

  return res.json();
}

export async function getDemo(): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/demo`);

  if (!res.ok) {
    throw await readError(res, `Demo 실패: ${res.status}`);
  }

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
