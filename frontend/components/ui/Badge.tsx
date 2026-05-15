type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type LegacyVariant = 'required' | 'optional';

const toneClass: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-rose-50 text-rose-700 border-rose-100',
  info: 'bg-[#EEF2FF] text-[#5263E8] border-[#D8DDFC]',
  neutral: 'bg-[#F6F8FB] text-[#6B7280] border-[#ECECF1]',
};

export function Badge({
  children,
  tone,
  variant,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  variant?: LegacyVariant;
}) {
  const resolvedTone: BadgeTone = tone ?? (variant === 'required' ? 'warning' : variant === 'optional' ? 'neutral' : 'neutral');
  return (
    <span className={['inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', toneClass[resolvedTone]].join(' ')}>
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  if (['분석 완료', '완료'].includes(status)) return 'success';
  if (['처리 중', '진행 중', '대기 중', '대기'].includes(status)) return 'warning';
  if (status === '오류') return 'danger';
  return 'neutral';
}
