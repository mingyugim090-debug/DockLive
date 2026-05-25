interface CTASectionProps {
  onStart: () => void;
}

export function CTASection({ onStart }: CTASectionProps) {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-20 sm:py-28">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute left-1/4 bottom-0 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold text-slate-300">회원가입 없이 바로 사용</span>
        </div>

        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          지금 바로 시작하세요
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
          공고문을 업로드하고 5분 안에 분석 결과와 문서 초안을 확인해보세요.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95"
          >
            무료로 시작하기
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          {[
            '회원가입 불필요',
            '파일은 처리 후 즉시 삭제',
            'HWPX 기본 지원',
          ].map((item) => (
            <span key={item} className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
