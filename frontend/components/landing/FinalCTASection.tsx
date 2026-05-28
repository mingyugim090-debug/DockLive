'use client';

import { motion } from 'framer-motion';
import { ButtonLink } from '@/components/ui/Button';

export function FinalCTASection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-[32px] bg-[#0D1220] px-8 py-14 text-center sm:px-12"
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(82,99,232,0.2) 0%, transparent 60%)' }}
          />

          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[#5263E8]">Start</p>
          <h2 className="relative mt-3 text-3xl font-bold leading-[1.15] text-white sm:text-4xl">
            다음 공고,{' '}
            <span className="gradient-text">먼저 분석하세요</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[#94A3B8]">
            원문을 넣으면 요구사항을 정리하고, 부족한 정보만 물은 뒤 제출 초안까지 이어갑니다.
          </p>

          <div className="relative mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href="/auth?next=/app" className="px-7 py-3 text-sm">
              공고 분석 시작
              <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </ButtonLink>
            <a href="#features" className="text-sm font-semibold text-[#94A3B8] transition hover:text-white">
              흐름 살펴보기 →
            </a>
          </div>

          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-4">
            {['원문 근거 확인', '확인 질문 분리', 'HWPX export'].map((pill) => (
              <span key={pill} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {pill}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
