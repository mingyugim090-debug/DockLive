'use client';

const options = ['문서 요약', '회의록 변환', '보고서 초안 작성', '문서 서식 정리', '핵심 키워드 추출', '템플릿 기반 변환'];

export function JobOptionSelector({ selected, onChange }: { selected: string[]; onChange: (selected: string[]) => void }) {
  const toggle = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={[
              'rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5',
              active ? 'border-[#B8C0FF] bg-[#EEF2FF] text-[#273044]' : 'border-[#ECECF1] bg-white text-[#6B7280]',
            ].join(' ')}
          >
            <span className="text-sm font-bold">{option}</span>
            <span className="mt-2 block text-xs leading-5 text-[#7B8190]">선택한 작업은 AI Agent 실행 시 순서대로 처리됩니다.</span>
          </button>
        );
      })}
    </div>
  );
}
