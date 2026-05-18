'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  {
    num: '01',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
    title: '공고문 유형별 구조 자동 구성',
    body: '모집공고, 지원사업 공고, 행사 안내문에 맞춰 필요한 본문 항목을 먼저 잡습니다.',
    tags: ['모집공고', '지원사업', '행사 안내'],
  },
  {
    num: '02',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    title: '기본 정보 기반 초안 작성',
    body: '기관명, 모집 대상, 신청 기간, 선정 기준을 받아 행정 공고문 문체로 초안을 생성합니다.',
    tags: ['사업 개요', '모집 대상', '선정 기준'],
  },
  {
    num: '03',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    title: 'HWPX·DOCX·PDF 즉시 출력',
    body: '미리보기에서 문안을 확인한 뒤 공고 배포에 필요한 형식으로 내려받습니다.',
    tags: ['HWPX', 'PDF', 'DOCX'],
  },
] as const;

export function FeatureSection() {
  return (
    <section id="features" className="bg-[#F6F8FB] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mb-10 text-center"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5263E8]">핵심 기능</p>
          <h2 className="text-2xl font-bold text-[#1F2937] sm:text-3xl">
            공고문 제작에 필요한 흐름만 남겼습니다
          </h2>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ num, icon, title, body, tags }, i) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-[24px] border border-[#ECECF1] bg-white p-6 shadow-panel"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDEFFF] text-[#5263E8]">
                  {icon}
                </div>
                <span className="text-xs font-bold text-[#C0C5D0]">{num}</span>
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#273044]">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#6B7280]">{body}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[#D8DDFC] bg-[#F0F2FF] px-2.5 py-0.5 text-[10px] font-semibold text-[#5263E8]">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
