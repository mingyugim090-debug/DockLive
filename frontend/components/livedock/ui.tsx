'use client';

import { useMemo, type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import type {
  CompanyProfile,
  DayStatus,
  DraftSection,
  DraftStatus,
  ExportMetadata,
  SourceEvidence,
  WorkflowStatus,
} from '@/lib/types';

export type InputMode = 'file' | 'url' | 'text';
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const badgeToneClass: Record<BadgeTone, string> = {
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  danger: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  info: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  neutral: 'border-white/10 bg-white/[0.06] text-text2',
};

const workflowLabel: Record<WorkflowStatus, string> = {
  analyzed: '분석 완료',
  collecting_inputs: '입력 수집',
  drafting: '초안 생성',
  reviewing: '검토 중',
  confirmed: '확인 완료',
  finalized: '최종 문서',
};

const workflowTone: Record<WorkflowStatus, BadgeTone> = {
  analyzed: 'info',
  collecting_inputs: 'warning',
  drafting: 'info',
  reviewing: 'warning',
  confirmed: 'success',
  finalized: 'success',
};

const draftLabel: Record<DraftStatus, string> = {
  empty: '대기',
  needs_input: '입력 필요',
  drafted: '초안 완료',
  revised: '수정됨',
  confirmed: '확인 완료',
};

const draftTone: Record<DraftStatus, BadgeTone> = {
  empty: 'neutral',
  needs_input: 'warning',
  drafted: 'info',
  revised: 'info',
  confirmed: 'success',
};

const dayTone: Record<DayStatus, BadgeTone> = {
  safe: 'success',
  warning: 'warning',
  danger: 'danger',
  passed: 'neutral',
};

export function StatusBadge({ label, tone = 'neutral', className }: { label: string; tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-normal',
        badgeToneClass[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  return <StatusBadge label={workflowLabel[status] ?? status} tone={workflowTone[status] ?? 'neutral'} />;
}

export function DraftStatusBadge({ status, label }: { status: DraftStatus; label?: string }) {
  return <StatusBadge label={label ?? draftLabel[status] ?? status} tone={draftTone[status] ?? 'neutral'} />;
}

export function DayStatusBadge({ status, label }: { status: DayStatus; label: string }) {
  return <StatusBadge label={label} tone={dayTone[status] ?? 'neutral'} />;
}

export function AppHeader({
  title,
  subtitle,
  navItems,
  onBack,
  status,
  right,
}: {
  title?: string;
  subtitle?: string;
  navItems?: Array<{ label: string; href: string }>;
  onBack?: () => void;
  status?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(6,10,22,0.76)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-text2 transition hover:border-white/20 hover:text-text"
              aria-label="이전 화면으로 이동"
            >
              ←
            </button>
          ) : null}
          <a href="/" className="flex shrink-0 items-center gap-3" aria-label="DockLive 홈">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.07] font-bold text-white shadow-[0_0_24px_rgba(86,112,255,0.22)]">
              <span className="absolute inset-0 rounded-md bg-[linear-gradient(135deg,rgba(91,141,255,0.34),rgba(167,114,255,0.12))]" />
              <span className="relative">D</span>
            </span>
            <span className="hidden text-base font-semibold tracking-normal text-text sm:inline">DockLive</span>
          </a>
          {title ? (
            <div className="min-w-0 border-l border-white/10 pl-3">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-text">{title}</p>
                {status}
              </div>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-text3">{subtitle}</p> : null}
            </div>
          ) : null}
        </div>

        {navItems?.length ? (
          <nav className="hidden items-center gap-1 md:flex" aria-label="주요 섹션">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-xs font-medium text-text2 transition hover:bg-white/[0.05] hover:text-text"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-[linear-gradient(135deg,#7c8cff,#9a6cff)] text-white shadow-[0_14px_34px_rgba(92,106,255,0.26)] hover:brightness-110',
        variant === 'secondary' &&
          'border border-white/10 bg-white/[0.06] text-text hover:border-white/20 hover:bg-white/[0.09]',
        variant === 'ghost' && 'text-text2 hover:bg-white/[0.05] hover:text-text',
        variant === 'danger' && 'border border-rose-400/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionCard({
  title,
  eyebrow,
  desc,
  children,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  desc?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className={cn('glass-panel overflow-hidden rounded-lg border border-white/10 p-5 shadow-panel', className)}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
          <h2 className="text-lg font-semibold tracking-normal text-text">{title}</h2>
          {desc ? <p className="mt-2 max-w-2xl text-sm leading-6 text-text2">{desc}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </motion.section>
  );
}

export function InfoCard({
  title,
  items,
  children,
  tone = 'neutral',
  emptyText = '추출된 항목이 없습니다.',
}: {
  title: string;
  items?: string[];
  children?: ReactNode;
  tone?: BadgeTone;
  emptyText?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition duration-200',
        tone === 'warning'
          ? 'border-amber-400/20 bg-amber-400/[0.06]'
          : tone === 'danger'
            ? 'border-rose-400/20 bg-rose-400/[0.06]'
            : tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/[0.05]'
              : tone === 'info'
                ? 'border-sky-400/20 bg-sky-400/[0.05]'
                : 'border-white/10 bg-white/[0.035]',
      )}
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children ?? (
        <ul className="mt-3 space-y-2">
          {items && items.length > 0 ? (
            items.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-text2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
                <span>{item}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-text3">{emptyText}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function NoticeBanner({
  title,
  children,
  tone = 'info',
}: {
  title?: string;
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm leading-6',
        tone === 'warning'
          ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
          : tone === 'danger'
            ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
            : tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
              : 'border-sky-400/20 bg-sky-400/10 text-sky-100',
      )}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <NoticeBanner tone="danger" title="문제가 발생했습니다">{children}</NoticeBanner>;
}

export function LoadingState({ label = 'Agent 작업실을 불러오는 중입니다.' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center text-text2">
      <div className="glass-panel rounded-lg border border-white/10 p-8">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.03] px-5 py-8 text-center">
      <p className="text-sm font-semibold text-text">{title}</p>
      {desc ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text2">{desc}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function HeroMockup() {
  const checklist = ['사업계획서', '개인정보 동의서', '실적 증빙', '예산 계획'];
  return (
    <motion.div
      variants={fadeUp}
      className="relative mx-auto w-full max-w-[540px] rounded-lg border border-white/10 bg-[linear-gradient(145deg,rgba(18,24,42,0.94),rgba(10,13,26,0.92))] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.44)]"
    >
      <div className="rounded-md border border-white/8 bg-black/20">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-text">2026 창업성장 지원사업</p>
            <p className="mt-1 text-[11px] text-text3">공고 분석 리포트</p>
          </div>
          <StatusBadge label="D-12" tone="warning" />
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_0.78fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-sky-400/15 bg-sky-400/[0.06] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-sky-100">분석 진행</p>
                <span className="text-[11px] text-sky-200">82%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[82%] rounded-full bg-[linear-gradient(90deg,#6fd3ff,#8b78ff)]" />
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-semibold text-text">확인 필요 주장</p>
              <div className="mt-3 space-y-2">
                {['전년도 매출 3억 원 이하', '수도권 외 사업장 보유'].map((item) => (
                  <div key={item} className="flex items-center justify-between gap-3 rounded-md bg-amber-400/[0.07] px-3 py-2">
                    <span className="truncate text-[11px] text-amber-100">{item}</span>
                    <span className="text-[10px] text-amber-200">검토</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-semibold text-text">HWPX export</p>
              <p className="mt-2 text-[11px] leading-5 text-text3">최종 초안과 공식 양식을 연결할 준비가 되었습니다.</p>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs font-semibold text-text">제출서류 체크리스트</p>
            <div className="mt-3 space-y-2">
              {checklist.map((item, index) => (
                <div key={item} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border text-[9px]',
                      index < 2 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-white/12 bg-white/[0.04] text-text3',
                    )}
                  >
                    {index < 2 ? '✓' : ''}
                  </span>
                  <span className="text-[11px] text-text2">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-white/8 bg-bg/50 p-3">
              <p className="text-[11px] font-semibold text-text">다음 질문</p>
              <p className="mt-1 text-[11px] leading-5 text-text3">팀의 핵심 성과와 지원금 사용 계획을 입력해 주세요.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function InputModeTabs({ mode, onChange }: { mode: InputMode; onChange: (mode: InputMode) => void }) {
  const tabs: Array<{ id: InputMode; label: string; desc: string }> = [
    { id: 'file', label: 'PDF', desc: '공고 파일' },
    { id: 'url', label: 'URL', desc: '웹 공고' },
    { id: 'text', label: '텍스트', desc: '본문 붙여넣기' },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-3 py-3 text-left transition',
            mode === tab.id ? 'bg-white/[0.11] text-text shadow-inner' : 'text-text3 hover:bg-white/[0.05] hover:text-text2',
          )}
        >
          <span className="block text-sm font-semibold">{tab.label}</span>
          <span className="mt-0.5 hidden text-[11px] sm:block">{tab.desc}</span>
        </button>
      ))}
    </div>
  );
}

export function UploadDropzone({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
    onDrop: (acceptedFiles) => onFile(acceptedFiles[0] ?? null),
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition duration-200',
        isDragActive
          ? 'border-primary bg-primary/10'
          : 'border-white/14 bg-white/[0.035] hover:border-primary/55 hover:bg-white/[0.055]',
      )}
    >
      <input {...getInputProps()} />
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-xl text-text2 transition group-hover:text-text">
        ↑
      </div>
      <p className="text-sm font-semibold text-text">{file ? file.name : 'PDF 공고문을 끌어오거나 선택하세요'}</p>
      <p className="mt-2 max-w-md text-xs leading-5 text-text3">
        일정, 제출 서류, 지원 자격, 평가 기준을 근거와 함께 추출합니다. PDF 형식을 권장합니다.
      </p>
      {file ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFile(null);
          }}
          className="mt-4 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-text2 transition hover:text-text"
        >
          파일 변경
        </button>
      ) : null}
    </div>
  );
}

export function ProfileContextCard({
  company,
  onChange,
}: {
  company: CompanyProfile;
  onChange: (company: CompanyProfile) => void;
}) {
  const update = <Key extends keyof CompanyProfile>(key: Key, value: CompanyProfile[Key]) => {
    onChange({ ...company, [key]: value });
  };

  return (
    <SectionCard
      title="지원자/팀 컨텍스트"
      eyebrow="Optional"
      desc="필수는 아니지만 입력하면 적합성 판단과 초안의 구체성이 좋아집니다."
      className="lg:sticky lg:top-24"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="팀/회사명" value={company.name} onChange={(value) => update('name', value)} placeholder="예: DockLive Team" />
        <TextInput label="분야" value={company.industry} onChange={(value) => update('industry', value)} placeholder="예: AI 문서 자동화" />
        <TextInput label="단계" value={company.stage} onChange={(value) => update('stage', value)} placeholder="예: 예비창업, 초기창업" />
        <TextInput label="지역" value={company.region} onChange={(value) => update('region', value)} placeholder="예: 서울, 부산" />
      </div>

      <details className="group mt-4 rounded-lg border border-white/10 bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-text">
          강점과 필요 지원 항목
          <span className="text-text3 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid gap-3 border-t border-white/10 p-4">
          <TextArea
            label="핵심 강점"
            value={company.strengths}
            onChange={(value) => update('strengths', value)}
            placeholder="성과, 보유 역량, 팀의 차별점"
          />
          <TextArea
            label="필요 지원"
            value={company.needs}
            onChange={(value) => update('needs', value)}
            placeholder="지원금, 멘토링, 공간, 장비, 네트워크"
          />
          <TextArea
            label="이전 지원 이력"
            value={company.previous_support}
            onChange={(value) => update('previous_support', value)}
            placeholder="선정 이력, 중복 수혜 여부, 관련 사업 참여 이력"
          />
          <TextInput
            label="팀 규모"
            type="number"
            value={company.team_size == null ? '' : String(company.team_size)}
            onChange={(value) => update('team_size', value ? Number(value) : null)}
            placeholder="예: 4"
          />
        </div>
      </details>
    </SectionCard>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-text2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-shell w-full rounded-md px-3 py-2.5 text-sm"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  minHeight = 'min-h-[96px]',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-text2">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn('input-shell w-full resize-y rounded-md px-3 py-2.5 text-sm leading-6', minHeight)}
      />
    </label>
  );
}

export function WorkflowStepper({
  currentStep,
  onChange,
}: {
  currentStep: 1 | 2 | 3 | 4 | 5;
  onChange: (step: 1 | 2 | 3 | 4) => void;
}) {
  const steps: Array<{ step: 1 | 2 | 3 | 4; label: string; desc: string }> = [
    { step: 1, label: '분석', desc: '요구사항과 근거' },
    { step: 2, label: '입력', desc: '부족한 정보 수집' },
    { step: 3, label: '초안', desc: '섹션별 작성' },
    { step: 4, label: '최종', desc: '검토와 export' },
  ];

  return (
    <nav className="glass-panel rounded-lg border border-white/10 p-2" aria-label="문서 생성 단계">
      <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {steps.map((item) => {
          const state = item.step < currentStep ? 'done' : item.step === currentStep ? 'current' : 'pending';
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => onChange(item.step)}
              className={cn(
                'group flex min-w-[132px] items-center gap-3 rounded-md px-3 py-3 text-left transition lg:min-w-0',
                state === 'current'
                  ? 'bg-primary/12 text-text ring-1 ring-primary/35'
                  : state === 'done'
                    ? 'text-text2 hover:bg-white/[0.05] hover:text-text'
                    : 'text-text3 hover:bg-white/[0.04] hover:text-text2',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold',
                  state === 'current'
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : state === 'done'
                      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                      : 'border-white/10 bg-white/[0.04] text-text3',
                )}
              >
                {state === 'done' ? '✓' : item.step}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 hidden text-xs text-current opacity-60 sm:block">{item.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function EvidenceList({ evidence }: { evidence: SourceEvidence[] }) {
  if (!evidence.length) {
    return <EmptyState title="표시할 근거가 없습니다." desc="원문에서 인용 가능한 근거가 없거나 분석 결과에 포함되지 않았습니다." />;
  }

  return (
    <details className="rounded-lg border border-white/10 bg-white/[0.035]">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-text">
        근거 보기
        <span className="text-xs text-text3">{evidence.length}개 인용</span>
      </summary>
      <div className="space-y-3 border-t border-white/10 p-4">
        {evidence.map((item, index) => (
          <div key={`${item.field}-${index}`} className="rounded-md border border-white/10 bg-bg/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={item.field} tone="info" />
              {item.page ? <StatusBadge label={`${item.page}p`} tone="neutral" /> : null}
              <StatusBadge label={`${Math.round((item.confidence ?? 0.7) * 100)}%`} tone="neutral" />
            </div>
            <p className="mt-3 text-sm leading-6 text-text2">“{item.quote}”</p>
            {item.note ? <p className="mt-2 text-xs leading-5 text-text3">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function MarkdownPreview({ content, emptyText }: { content: string; emptyText: string }) {
  const nodes = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const elements: ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (!listItems.length) return;
      const current = listItems;
      listItems = [];
      elements.push(
        <ul key={`list-${elements.length}`} className="my-3 space-y-1.5 pl-4">
          {current.map((item) => (
            <li key={item} className="list-disc text-sm leading-7 text-text2">
              {item}
            </li>
          ))}
        </ul>,
      );
    };

    trimmed.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        flushList();
        elements.push(<div key={`space-${elements.length}`} className="h-2" />);
        return;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushList();
        const level = heading[1].length;
        const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
        elements.push(
          <Tag key={`heading-${elements.length}`} className="mt-4 text-base font-semibold leading-7 text-text first:mt-0">
            {heading[2]}
          </Tag>,
        );
        return;
      }

      const list = line.match(/^[-*]\s+(.+)$/);
      if (list) {
        listItems.push(list[1]);
        return;
      }

      flushList();
      elements.push(
        <p key={`p-${elements.length}`} className="text-sm leading-7 text-text2">
          {line}
        </p>,
      );
    });

    flushList();
    return elements;
  }, [content]);

  if (!nodes) {
    return <EmptyState title={emptyText} desc="필수 정보를 입력한 뒤 섹션별 초안을 생성하면 이 영역에 문서 미리보기가 표시됩니다." />;
  }

  return <div className="document-preview rounded-lg border border-white/10 bg-bg/65 p-5">{nodes}</div>;
}

export function DraftSectionCard({
  draft,
  feedback,
  streamState,
  onFeedbackChange,
  onSaveFeedback,
  onRevise,
  busy,
}: {
  draft: DraftSection;
  feedback: string;
  streamState?: string;
  onFeedbackChange: (value: string) => void;
  onSaveFeedback: () => void;
  onRevise: () => void;
  busy: boolean;
}) {
  const confirmationItems = Array.from(new Set([...(draft.confirmation_required ?? []), ...(draft.needs_confirmation ?? [])]));
  const relatedCriteria = draft.related_criteria ?? [];
  const revisionNotes = draft.revision_notes ?? [];
  return (
    <motion.article variants={fadeUp} className="rounded-lg border border-white/10 bg-white/[0.035] shadow-panel">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">{draft.title}</h3>
          <p className="mt-1 text-xs text-text3">섹션 ID: {draft.section_id}</p>
        </div>
        {streamState ? <StatusBadge label={streamState} tone="info" /> : <DraftStatusBadge status={draft.status} />}
      </div>
      <div className="space-y-4 p-4">
        {confirmationItems.length > 0 ? (
          <NoticeBanner tone="warning" title="제출 전 확인이 필요한 주장">
            <ul className="space-y-1">
              {confirmationItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </NoticeBanner>
        ) : null}
        {draft.purpose || relatedCriteria.length || revisionNotes.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {draft.purpose ? (
              <div className="rounded-lg border border-sky-400/15 bg-sky-400/[0.05] p-3">
                <p className="text-xs font-semibold text-sky-100">섹션 목적</p>
                <p className="mt-2 text-xs leading-5 text-text2">{draft.purpose}</p>
              </div>
            ) : null}
            {relatedCriteria.length ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-text">관련 평가 기준</p>
                <p className="mt-2 text-xs leading-5 text-text3">{relatedCriteria.join(', ')}</p>
              </div>
            ) : null}
            {revisionNotes.length ? (
              <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.05] p-3">
                <p className="text-xs font-semibold text-amber-100">보완 메모</p>
                <p className="mt-2 text-xs leading-5 text-text2">{revisionNotes.join(' · ')}</p>
              </div>
            ) : null}
          </div>
        ) : null}
        {busy && streamState ? (
          <div className="rounded-lg border border-white/10 bg-bg/60 p-5">
            <div className="mb-3 h-3 w-2/5 animate-pulse rounded bg-white/10" />
            <div className="space-y-2">
              <div className="h-3 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/8" />
            </div>
          </div>
        ) : (
          <MarkdownPreview content={draft.content_markdown} emptyText="아직 초안이 없습니다." />
        )}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <TextArea
            label="피드백"
            value={feedback}
            onChange={onFeedbackChange}
            placeholder="수정 방향, 강조할 경험, 제외할 내용 등을 적어 주세요."
            minHeight="min-h-[84px]"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onSaveFeedback} disabled={busy}>
              피드백 저장
            </Button>
            <Button type="button" onClick={onRevise} disabled={busy || !draft.content_markdown}>
              피드백 반영
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function ExportPanel({
  finalTitle,
  finalContent,
  templateFile,
  templateMap,
  onTemplateFile,
  onTemplateMap,
  onExportHtml,
  onExportHwpx,
  onExportTemplate,
  onCreatePlaceholderMap,
  onCopyMarkdown,
  exportHistory,
  onDownloadStoredExport,
  onRefreshExports,
  placeholderMapPreview,
  placeholderWarnings,
  busy,
}: {
  finalTitle: string;
  finalContent: string;
  templateFile: File | null;
  templateMap: string;
  onTemplateFile: (file: File | null) => void;
  onTemplateMap: (value: string) => void;
  onExportHtml: () => void;
  onExportHwpx: () => void;
  onExportTemplate: () => void;
  onCreatePlaceholderMap: () => void;
  onCopyMarkdown: () => void;
  exportHistory: ExportMetadata[];
  onDownloadStoredExport: (exportId: string) => void;
  onRefreshExports: () => void;
  placeholderMapPreview?: string;
  placeholderWarnings?: string[];
  busy: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Export actions</p>
            <p className="mt-1 text-xs leading-5 text-text3">HWPX가 실패하면 HTML export로 먼저 문서를 확보할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onExportHtml} disabled={busy}>
              HTML export
            </Button>
            <Button type="button" onClick={onExportHwpx} disabled={busy}>
              HWPX export
            </Button>
            <Button type="button" variant="secondary" onClick={onCreatePlaceholderMap} disabled={busy}>
              Placeholder map
            </Button>
            <Button type="button" variant="ghost" onClick={onCopyMarkdown}>
              Markdown 복사
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text">최근 생성 파일</p>
            <p className="mt-1 text-xs leading-5 text-text3">Supabase에 저장된 export 파일을 다시 다운로드할 수 있습니다.</p>
          </div>
          <Button type="button" variant="secondary" onClick={onRefreshExports} disabled={busy}>
            새로고침
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {exportHistory.length ? (
            exportHistory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-md border border-white/10 bg-bg/45 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{item.filename}</p>
                  <p className="mt-1 text-xs text-text3">
                    {item.export_type} · {Math.max(1, Math.round(item.size_bytes / 1024))}KB ·{' '}
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => onDownloadStoredExport(item.id)} disabled={busy}>
                  다시 다운로드
                </Button>
              </div>
            ))
          ) : (
            <EmptyState title="저장된 export 파일이 없습니다." desc="HTML 또는 HWPX export를 생성하면 여기에 표시됩니다." />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[0.8fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-text">공식 양식에 채우기</p>
            <p className="mt-2 text-sm leading-6 text-text2">
              기관에서 제공한 HWPX 양식을 업로드하면 지정한 placeholder를 최종 문서 내용으로 치환합니다. 복잡한 양식은 기본 export보다
              이 방식을 권장합니다.
            </p>
            <label className="mt-4 block rounded-lg border border-dashed border-white/14 bg-bg/40 p-4 text-sm text-text2">
              <span className="block font-semibold text-text">HWPX 템플릿 업로드</span>
              <input
                type="file"
                accept=".hwpx,application/vnd.hancom.hwpx"
                onChange={(event) => onTemplateFile(event.target.files?.[0] ?? null)}
                className="mt-3 w-full text-xs text-text3 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-text2"
              />
              {templateFile ? <span className="mt-2 block text-xs text-primary">{templateFile.name}</span> : null}
            </label>
          </div>
          <div>
            <TextArea
              label="치환 JSON"
              value={templateMap}
              onChange={onTemplateMap}
              placeholder={'{\n  "{{title}}": "최종 문서 제목",\n  "{{content}}": "본문 전체",\n  "{{applicant_name}}": "지원자명"\n}'}
              minHeight="min-h-[180px]"
            />
            <div className="mt-3 flex justify-end">
              <Button type="button" onClick={onExportTemplate} disabled={busy || !templateFile}>
                템플릿 HWPX export
              </Button>
            </div>
            {placeholderMapPreview ? (
              <details className="mt-4 rounded-lg border border-sky-400/15 bg-sky-400/[0.05]">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-sky-100">
                  생성된 placeholder map 미리보기
                </summary>
                <pre className="max-h-[260px] overflow-auto border-t border-sky-400/10 p-4 text-xs leading-5 text-text2">
                  {placeholderMapPreview}
                </pre>
              </details>
            ) : null}
            {placeholderWarnings?.length ? (
              <div className="mt-4">
                <NoticeBanner tone="warning" title="Placeholder map 확인 필요">
                  <ul className="space-y-1">
                    {placeholderWarnings.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </NoticeBanner>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-sm font-semibold text-text">{finalTitle}</p>
          <p className="mt-1 text-xs text-text3">제출 전 검토용 preview</p>
        </div>
        <MarkdownPreview content={finalContent} emptyText="최종 문서가 아직 생성되지 않았습니다." />
      </div>
    </div>
  );
}
