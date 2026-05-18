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

          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[#5263E8]">지금 시작하기</p>
          <h2 className="relative mt-3 text-3xl font-bold leading-[1.15] text-white sm:text-4xl">
            다음 공고문,{' '}
            <span className="gradient-text">1분 안에 시작하세요</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[#94A3B8]">
            유형을 고르고 기본 정보를 입력하면 AI가 공고문 초안을 만들고 HWPX로 내려받을 수 있습니다.
          </p>

          <div className="relative mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href="/auth?next=/app" className="px-7 py-3 text-sm">
              공고문 만들기
              <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </ButtonLink>
            <a href="#features" className="text-sm font-semibold text-[#94A3B8] transition hover:text-white">
              기능 살펴보기 →
            </a>
          </div>

          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-4">
            {['참고자료 업로드 선택', 'HWPX 즉시 다운로드', '미리보기 수정 가능'].map((pill) => (
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
