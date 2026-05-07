const USE_CASES = [
  {
    tag: '공모전 · 지원사업',
    title: '공고문 분석부터 지원서 작성까지',
    desc: '수십 페이지 공고문을 업로드하면 자격 조건, 마감일, 제출 서류를 즉시 파악합니다. 지원동기, 사업계획 등 필수 섹션을 초안으로 제공합니다.',
    points: ['자격 조건 자동 확인', '필수 서류 체크리스트', '지원서 섹션별 초안'],
  },
  {
    tag: '공공기관 · 행정',
    title: '공식 양식을 AI가 자동으로 채워드립니다',
    desc: 'HWPX 공식 양식을 업로드하면 기관명, 날짜, 내용을 자동으로 채워 완성된 문서를 만듭니다. 서식과 레이아웃이 그대로 보존됩니다.',
    points: ['HWPX 양식 자동 입력', '서식·레이아웃 보존', '완성본 즉시 다운로드'],
  },
  {
    tag: '기업 · 보고서',
    title: '회의록, 결과보고서 자동화',
    desc: '회의 내용이나 원본 자료를 붙여넣으면 표준 형식의 보고서, 요약본, 발표 자료 초안을 자동으로 생성합니다.',
    points: ['회의록 자동 정리', '결과보고서 초안', '다형식 export'],
  },
  {
    tag: '법무 · 계약',
    title: '계약서 요약 및 핵심 조항 분석',
    desc: '복잡한 계약서를 업로드하면 핵심 조항, 계약 기간, 페널티 조건을 요약해 검토 시간을 크게 줄여드립니다.',
    points: ['핵심 조항 즉시 추출', '위험 조항 강조 표시', '요약본 자동 생성'],
  },
] as const;

export function UseCasesSection() {
  return (
    <section id="use-cases" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">사용 사례</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            다양한 상황에서
            <br />
            활용하세요
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {USE_CASES.map(({ tag, title, desc, points }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md"
            >
              <span className="mb-4 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {tag}
              </span>
              <h3 className="mb-2 text-[17px] font-bold text-slate-900">{title}</h3>
              <p className="mb-5 text-sm leading-6 text-slate-600">{desc}</p>
              <ul className="space-y-2">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
