'use client';

import { motion } from 'framer-motion';
import { ButtonLink } from '@/components/ui/Button';

const TRUST_PILLS = ['신용카드 불필요', 'HWPX 즉시 다운로드', '분석 결과 출처 표시'];

export function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-[#0D1220] py-28 sm:py-36">
      {/* Ambient radial glow */}
      <motion.div
        aria-hidden
        animate={{ opacity: [0.12, 0.22, 0.12] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(82,99,232,0.22) 0%, transparent 65%)',
        }}
      />

      <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5263E8]">지금 시작하기</p>

          <h2 className="mt-4 text-4xl font-bold leading-[1.15] text-white sm:text-5xl">
            다음 공고,<br />
            <span className="gradient-text">혼자 쓰지 마세요</span>
          </h2>

          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#94A3B8]">
            공고문을 올리면 5분 안에 초안이 완성됩니다. 무료로 시작할 수 있습니다.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <ButtonLink href="/auth?next=/app" className="px-7 py-3.5 text-base">
              무료로 초안 만들기
              <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </ButtonLink>
            <a
              href="#features"
              className="text-sm font-semibold text-[#94A3B8] transition hover:text-white"
            >
              기능 더 살펴보기 →
            </a>
          </div>

          {/* Trust pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {TRUST_PILLS.map((pill, i) => (
              <motion.span
                key={pill}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 + i * 0.08 }}
                className="flex items-center gap-1.5 text-xs text-[#6B7280]"
              >
                <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {pill}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
