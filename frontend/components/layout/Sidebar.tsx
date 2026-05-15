'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/app', label: 'Dashboard', icon: '⌂' },
  { href: '/app/upload', label: 'Upload', icon: '↑' },
  { href: '/app/documents', label: 'Documents', icon: '□' },
  { href: '/app/templates', label: 'Templates', icon: '◇' },
  { href: '/app/history', label: 'History', icon: '◷' },
  { href: '/app/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 bg-[#273044]/25 backdrop-blur-sm transition lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-surface)_92%,transparent)] px-4 py-5 shadow-panel backdrop-blur-xl transition-transform lg:static lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Link href="/" className="flex items-center gap-3 rounded-[22px] px-3 py-2" onClick={onClose}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--theme-primary-soft)] text-lg font-bold text-[var(--theme-primary)]">D</span>
          <span>
            <span className="block text-base font-bold text-[var(--theme-text)]">DockLive</span>
            <span className="text-xs text-[var(--theme-muted)]">Document Agent</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-1.5">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={[
                  'flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition',
                  active ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-surface-muted)] hover:text-[var(--theme-text)]',
                ].join(' ')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--theme-surface)] text-sm">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-bg-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--theme-text)]">이번 달 사용량</p>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-muted)]">문서 24개 중 15개를 처리했습니다.</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--theme-primary-soft)]">
            <div className="h-full w-[62%] rounded-full gradient-primary" />
          </div>
        </div>
      </aside>
    </>
  );
}
