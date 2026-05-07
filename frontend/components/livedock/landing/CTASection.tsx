interface CTASectionProps {
  onStart: () => void;
}

export function CTASection({ onStart }: CTASectionProps) {
  return (
    <section className="bg-indigo-600 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          지금 바로 시작하세요
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-200">
          공고문을 업로드하고 5분 안에 분석 결과와 문서 초안을 확인해보세요.
          <br className="hidden sm:block" />
          회원가입 없이 바로 사용할 수 있습니다.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 active:scale-95"
          >
            무료로 시작하기
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-indigo-300">
          <span className="flex items-center gap-1.5">
            <span className="text-indigo-200">✓</span> 회원가입 불필요
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-indigo-200">✓</span> 처리 후 즉시 삭제
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-indigo-200">✓</span> HWPX 기본 지원
          </span>
        </div>
      </div>
    </section>
  );
}
