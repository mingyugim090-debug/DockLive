'use client';

import { motion } from 'framer-motion';

interface HeroSectionProps {
  onStart: () => void;
  onDemo: () => void;
  isLoading?: boolean;
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  );
}

function ProductMockup() {
  return (
    <div className="relative w-full select-none">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-48 w-48 rounded-full bg-violet-300/25 blur-3xl" />

      {/* Browser chrome */}
      <div className="relative z-10 overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] bg-slate-950/80 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-md bg-white/[0.05] px-3 py-1">
            <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span className="text-[11px] text-slate-500">livedock.io/workspace</span>
          </div>
        </div>

        {/* App shell */}
        <div className="flex h-[340px]">
          {/* Sidebar */}
          <div className="hidden w-44 flex-shrink-0 border-r border-white/[0.06] bg-slate-950/60 p-3 sm:flex sm:flex-col">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">최근 작업</p>
            {[
              { name: '청년창업_공고', active: true },
              { name: '스마트팜_지원', active: false },
              { name: 'R&D_연구과제', active: false },
            ].map(({ name, active }) => (
              <div
                key={name}
                className={`mb-1 rounded-md px-2 py-1.5 ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-400'
                }`}
              >
                <p className="truncate text-[11px] font-medium">{name}</p>
              </div>
            ))}

            <div className="mt-auto space-y-1 border-t border-white/[0.06] pt-3">
              {['템플릿', '설정'].map((item) => (
                <div key={item} className="rounded-md px-2 py-1.5 text-[11px] text-slate-600">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-2.5 overflow-hidden p-4">
            {/* File uploaded */}
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
                <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-slate-200">청년창업_지원사업_공고.pdf</p>
                <p className="text-[10px] text-slate-500">2.4 MB · PDF</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                분석 완료
              </span>
            </div>

            {/* Analysis summary */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">분석 요약</p>
              <div className="space-y-1.5">
                {[
                  { label: '마감', value: 'D-14 · 2026.06.30', accent: true },
                  { label: '지원금', value: '최대 3,000만원', accent: false },
                  { label: '제출 방식', value: '온라인 시스템', accent: false },
                ].map(({ label, value, accent }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">{label}</span>
                    <span className={`text-[11px] font-semibold ${accent ? 'text-amber-400' : 'text-slate-300'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Draft generation in progress */}
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.07] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                  <p className="text-[11px] font-semibold text-indigo-300">섹션별 초안 생성 중</p>
                </div>
                <span className="text-[10px] text-slate-500">3 / 5 섹션</span>
              </div>
              <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded bg-white/[0.06]" />
                <div className="h-1.5 w-4/5 rounded bg-white/[0.06]" />
                <div className="h-1.5 w-2/3 rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TRUST_SIGNALS = [
  { value: '5분', label: '분석부터 초안 완성' },
  { value: 'HWPX', label: '한글 공식 형식 지원' },
  { value: '근거 표시', label: '원문 출처 기반 분석' },
];

export function HeroSection({ onStart, onDemo, isLoading }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-28 sm:pb-28 sm:pt-36">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-50 to-violet-50 blur-3xl opacity-80" />
        <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-indigo-50 opacity-60 blur-3xl" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Tag */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700">AI 문서 자동화 Agent</span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-[3rem]">
              공고문에서
              <br />
              제출 문서까지,
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                AI가 완성합니다
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-[1.05rem] leading-7 text-slate-600">
              PDF나 HWPX 파일을 업로드하면 AI Agent가 일정·자격·서류를 분석하고,
              지원서·사업계획서 초안을 자동으로 만들어 드립니다.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onStart}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 active:scale-95"
              >
                무료로 시작하기
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onDemo}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayIcon className="h-3.5 w-3.5 text-slate-400" />
                {isLoading ? '데모 불러오는 중...' : '샘플 데모 보기'}
              </button>
            </div>

            {/* Trust signals */}
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-slate-100 pt-8 sm:flex sm:gap-8">
              {TRUST_SIGNALS.map(({ value, label }) => (
                <div key={value} className="text-center sm:text-left">
                  <p className="text-base font-bold text-slate-900">{value}</p>
                  <p className="mt-0.5 text-xs leading-4 text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Product mockup */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="lg:pl-4"
          >
            <ProductMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
