import { Progress } from '@/components/ui/Progress';

export function ProcessingStatus({
  progress,
  steps,
  currentIndex,
}: {
  progress: number;
  steps: string[];
  currentIndex: number;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#5263E8]">Step 5</p>
          <h2 className="mt-1 text-2xl font-bold text-[#273044]">문서 생성 진행 중</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">선택한 파일과 작업 유형을 기준으로 결과 문서를 구성하고 있습니다.</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF]">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#D8DDFC] border-t-[#5263E8]" />
        </div>
      </div>

      <div className="mt-7">
        <Progress value={progress} label={steps[currentIndex] ?? steps[0]} sublabel={`${progress}%`} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step}
            className={[
              'rounded-[18px] border p-4 text-sm font-semibold',
              index <= currentIndex ? 'border-[#D8DDFC] bg-[#EEF2FF] text-[#5263E8]' : 'border-[#ECECF1] bg-[#FBFBFD] text-[#8A91A0]',
            ].join(' ')}
          >
            <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs">{index + 1}</span>
            {step}
          </div>
        ))}
      </div>
    </section>
  );
}
