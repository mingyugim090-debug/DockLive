'use client';

import { motion } from 'framer-motion';

const STATS = [
  { value: '8종', label: '공고문 템플릿' },
  { value: '6단계', label: '제작 흐름' },
  { value: 'HWPX', label: '한글 배포 형식' },
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
              사용자는 1분 안에<br />제작 흐름을 이해합니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              템플릿을 고르고, 기본 정보를 입력하고, 참고자료를 더한 뒤 미리보기에서 확인하고 다운로드합니다.
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
              <span className="text-xs font-semibold text-[#273044]">공고문 미리보기 — 창업캠프 모집</span>
              <span className="rounded-full bg-[#EDEFFF] px-2.5 py-0.5 text-[10px] font-bold text-[#5263E8]">HWPX 구조</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-8 text-[#374151]">
                <sup className="mr-0.5 font-bold text-[#5263E8]">1</sup>사업 개요,{' '}
                <sup className="mr-0.5 font-bold text-[#5263E8]">2</sup>모집 대상,{' '}
                <sup className="mr-0.5 font-bold text-[#5263E8]">3</sup>신청 기간과 운영 일정을 행정문서 순서에 맞춰 정리합니다.
              </p>
            </div>
            <div className="space-y-2 border-t border-[#ECECF1] px-5 py-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA1AD]">제작 단계</p>
              {[
                ['①', '공고문 유형 선택'],
                ['②', '기본 정보 입력 및 참고자료 업로드'],
                ['③', '미리보기 확인 후 HWPX 다운로드'],
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
