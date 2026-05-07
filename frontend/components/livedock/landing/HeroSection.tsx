'use client';

import { motion } from 'framer-motion';

interface HeroSectionProps {
  onStart: () => void;
  onDemo: () => void;
  isLoading?: boolean;
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function ProductMockup() {
  return (
    <div className="relative w-full">
      {/* Glow blurs */}
      <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-violet-200/40 blur-3xl" />

      {/* Browser chrome */}
      <div className="relative z-10 overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-black/10">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-slate-950/70 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          </div>
          <div className="ml-3 flex-1 rounded bg-white/[0.06] px-3 py-1">
            <span className="text-[11px] text-slate-500">livedock.io/workspace</span>
          </div>
        </div>

        {/* App layout */}
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-40 flex-shrink-0 border-r border-white/[0.06] bg-slate-950/40 p-3 sm:block">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">최근 분석</p>
            {['청년창업_공고', '스마트팜_지원', 'R&D_과제'].map((name, i) => (
              <div
                key={name}
                className={`mb-1 rounded-md px-2 py-1.5 ${
                  i === 0 ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-500'
                }`}
              >
                <p className="truncate text-[11px]">{name}</p>
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-3 p-4">
            {/* Upload done */}
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
                <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-200">청년창업_지원사업_공고.hwpx</p>
                <p className="text-[11px] text-slate-500">2.4 MB · HWPX</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                ✓ 완료
              </span>
            </div>

            {/* Analysis result */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">분석 결과</p>
              <div className="space-y-2">
                {[
                  ['공고명', '2026 청년창업 지원사업'],
                  ['마감', 'D-14 · 2026.05.20'],
                  ['지원금', '최대 3,000만원'],
                  ['필수 서류', '사업계획서, 재무계획'],
                ].map(([label, value], i) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="flex-shrink-0 text-[11px] text-slate-500">{label}</span>
                    <span className={`text-right text-[11px] ${i === 1 ? 'font-semibold text-red-400' : 'text-slate-300'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Draft generation */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                  <p className="text-[11px] font-semibold text-indigo-300">초안 생성 중...</p>
                </div>
                <span className="text-[11px] text-slate-500">3 / 5 섹션</span>
              </div>
              <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded bg-white/[0.06]" />
                <div className="h-2 w-4/5 rounded bg-white/[0.06]" />
                <div className="h-2 w-2/3 rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATS = [
  { value: 'HWPX 포함', label: '3가지 파일 형식 지원' },
  { value: '5분 이내', label: '분석부터 초안 완성' },
  { value: '근거 기반', label: '출처 표시 정확한 결과' },
];

export function HeroSection({ onStart, onDemo, isLoading }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-28 sm:pb-28 sm:pt-36">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-indigo-50 opacity-70 blur-3xl" />
        <div className="absolute right-1/4 top-20 h-64 w-64 rounded-full bg-violet-50 opacity-60 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700">AI 문서 자동화 Agent</span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
              공고문에서
              <br className="hidden sm:block" /> 제출 문서까지,
              <br />
              <span className="text-indigo-600">AI가 완성합니다</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              HWPX, PDF, DOCX 파일을 업로드하면 AI Agent가 구조를 분석하고 지원서, 보고서,
              요약본 초안을 자동으로 만들어 드립니다.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onStart}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
              >
                무료로 시작하기
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onDemo}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
              >
                샘플 데모 보기
              </button>
            </div>

            {/* Stats row */}
            <div className="mt-10 flex flex-wrap gap-8 border-t border-slate-100 pt-8">
              {STATS.map(({ value, label }) => (
                <div key={value}>
                  <p className="text-lg font-bold text-slate-900">{value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:pl-4"
          >
            <ProductMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
