'use client';

import { motion } from 'framer-motion';

/* ── inline mockup components ──────────────────────────────────────── */

function AnalysisMockup() {
  const rows = [
    { label: '마감일', value: 'D-14 · 2026.06.30', accent: true },
    { label: '지원 자격', value: '만 39세 이하 예비창업자', accent: false },
    { label: '지원 금액', value: '최대 3,000만원', accent: false },
    { label: '필수 서류', value: '사업계획서, 신청서 外 3종', accent: false },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E2D45] bg-[#111827] shadow-[0_32px_64px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2 border-b border-[#1E2D45] bg-[#0D1624] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
        </div>
        <span className="text-[10px] text-[#4A5A78]">공고 분석 결과</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
          완료
        </span>
      </div>
      <div className="space-y-2 p-4">
        {rows.map(({ label, value, accent }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.35 }}
            className="flex items-center justify-between rounded-xl border border-[#1E2D45] bg-[#0D1624] px-3 py-2.5"
          >
            <span className="text-[11px] text-[#4A5A78]">{label}</span>
            <span className={`text-[11px] font-bold ${accent ? 'text-amber-400' : 'text-[#94A3B8]'}`}>{value}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DraftMockup() {
  const sections = [
    { title: '사업 개요', widths: [92, 78, 85, 60] },
    { title: '추진 계획', widths: [88, 95, 70] },
    { title: '기대 성과', widths: [80, 90, 65, 75] },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E2D45] bg-[#111827] shadow-[0_32px_64px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2 border-b border-[#1E2D45] bg-[#0D1624] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
        </div>
        <span className="text-[10px] text-[#4A5A78]">사업계획서 초안 생성 중</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-[#5263E8]">
          <span className="h-1 w-1 rounded-full bg-[#5263E8] animate-pulse" />
          3 / 5 섹션
        </span>
      </div>
      <div className="space-y-3 p-4">
        {sections.map(({ title, widths }, si) => (
          <div key={title} className="rounded-xl border border-[#1E2D45] bg-[#0D1624] p-3">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5263E8]">{title}</p>
            <div className="space-y-1.5">
              {widths.map((w, li) => (
                <motion.div
                  key={li}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: si * 0.15 + li * 0.08, duration: 0.4, ease: 'easeOut' }}
                  style={{ width: `${w}%`, transformOrigin: 'left' }}
                  className="h-1.5 rounded-full bg-[#1E3058]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E2D45] bg-[#111827] shadow-[0_32px_64px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2 border-b border-[#1E2D45] bg-[#0D1624] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
          <div className="h-2 w-2 rounded-full bg-[#3D4D6A]" />
        </div>
        <span className="text-[10px] text-[#4A5A78]">내보내기</span>
      </div>
      <div className="space-y-3 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/40 py-5"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-900/50">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white">초안 완성</p>
            <p className="mt-0.5 text-[11px] text-[#4A5A78]">청년창업_사업계획서.hwpx</p>
          </div>
        </motion.div>
        <div className="flex gap-2">
          {['HWPX', 'PDF', 'DOCX'].map((fmt, i) => (
            <motion.span
              key={fmt}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.07 }}
              className="flex-1 rounded-lg border border-[#1E2D45] bg-[#0D1624] py-1.5 text-center text-[10px] font-bold text-[#5263E8]"
            >
              {fmt}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-2 gap-2"
        >
          {[
            { label: '분석 시간', value: '31초' },
            { label: '작성 섹션', value: '5 / 5' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[#1E2D45] bg-[#0D1624] py-2 text-center">
              <p className="text-xs font-bold text-white">{value}</p>
              <p className="text-[10px] text-[#4A5A78]">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ── feature data ───────────────────────────────────────────────────── */

const FEATURES = [
  {
    num: '01',
    title: '공고 요건을 30초 안에 구조화',
    body: '마감일, 지원 자격, 필수 제출 서류를 AI가 원문에서 추출하고 체크리스트로 정리합니다. 조건을 놓칠 가능성이 사라집니다.',
    Mockup: AnalysisMockup,
  },
  {
    num: '02',
    title: '심사 기준에 맞춰 섹션별 초안 자동 작성',
    body: '사업 개요부터 기대 성과까지, 공고의 평가 지표를 직접 참조하여 각 섹션의 초안을 만듭니다. 빈 페이지를 채우는 시간이 0이 됩니다.',
    Mockup: DraftMockup,
  },
  {
    num: '03',
    title: '바로 제출 가능한 HWPX 파일 완성',
    body: '생성된 초안이 한글 공식 형식(.hwpx)으로 그대로 출력됩니다. Mac이어도, 한글이 없어도 문제없습니다.',
    Mockup: ExportMockup,
  },
] as const;

/* ── section ─────────────────────────────────────────────────────────── */

export function FeatureSection() {
  return (
    <section id="features" className="bg-[#0D1220] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5263E8]">핵심 기능</p>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            공고문을 올리면 AI가 이 세 가지를 합니다
          </h2>
        </motion.div>

        <div className="mt-20 space-y-24">
          {FEATURES.map(({ num, title, body, Mockup }, i) => {
            const reversed = i % 2 === 1;
            return (
              <div
                key={num}
                className={`grid items-center gap-12 lg:grid-cols-2 ${
                  reversed ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <motion.div
                  initial={{ opacity: 0, x: reversed ? 28 : -28 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2035] text-sm font-bold text-[#5263E8]">
                      {num}
                    </span>
                    <div className="h-px flex-1 bg-[#1E2D45]" />
                  </div>
                  <h3 className="mt-5 text-2xl font-bold leading-snug text-white sm:text-3xl">{title}</h3>
                  <p className="mt-4 text-base leading-7 text-[#94A3B8]">{body}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Mockup />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
