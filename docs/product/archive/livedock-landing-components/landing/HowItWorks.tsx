const STEPS = [
  {
    num: '01',
    label: 'Upload',
    title: '문서 업로드',
    desc: 'PDF, HWPX, URL 또는 텍스트로 공고문을 입력합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    num: '02',
    label: 'Analyze',
    title: '구조 분석',
    desc: 'AI Agent가 일정·자격·서류·평가기준을 원문 근거와 함께 추출합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z" />
      </svg>
    ),
  },
  {
    num: '03',
    label: 'Draft',
    title: '초안 생성',
    desc: '지원동기·사업계획·기대효과 등 각 섹션을 검토 가능한 초안으로 작성합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
  },
  {
    num: '04',
    label: 'Edit',
    title: '자연어 편집',
    desc: '대화하듯 수정 요청을 입력하면 AI가 반영해 재생성합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    num: '05',
    label: 'Export',
    title: '파일 내보내기',
    desc: 'HWPX·HTML 형태로 즉시 다운로드. 공식 양식이 있으면 자동으로 채워드립니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">워크플로우</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            5단계로 완성되는
            <br />
            문서 자동화
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            파일 업로드부터 최종 제출까지 끊김 없이 이어집니다.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="absolute left-0 right-0 top-[28px] hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent lg:block" aria-hidden />

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {STEPS.map(({ num, label, title, desc, icon }) => (
              <div key={num} className="relative flex flex-col items-center text-center lg:items-center">
                {/* Icon circle */}
                <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-indigo-100 bg-white shadow-sm text-indigo-600">
                  {icon}
                  {/* Step number badge */}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                    {num}
                  </span>
                </div>

                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">{label}</p>
                <p className="mb-2 text-sm font-bold text-slate-900">{title}</p>
                <p className="text-xs leading-5 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
