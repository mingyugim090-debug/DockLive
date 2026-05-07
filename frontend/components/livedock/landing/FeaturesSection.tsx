const FEATURES = [
  {
    emoji: '🇰🇷',
    tag: 'HWPX',
    title: '한글 파일 완벽 지원',
    desc: 'HWPX 형식의 읽기, 쓰기, 편집을 기본 지원합니다. 공공기관 공식 양식도 서식 그대로 사용할 수 있습니다.',
  },
  {
    emoji: '🔎',
    tag: 'Evidence',
    title: '근거 기반 분석',
    desc: '공고문 원문 출처를 함께 표시합니다. 불확실하거나 확인이 필요한 내용은 별도로 표시해 임의 생성을 방지합니다.',
  },
  {
    emoji: '💬',
    tag: 'Edit',
    title: '자연어 편집',
    desc: '"공식적인 문체로 바꿔줘", "핵심만 두 문단으로 줄여줘"처럼 대화하듯 수정을 요청합니다.',
  },
  {
    emoji: '📋',
    tag: 'Draft',
    title: '섹션별 초안 생성',
    desc: '지원동기, 사업계획, 기대효과 등 섹션을 나누어 검토 가능한 초안을 만들어 확인을 요청합니다.',
  },
  {
    emoji: '📤',
    tag: 'Export',
    title: '다형식 내보내기',
    desc: 'HWPX, PDF, HTML 세 가지 형식으로 즉시 내보냅니다. 공식 양식이 있으면 자동으로 채워드립니다.',
  },
  {
    emoji: '🔒',
    tag: 'Secure',
    title: '안전한 데이터 처리',
    desc: '업로드된 파일은 처리 후 즉시 삭제됩니다. 분석 결과는 외부로 공유되지 않습니다.',
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">기능</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            문서 자동화에
            <br />
            필요한 모든 것
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ emoji, tag, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl">{emoji}</span>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600">
                  {tag}
                </span>
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
