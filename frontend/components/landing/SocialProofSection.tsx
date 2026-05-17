'use client';

import { motion } from 'framer-motion';

const STATS = [
  { value: '5분', label: '공고 → 초안 완성' },
  { value: '100%', label: '원문 기반 분석' },
  { value: 'HWPX', label: '한글 공식 형식 지원' },
];

const CITATIONS = [
  {
    num: '①',
    generated: '본 사업은 청년 창업자를 대상으로 하며,',
    source: '공고문 3p "지원 대상: 만 39세 이하 예비창업자"',
  },
  {
    num: '②',
    generated: '지원 금액은 최대 3,000만원이고',
    source: '공고문 4p "지원 내용: 최대 3,000만원 이내"',
  },
  {
    num: '③',
    generated: '사업 기간은 협약 체결일로부터 12개월입니다.',
    source: '공고문 5p "사업 기간: 협약일로부터 1년"',
  },
];

export function SocialProofSection() {
  return (
    <section className="bg-[#EEF2FF] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          {/* Left: citation mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="overflow-hidden rounded-2xl border border-[#D8DDFC] bg-white shadow-panel">
              {/* Doc header */}
              <div className="flex items-center justify-between border-b border-[#ECECF1] bg-[#F6F8FB] px-5 py-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#5263E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <span className="text-xs font-semibold text-[#273044]">사업계획서 초안 — 사업 개요</span>
                </div>
                <span className="rounded-full bg-[#EDEFFF] px-2.5 py-0.5 text-[10px] font-bold text-[#5263E8]">출처 표시</span>
              </div>

              {/* Generated text body */}
              <div className="px-5 pt-5 pb-3">
                <p className="text-sm leading-8 text-[#374151]">
                  {CITATIONS.map(({ num, generated }) => (
                    <span key={num}>
                      <sup className="mr-0.5 font-bold text-[#5263E8]">{num}</sup>
                      {generated}{' '}
                    </span>
                  ))}
                </p>
              </div>

              {/* Citation footnotes */}
              <div className="space-y-2 border-t border-[#ECECF1] px-5 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#9AA1AD]">원문 출처</p>
                {CITATIONS.map(({ num, source }, i) => (
                  <motion.div
                    key={num}
                    initial={{ opacity: 0, x: -6 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.1, duration: 0.35 }}
                    className="flex items-start gap-2.5 border-l-2 border-[#5263E8] pl-3"
                  >
                    <span className="mt-0.5 text-[10px] font-bold text-[#5263E8]">{num}</span>
                    <span className="text-[11px] leading-5 text-[#6B7280]">{source}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: heading + stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D8DDFC] bg-white/80 px-3.5 py-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#5263E8]" />
              <span className="text-xs font-bold text-[#5263E8]">신뢰성</span>
            </div>

            <h2 className="mt-5 text-3xl font-bold leading-[1.2] tracking-tight text-[#1F2937] sm:text-4xl">
              모든 초안은<br />원문 출처를 표시합니다
            </h2>

            <p className="mt-4 text-base leading-7 text-[#6B7280]">
              AI가 작성한 내용이 공고문 어느 문장에서 왔는지 확인할 수 있습니다. 할루시네이션을 직접 검증할 수 있습니다.
            </p>

            {/* Stats */}
            <div className="mt-8 space-y-4">
              {STATS.map(({ value, label }, i) => (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.4 }}
                  className="flex items-center gap-4 rounded-2xl border border-[#D8DDFC] bg-white px-5 py-4 shadow-sm"
                >
                  <p className="text-2xl font-bold text-[#5263E8]">{value}</p>
                  <div className="h-8 w-px bg-[#ECECF1]" />
                  <p className="text-sm text-[#6B7280]">{label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
