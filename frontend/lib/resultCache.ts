import type { AnalysisResult } from './types';

const STORAGE_KEY = 'livedock:results';
const MAX_ENTRIES = 20;

interface CacheEntry {
  result: AnalysisResult;
  savedAt: number;
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
    // Ignore storage quota or privacy mode failures.
  }
}

export function saveResult(result: AnalysisResult): void {
  const store = readStore();
  store[result.id] = { result, savedAt: Date.now() };

  const entries = Object.entries(store);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => a[1].savedAt - b[1].savedAt);
    entries.slice(0, entries.length - MAX_ENTRIES).forEach(([key]) => delete store[key]);
  }

  writeStore(store);
}

export function loadResult(id: string): AnalysisResult | null {
  const store = readStore();
  return store[id]?.result ?? null;
}
