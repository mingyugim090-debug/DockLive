const STEPS = [
  {
    num: '01',
    emoji: '📤',
    title: 'Upload',
    subtitle: '문서 업로드',
    desc: 'HWPX, PDF, DOCX 파일을 드래그하거나 공고 URL, 텍스트로 내용을 입력합니다.',
  },
  {
    num: '02',
    emoji: '🔍',
    title: 'Understand',
    subtitle: '구조 분석',
    desc: 'AI Agent가 문서 구조와 요구사항을 파악하고 마감일, 자격 조건, 제출 서류를 정리합니다.',
  },
  {
    num: '03',
    emoji: '✍️',
    title: 'Generate',
    subtitle: '초안 생성',
    desc: '지원동기, 사업계획, 기대효과 등 필요한 섹션을 근거 기반으로 자동 작성합니다.',
  },
  {
    num: '04',
    emoji: '💬',
    title: 'Edit',
    subtitle: '자연어 편집',
    desc: '"2페이지로 줄여줘", "공식 문체로 바꿔줘"처럼 대화하듯 수정을 요청합니다.',
  },
  {
    num: '05',
    emoji: '📥',
    title: 'Export',
    subtitle: '파일 다운로드',
    desc: 'HWPX, PDF, HTML 형태로 즉시 내보냅니다. 공식 양식이 있으면 자동으로 채워드립니다.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">워크플로우</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            5단계로 완성되는
            <br />
            문서 자동화
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            파일 업로드부터 최종 제출까지 끊김 없이 이어집니다.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(({ num, emoji, title, subtitle, desc }) => (
            <div key={num} className="flex flex-col items-center text-center">
              {/* Icon with number badge */}
              <div className="relative mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-2xl shadow-sm">
                  {emoji}
                </div>
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {num}
                </span>
              </div>

              <p className="text-base font-bold text-slate-900">{title}</p>
              <p className="mb-2 text-xs font-semibold text-indigo-600">{subtitle}</p>
              <p className="text-sm leading-6 text-slate-600">{desc}</p>
            </div>
          ))}
        </div>

        {/* Connector line (desktop only) */}
        <div className="relative mt-0 hidden lg:block" aria-hidden>
          <div className="absolute inset-x-0 -top-[11.5rem] mx-auto flex max-w-5xl items-center justify-between px-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-indigo-100 opacity-70"
                style={{ margin: '0 2rem' }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
