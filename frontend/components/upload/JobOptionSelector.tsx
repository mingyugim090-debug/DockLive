'use client';

const options = [
  {
    label: '공고문 요구사항 분석',
    description: '마감일, 자격, 제출 서류, 평가 기준과 출처 근거를 먼저 정리합니다.',
  },
  {
    label: '필수 입력 질문 만들기',
    description: '사용자가 직접 제공해야 할 팀 정보, 사업 계획, 증빙 자료를 질문으로 바꿉니다.',
  },
  {
    label: '신청서 초안 작성',
    description: '공고 조건과 사용자 입력을 기준으로 섹션별 제출 초안을 생성합니다.',
  },
  {
    label: '확인 필요 주장 표시',
    description: '마감일, 금액, 자격, 성과처럼 확인이 필요한 문장을 별도로 표시합니다.',
  },
  {
    label: 'HWPX 내보내기 준비',
    description: '최종 문서를 한글 편집용 HWPX로 만들 수 있도록 구조를 정리합니다.',
  },
  {
    label: '체크리스트 생성',
    description: '필수 서류와 선택 서류를 구분하고 제출 전 확인 항목으로 만듭니다.',
  },
];

export function JobOptionSelector({ selected, onChange }: { selected: string[]; onChange: (selected: string[]) => void }) {
  const toggle = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => {
        const active = selected.includes(option.label);
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => toggle(option.label)}
            className={[
              'rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5',
              active ? 'border-[#B8C0FF] bg-[#EEF2FF] text-[#273044]' : 'border-[#ECECF1] bg-white text-[#6B7280]',
            ].join(' ')}
          >
            <span className="text-sm font-bold">{option.label}</span>
            <span className="mt-2 block text-xs leading-5 text-[#7B8190]">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
