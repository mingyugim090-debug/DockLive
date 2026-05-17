'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ButtonLink } from '@/components/ui/Button';

/* ── step content components ─────────────────────────────────────── */

function UploadStep() {
  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D8DDFC] bg-[#F6F8FB] py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDEFFF]">
          <svg className="h-5 w-5 text-[#5263E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-[#5263E8]">공고문을 드래그하거나 클릭해 업로드</p>
        <p className="text-[10px] text-[#9AA1AD]">PDF · HWPX · HWP · DOCX</p>
      </div>
      {/* Uploaded file */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex items-center gap-3 rounded-xl border border-[#ECECF1] bg-white px-3 py-2.5"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#EDEFFF]">
          <svg className="h-4 w-4 text-[#5263E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#273044]">청년창업_지원사업_공고.pdf</p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#EDEFFF]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#5263E8] to-[#7A69EC]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.4, duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
          className="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600"
        >
          완료
        </motion.span>
      </motion.div>
    </div>
  );
}

function AnalyzeStep() {
  const items = [
    { label: '마감일', value: 'D-14 · 2026.06.30', accent: true, delay: 0.1 },
    { label: '지원 자격', value: '만 39세 이하 예비창업자', accent: false, delay: 0.25 },
    { label: '지원 금액', value: '최대 3,000만원', accent: false, delay: 0.4 },
    { label: '제출 서류', value: '사업계획서, 신청서 外 3종', accent: false, delay: 0.55 },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl bg-[#F6F8FB] px-3 py-2">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#5263E8]" />
        <p className="text-[11px] font-semibold text-[#5263E8]">AI가 공고문에서 핵심 정보를 추출하는 중</p>
      </div>
      {items.map(({ label, value, accent, delay }) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay, duration: 0.3 }}
          className="flex items-center justify-between rounded-xl border border-[#ECECF1] bg-white px-3 py-2"
        >
          <span className="text-[11px] text-[#9AA1AD]">{label}</span>
          <span className={`text-[11px] font-bold ${accent ? 'text-amber-500' : 'text-[#273044]'}`}>{value}</span>
        </motion.div>
      ))}
    </div>
  );
}

function DraftStep() {
  const sections = [
    { title: '사업 개요', lines: [80, 95, 60], delay: 0 },
    { title: '추진 계획', lines: [90, 75, 85, 50], delay: 0.3 },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl bg-[#EDEFFF] px-3 py-2">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#5263E8]" />
        <p className="text-[11px] font-semibold text-[#5263E8]">섹션별 초안 작성 중 — 2 / 5 완료</p>
      </div>
      {sections.map(({ title, lines, delay }) => (
        <motion.div
          key={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay, duration: 0.4 }}
          className="rounded-xl border border-[#ECECF1] bg-white p-3"
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#5263E8]">{title}</p>
          <div className="space-y-1.5">
            {lines.map((w, i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: delay + 0.15 + i * 0.1, duration: 0.35, ease: 'easeOut' }}
                style={{ width: `${w}%`, transformOrigin: 'left' }}
                className="h-1.5 rounded-full bg-[#EDEFFF]"
              />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ExportStep() {
  return (
    <div className="space-y-3">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 py-6"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#1F2937]">HWPX 초안 완성!</p>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">청년창업_사업계획서_초안.hwpx</p>
        </div>
      </motion.div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '분석 시간', value: '4분 32초' },
          { label: '작성 섹션', value: '5 / 5' },
        ].map(({ label, value }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="rounded-xl border border-[#ECECF1] bg-white px-3 py-2.5 text-center"
          >
            <p className="text-xs font-bold text-[#273044]">{value}</p>
            <p className="mt-0.5 text-[10px] text-[#9AA1AD]">{label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── step metadata ────────────────────────────────────────────────── */

const STEPS = [
  { id: 0, phase: '01', label: '업로드', title: '공고문 업로드', Component: UploadStep },
  { id: 1, phase: '02', label: '분석', title: 'AI 핵심 정보 추출', Component: AnalyzeStep },
  { id: 2, phase: '03', label: '초안', title: '섹션별 초안 생성', Component: DraftStep },
  { id: 3, phase: '04', label: '완성', title: 'HWPX 파일 완성', Component: ExportStep },
] as const;

/* ── 3D scene ─────────────────────────────────────────────────────── */

function WorkflowScene3D() {
  const [step, setStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 120, damping: 22 });
  const springY = useSpring(rawY, { stiffness: 120, damping: 22 });
  const rotateY = useTransform(springX, [-0.5, 0.5], [-10, 10]);
  const rotateX = useTransform(springY, [-0.5, 0.5], [7, -7]);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  const { Component } = STEPS[step];

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-pointer select-none"
      style={{ perspective: '1400px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-60 w-60 rounded-full bg-[#D8DDFC] opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-[#E9E6FF] opacity-50 blur-3xl" />

      {/* 3D card */}
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={{ y: [0, -7, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="relative overflow-hidden rounded-[28px] border border-[#ECECF1] bg-white shadow-[0_40px_80px_rgba(39,48,68,0.14),0_0_0_1px_rgba(82,99,232,0.06)]"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2.5 border-b border-[#ECECF1] bg-[#F6F8FB] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[#E8EAF0] bg-white px-2.5 py-1">
            <svg className="h-2.5 w-2.5 flex-shrink-0 text-[#9AA1AD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <span className="text-[10px] text-[#9AA1AD]">docklive.io/workspace</span>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{ width: i === step ? 16 : 6, backgroundColor: i === step ? '#5263E8' : '#D8DDFC' }}
                transition={{ duration: 0.3 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Step tab bar */}
        <div className="flex border-b border-[#ECECF1] bg-white">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className="relative flex flex-1 flex-col items-center gap-0.5 px-2 py-2.5 transition-colors"
            >
              <span className={`text-[9px] font-bold uppercase tracking-wider ${i === step ? 'text-[#5263E8]' : 'text-[#C0C5D0]'}`}>
                {s.phase}
              </span>
              <span className={`text-[10px] font-semibold ${i === step ? 'text-[#273044]' : 'text-[#9AA1AD]'}`}>
                {s.label}
              </span>
              {i === step && (
                <motion.div
                  layoutId="step-underline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-[#5263E8] to-[#7A69EC]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Animated step title */}
        <div className="flex items-center justify-between border-b border-[#F6F8FB] bg-white px-4 py-2.5">
          <AnimatePresence mode="wait">
            <motion.p
              key={`title-${step}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-bold text-[#273044]"
            >
              {STEPS[step].title}
            </motion.p>
          </AnimatePresence>
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#5263E8] animate-pulse" />
        </div>

        {/* Step content */}
        <div className="min-h-[264px] bg-[#FAFAF9] p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Component />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Reflection shadow */}
      <div
        className="pointer-events-none absolute -bottom-6 left-[10%] right-[10%] h-12 rounded-[50%] blur-xl opacity-30"
        style={{ background: 'radial-gradient(ellipse, rgba(82,99,232,0.35) 0%, transparent 70%)' }}
      />
    </div>
  );
}

/* ── trust signals ────────────────────────────────────────────────── */

const TRUST = [
  { value: '5분', label: '분석→초안 완성' },
  { value: 'HWPX', label: '한글 공식 형식' },
  { value: '출처 표시', label: '원문 기반 분석' },
];

/* ── hero section ─────────────────────────────────────────────────── */

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
        style={{ backgroundImage: 'radial-gradient(circle, #5263e8 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_1.08fr] lg:gap-16">
        {/* Left copy */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D8DDFC] bg-white/80 px-3.5 py-1.5 shadow-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#5263E8]" />
            <span className="text-xs font-bold text-[#5263E8]">AI 문서 자동화 Agent</span>
          </div>

          <h1 className="text-[2.6rem] font-bold leading-[1.15] tracking-tight text-[#1F2937] sm:text-5xl lg:text-[3.1rem]">
            공고에서
            <br />
            제출 서류까지,
            <br />
            <span className="gradient-text">AI가 완성합니다</span>
          </h1>

          <p className="mt-5 max-w-[460px] text-base leading-7 text-[#6B7280]">
            공고문을 올리면 AI Agent가 일정·자격·서류를 분석하고 지원서·사업계획서 초안을 5분 안에 만들어 드립니다.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/auth?next=/app">
              무료로 시작하기
              <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </ButtonLink>
            <ButtonLink href="#features" variant="secondary">기능 살펴보기</ButtonLink>
          </div>

          {/* Trust signals */}
          <div className="mt-9 grid grid-cols-3 gap-4 border-t border-[#ECECF1] pt-7">
            {TRUST.map(({ value, label }) => (
              <div key={value}>
                <p className="text-sm font-bold text-[#1F2937]">{value}</p>
                <p className="mt-0.5 text-xs leading-4 text-[#9AA1AD]">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: 3D workflow scene */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <WorkflowScene3D />
        </motion.div>
      </div>
    </section>
  );
}
