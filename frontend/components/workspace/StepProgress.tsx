import type { WorkflowStep } from '@/hooks/useDocumentWorkflow';

const steps: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'upload', label: '업로드' },
  { id: 'task', label: '작업 선택' },
  { id: 'instructions', label: '지시사항' },
  { id: 'review', label: '확인' },
  { id: 'processing', label: '생성' },
  { id: 'result', label: '결과' },
];

export function StepProgress({ currentStep }: { currentStep: WorkflowStep }) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="rounded-[28px] border border-[var(--theme-border)] bg-white p-4 shadow-panel">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step, index) => {
          const active = index === currentIndex;
          const complete = index < currentIndex;
          return (
            <div
              key={step.id}
              className={[
                'flex items-center gap-3 rounded-[18px] border px-3 py-3 text-sm font-semibold transition',
                active || complete ? 'border-[#D8DDFC] bg-[#EEF2FF] text-[#5263E8]' : 'border-[#ECECF1] bg-[#FBFBFD] text-[#8A91A0]',
              ].join(' ')}
            >
              <span className={['flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs', complete ? 'gradient-primary text-white' : 'bg-white'].join(' ')}>
                {complete ? '✓' : index + 1}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
