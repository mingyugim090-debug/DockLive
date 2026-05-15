import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variants: Record<ButtonVariant, string> = {
  primary: 'gradient-primary text-white shadow-primary hover:-translate-y-0.5 hover:brightness-105',
  secondary: 'border border-[#E5E7EB] bg-white text-[#273044] hover:-translate-y-0.5 hover:border-[#D8DDFC] hover:bg-[#FBFBFD]',
  ghost: 'text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#273044]',
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
