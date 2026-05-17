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
    title: '마감일 계산 반복',
    body: '공고마다 일정이 달라 접수 기간과 서류 제출일을 직접 찾아 정리해야 합니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
    bg: 'bg-amber-50 text-amber-500',
    title: '자격 요건 해석 부담',
    body: '복잡한 지원 조건을 직접 해석하다 오독하면 서류를 다시 써야 합니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
      </svg>
    ),
    bg: 'bg-rose-50 text-rose-500',
    title: '사업계획서 백지 공포',
    body: '평가 기준을 보면서 섹션을 채워야 하는데 어떻게 시작할지 막막합니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    bg: 'bg-rose-50 text-rose-500',
    title: 'HWPX 양식 고통',
    body: '제출 양식이 HWP/HWPX인데 Mac이거나 한글 SW가 없으면 열리지도 않습니다.',
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
            <span className="text-xs font-bold text-amber-700">공모 지원자의 현실</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1F2937] sm:text-3xl">
            지원서 한 장에 며칠이 걸립니까
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#6B7280]">
            공고 파악부터 서류 작성까지 — 매번 처음부터 반복됩니다.
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
            <p className="text-xs text-[#9AA1AD]">직접 쓸 때</p>
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
