const FEATURES = [
  {
    tag: 'HWPX',
    title: '한글 파일 완벽 지원',
    desc: 'HWPX 형식의 읽기, 쓰기, 편집을 기본 지원합니다. 공공기관 공식 양식도 서식 그대로 사용할 수 있습니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    color: 'indigo',
  },
  {
    tag: 'Evidence',
    title: '근거 기반 분석',
    desc: '공고문 원문 출처를 함께 표시합니다. 불확실하거나 확인이 필요한 내용은 별도로 표시해 임의 생성을 방지합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z" />
      </svg>
    ),
    color: 'violet',
  },
  {
    tag: 'Edit',
    title: '자연어 편집',
    desc: '"공식적인 문체로 바꿔줘", "핵심만 두 문단으로 줄여줘"처럼 대화하듯 수정을 요청합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    color: 'sky',
  },
  {
    tag: 'Draft',
    title: '섹션별 초안 생성',
    desc: '지원동기, 사업계획, 기대효과 등 섹션을 나누어 검토 가능한 초안을 만들어 확인을 요청합니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
      </svg>
    ),
    color: 'emerald',
  },
  {
    tag: 'Export',
    title: '다형식 내보내기',
    desc: 'HWPX, HTML 두 가지 형식으로 즉시 내보냅니다. 공식 양식이 있으면 자동으로 채워드립니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    color: 'amber',
  },
  {
    tag: 'Secure',
    title: '안전한 데이터 처리',
    desc: '업로드된 파일은 처리 후 즉시 삭제됩니다. 분석 결과는 외부로 공유되지 않습니다.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    color: 'rose',
  },
] as const;

type FeatureColor = 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';

const colorMap: Record<FeatureColor, { bg: string; text: string; badge: string }> = {
  indigo: { bg: 'bg-indigo-50 group-hover:bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-600' },
  violet: { bg: 'bg-violet-50 group-hover:bg-violet-100', text: 'text-violet-600', badge: 'bg-violet-50 text-violet-600' },
  sky: { bg: 'bg-sky-50 group-hover:bg-sky-100', text: 'text-sky-600', badge: 'bg-sky-50 text-sky-600' },
  emerald: { bg: 'bg-emerald-50 group-hover:bg-emerald-100', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600' },
  amber: { bg: 'bg-amber-50 group-hover:bg-amber-100', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-600' },
  rose: { bg: 'bg-rose-50 group-hover:bg-rose-100', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600' },
};

export function FeaturesSection() {
  return (
    <section id="features" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">기능</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            문서 자동화에
            <br />
            필요한 모든 것
          </h2>
        </div>

        {/* Feature cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ tag, title, desc, icon, color }) => {
            const c = colorMap[color];
            return (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${c.bg} ${c.text}`}>
                    {icon}
                  </div>
                  <span className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.badge}`}>
                    {tag}
                  </span>
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
                <p className="text-sm leading-6 text-slate-600">{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
