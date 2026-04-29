import { create } from 'zustand';
import type { AnalysisResult } from './types';

interface AppState {
  // 업로드 상태
  uploadedFile: File | null;
  isAnalyzing: boolean;
  analysisError: string | null;

  // 분석 결과
  analysisResult: AnalysisResult | null;

  // 결과 탭
  currentStep: 1 | 2 | 3;

  // 체크리스트 상태
  checkedItems: Set<string>;

  // 액션
  setFile: (file: File) => void;
  setAnalyzing: (loading: boolean) => void;
  setResult: (result: AnalysisResult) => void;
  setError: (error: string | null) => void;
  setStep: (step: 1 | 2 | 3) => void;
  toggleCheck: (itemId: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  uploadedFile: null,
  isAnalyzing: false,
  analysisError: null,
  analysisResult: null,
  currentStep: 1,
  checkedItems: new Set(),

  setFile: (file) => set({ uploadedFile: file }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
  setResult: (result) => set({ analysisResult: result }),
  setError: (error) => set({ analysisError: error }),
  setStep: (step) => set({ currentStep: step }),
  toggleCheck: (itemId) =>
    set((state) => {
      const newChecked = new Set(state.checkedItems);
      if (newChecked.has(itemId)) {
        newChecked.delete(itemId);
      } else {
        newChecked.add(itemId);
      }
      return { checkedItems: newChecked };
    }),
  reset: () =>
    set({
      uploadedFile: null,
      isAnalyzing: false,
      analysisError: null,
      analysisResult: null,
      currentStep: 1,
      checkedItems: new Set(),
    }),
}));
