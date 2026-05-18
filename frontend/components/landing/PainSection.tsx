'use client';

import { motion } from 'framer-motion';

const PAINS = [
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    bg: 'bg-amber-50 text-amber-500',
    title: '매번 새로 쓰는 공고문',
    body: '모집 대상, 신청 기간, 제출 서류를 공고마다 다시 정리하고 문장을 다듬어야 합니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
    bg: 'bg-amber-50 text-amber-500',
    title: '행정문서 구조 정리',
    body: '사업 개요부터 문의처까지 빠뜨리면 안 되는 항목이 많아 검토 시간이 길어집니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
      </svg>
    ),
    bg: 'bg-rose-50 text-rose-500',
    title: '반복되는 문안 수정',
    body: '모집공고, 지원사업 공고, 행사 안내문마다 톤과 형식을 맞춰 다시 작성해야 합니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    bg: 'bg-rose-50 text-rose-500',
    title: 'HWPX 배포 파일 준비',
    body: '최종 공고문은 HWPX, DOCX, PDF로 배포해야 해 형식 변환까지 챙겨야 합니다.',
  },
] as const;

export function PainSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mb-10 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-amber-700">공고 담당자의 현실</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1F2937] sm:text-3xl">
            공고문 하나에도 반복 작업이 많습니다
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#6B7280]">
            유형은 비슷하지만 세부 조건과 문안은 매번 달라집니다.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map((pain, i) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-[24px] border border-[#ECECF1] bg-white p-5 shadow-panel"
            >
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${pain.bg}`}>
                {pain.icon}
              </div>
              <p className="mt-3 text-sm font-bold text-[#273044]">{pain.title}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#6B7280]">{pain.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Before/after stat */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex items-center justify-center gap-6 rounded-2xl border border-[#ECECF1] bg-white px-6 py-4 shadow-sm"
        >
          <div className="text-center">
            <p className="text-xl font-bold text-[#1F2937]">평균 8시간</p>
            <p className="text-xs text-[#9AA1AD]">직접 작성할 때</p>
          </div>
          <div className="flex h-8 items-center gap-1 text-[#9AA1AD]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#5263E8]">5분</p>
            <p className="text-xs text-[#9AA1AD]">LiveDock AI</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
