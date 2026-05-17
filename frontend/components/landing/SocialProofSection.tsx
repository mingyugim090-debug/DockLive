'use client';

import { motion } from 'framer-motion';

const STATS = [
  { value: '5분', label: '공고 → 초안 완성' },
  { value: '100%', label: '원문 기반 분석' },
  { value: 'HWPX', label: '한글 공식 형식' },
];

export function SocialProofSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          {/* Left: heading + stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D8DDFC] bg-[#EDEFFF] px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5263E8]" />
              <span className="text-xs font-bold text-[#5263E8]">신뢰성</span>
            </div>
            <h2 className="text-2xl font-bold leading-snug text-[#1F2937] sm:text-3xl">
              모든 초안은<br />원문 출처를 표시합니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              AI가 쓴 내용이 공고문 어느 문장에서 왔는지 확인할 수 있어 할루시네이션을 직접 검증할 수 있습니다.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {STATS.map(({ value, label }, i) => (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="rounded-2xl border border-[#ECECF1] bg-white p-4 text-center shadow-sm"
                >
                  <p className="text-lg font-bold text-[#5263E8]">{value}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-[#9AA1AD]">{label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: citation mockup */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="rounded-[24px] border border-[#ECECF1] bg-white shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-[#ECECF1] px-5 py-3">
              <span className="text-xs font-semibold text-[#273044]">사업계획서 초안 — 사업 개요</span>
              <span className="rounded-full bg-[#EDEFFF] px-2.5 py-0.5 text-[10px] font-bold text-[#5263E8]">출처 표시</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-8 text-[#374151]">
                <sup className="mr-0.5 font-bold text-[#5263E8]">①</sup>본 사업은 청년 창업자를 대상으로 하며,{' '}
                <sup className="mr-0.5 font-bold text-[#5263E8]">②</sup>지원 금액은 최대 3,000만원이고{' '}
                <sup className="mr-0.5 font-bold text-[#5263E8]">③</sup>사업 기간은 협약 체결일로부터 12개월입니다.
              </p>
            </div>
            <div className="space-y-2 border-t border-[#ECECF1] px-5 py-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA1AD]">원문 출처</p>
              {[
                ['①', '공고문 3p "지원 대상: 만 39세 이하 예비창업자"'],
                ['②', '공고문 4p "지원 내용: 최대 3,000만원 이내"'],
                ['③', '공고문 5p "사업 기간: 협약일로부터 1년"'],
              ].map(([num, src], i) => (
                <motion.div
                  key={num}
                  initial={{ opacity: 0, x: -4 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-2 border-l-2 border-[#5263E8] pl-3"
                >
                  <span className="text-[10px] font-bold text-[#5263E8]">{num}</span>
                  <span className="text-xs leading-5 text-[#6B7280]">{src}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
