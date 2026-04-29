import type { ApiResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function analyzeDocument(file: File): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '알 수 없는 오류' }));
    throw new Error(err.detail ?? `분석 실패: ${res.status}`);
  }

  return res.json();
}

export async function getResult(id: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/result/${id}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '결과를 찾을 수 없습니다.' }));
    throw new Error(err.detail ?? `조회 실패: ${res.status}`);
  }

  return res.json();
}

export async function getDemo(): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/api/demo`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Demo 데이터를 불러올 수 없습니다.' }));
    throw new Error(err.detail ?? `Demo 실패: ${res.status}`);
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

