import { create } from 'zustand';
import type { AnalysisResult, WorkflowSession } from './types';

interface AppState {
  uploadedFile: File | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisResult: AnalysisResult | null;
  workflowSession: WorkflowSession | null;
  currentStep: 1 | 2 | 3 | 4 | 5;
  checkedItems: Set<string>;

  setFile: (file: File) => void;
  setAnalyzing: (loading: boolean) => void;
  setResult: (result: AnalysisResult) => void;
  setWorkflow: (workflow: WorkflowSession | null) => void;
  setError: (error: string | null) => void;
  setStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  toggleCheck: (itemId: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  uploadedFile: null,
  isAnalyzing: false,
  analysisError: null,
  analysisResult: null,
  workflowSession: null,
  currentStep: 1,
  checkedItems: new Set(),

  setFile: (file) => set({ uploadedFile: file }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
  setResult: (result) => set({ analysisResult: result }),
  setWorkflow: (workflow) => set({ workflowSession: workflow }),
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
      workflowSession: null,
      currentStep: 1,
      checkedItems: new Set(),
    }),
}));
