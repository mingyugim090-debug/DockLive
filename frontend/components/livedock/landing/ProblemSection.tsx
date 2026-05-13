const PROBLEMS = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    title: '처음부터 다시 쓰는 지원서',
    desc: '공고마다 비슷한 내용을 처음부터 다시 작성합니다. 구조를 잡고 문구를 다듬는 데만 수 시간이 걸립니다.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    title: '형식 변환마다 깨지는 서식',
    desc: '공공기관은 HWPX, 기업은 DOCX, 제출은 PDF. 형식을 바꿀 때마다 표와 글꼴이 무너져 다시 꾸며야 합니다.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z" />
      </svg>
    ),
    title: '수십 페이지 공고문 직접 파악',
    desc: '마감일, 자격 조건, 제출 서류를 하나씩 직접 찾아야 합니다. 놓친 조건 하나가 탈락으로 이어집니다.',
  },
] as const;

export function ProblemSection() {
  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">문제</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            반복적인 문서 업무에
            <br />
            지치셨나요?
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            LiveDock이 반복 작업을 대신 처리합니다.
          </p>
        </div>

        {/* Problem cards */}
        <div className="grid gap-5 sm:grid-cols-3">
          {PROBLEMS.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                {icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
              <p className="text-sm leading-6 text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
