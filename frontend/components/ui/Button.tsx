import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variants: Record<ButtonVariant, string> = {
  primary: 'gradient-primary text-white shadow-primary hover:-translate-y-0.5 hover:brightness-105',
  secondary: 'border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:-translate-y-0.5 hover:bg-[var(--theme-surface-muted)]',
  ghost: 'text-[var(--theme-muted)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-text)]',
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200',
        variants[variant],
        className,
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
