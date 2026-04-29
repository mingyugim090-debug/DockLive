'use client';

interface BadgeProps {
  variant?: 'required' | 'optional' | 'safe' | 'warning' | 'danger' | 'passed' | 'default';
  children: React.ReactNode;
  className?: string;
}

const variants: Record<string, { bg: string; text: string; border: string }> = {
  required: {
    bg: 'rgba(124,111,247,0.15)',
    text: '#B89EFF',
    border: 'rgba(124,111,247,0.3)',
  },
  optional: {
    bg: 'rgba(255,255,255,0.06)',
    text: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.1)',
  },
  safe: {
    bg: 'rgba(74,222,128,0.12)',
    text: '#4ADE80',
    border: 'rgba(74,222,128,0.25)',
  },
  warning: {
    bg: 'rgba(251,191,36,0.12)',
    text: '#FBBF24',
    border: 'rgba(251,191,36,0.25)',
  },
  danger: {
    bg: 'rgba(248,113,113,0.12)',
    text: '#F87171',
    border: 'rgba(248,113,113,0.25)',
  },
  passed: {
    bg: 'rgba(255,255,255,0.05)',
    text: '#4A4A6A',
    border: 'rgba(255,255,255,0.08)',
  },
  default: {
    bg: 'rgba(255,255,255,0.06)',
    text: 'rgba(255,255,255,0.5)',
    border: 'rgba(255,255,255,0.1)',
  },
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const style = variants[variant];
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-semibold ${className}`}
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {children}
    </span>
  );
}
