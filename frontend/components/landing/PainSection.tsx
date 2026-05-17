'use client';

import { motion } from 'framer-motion';

const PAINS = [
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    iconBg: 'bg-amber-50 text-amber-600',
    title: '마감일 계산 반복',
    body: '공고마다 일정이 다릅니다. 접수 기간·서류 제출·발표일을 직접 찾아 정리해야 합니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    iconBg: 'bg-amber-50 text-amber-600',
    title: '자격 요건 해석 부담',
    body: '만 39세 이하, 업력 7년 미만, 소재지 요건 — 조건이 복잡할수록 오독 리스크가 커집니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    iconBg: 'bg-rose-50 text-rose-500',
    title: '사업계획서 백지 공포',
    body: '심사 기준을 보면서 섹션을 채워야 하지만, 어떻게 시작할지 모르는 시간이 제일 깁니다.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    iconBg: 'bg-rose-50 text-rose-500',
    title: 'HWPX 양식 고통',
    body: '제출 양식이 HWP/HWPX인데 Mac이거나 익숙하지 않으면 열리지도 않습니다.',
  },
] as const;


export function PainSection() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
          {/* Left: heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-xs font-bold text-amber-700">공모 지원자의 현실</span>
            </div>
            <h2 className="mt-5 text-3xl font-bold leading-[1.2] tracking-tight text-[#1F2937] sm:text-4xl">
              지원서 한 장에<br />며칠이 걸립니까
            </h2>
            <p className="mt-4 max-w-sm text-base leading-7 text-[#6B7280]">
              공고문을 읽고, 자격을 확인하고, 양식을 찾고, 섹션마다 처음부터 쓰는 과정 — 매번 반복됩니다.
            </p>

            {/* Divider + stat */}
            <div className="mt-8 flex items-center gap-4 border-t border-[#ECECF1] pt-7">
              <div>
                <p className="text-2xl font-bold text-[#1F2937]">평균 8시간</p>
                <p className="mt-0.5 text-xs text-[#9AA1AD]">공고 파악 + 지원서 초안 완성까지</p>
              </div>
              <div className="h-10 w-px bg-[#ECECF1]" />
              <div>
                <p className="text-2xl font-bold text-[#1F2937]">LiveDock 5분</p>
                <p className="mt-0.5 text-xs text-[#9AA1AD]">AI가 분석 + 초안 완성</p>
              </div>
            </div>
          </motion.div>

          {/* Right: pain cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PAINS.map((pain, i) => (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.42, delay: i * 0.1 }}
                className="rounded-[24px] border border-[#ECECF1] bg-white p-6 shadow-panel"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pain.iconBg}`}>
                  {pain.icon}
                </div>
                <p className="mt-4 text-sm font-bold text-[#273044]">{pain.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">{pain.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
