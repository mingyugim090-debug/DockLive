import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  hover = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={[
        'rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-panel',
        hover ? 'transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(39,48,68,0.11)]' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
