const PROBLEMS = [
  {
    emoji: '📄',
    title: '처음부터 다시 쓰는 지원서',
    desc: '공고마다 비슷한 내용을 처음부터 다시 작성합니다. 구조를 잡고 문구를 다듬는 데만 수 시간이 걸립니다.',
  },
  {
    emoji: '🔄',
    title: '형식 변환마다 깨지는 서식',
    desc: '공공기관은 HWPX, 기업은 DOCX, 제출은 PDF. 형식을 바꿀 때마다 표와 글꼴이 무너져 다시 꾸며야 합니다.',
  },
  {
    emoji: '🔍',
    title: '수십 페이지 공고문 직접 파악',
    desc: '마감일, 자격 조건, 제출 서류를 하나씩 직접 찾아야 합니다. 놓친 조건 하나가 탈락으로 이어집니다.',
  },
];

export function ProblemSection() {
  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">문제</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            반복적인 문서 업무에
            <br />
            지치셨나요?
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            LiveDock이 반복 작업을 대신 처리합니다.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {PROBLEMS.map(({ emoji, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 text-3xl">{emoji}</div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
              <p className="text-sm leading-6 text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
