/**
 * localStorage 기반 분석 결과 캐시
 * - 서버 인메모리 캐시가 소멸되어도 결과 페이지를 직접 접근할 수 있음
 * - 최대 20개 항목 유지 (LRU 방식: 초과 시 가장 오래된 항목 제거)
 */

import type { AnalysisResult } from './types';

const STORAGE_KEY = 'livedock:results';
const MAX_ENTRIES = 20;

interface CacheEntry {
  result: AnalysisResult;
  savedAt: number; // Unix timestamp (ms)
}

type CacheStore = Record<string, CacheEntry>;

function readStore(): CacheStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CacheStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 스토리지 용량 초과 등 무시
  }
}

/** 결과를 localStorage에 저장합니다. */
export function saveResult(result: AnalysisResult): void {
  const store = readStore();

  store[result.id] = { result, savedAt: Date.now() };

  // MAX_ENTRIES 초과 시 가장 오래된 항목 제거
  const entries = Object.entries(store);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => a[1].savedAt - b[1].savedAt);
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    toRemove.forEach(([key]) => delete store[key]);
  }

  writeStore(store);
}

/** ID로 결과를 조회합니다. 없으면 null 반환. */
export function loadResult(id: string): AnalysisResult | null {
  const store = readStore();
  return store[id]?.result ?? null;
}
