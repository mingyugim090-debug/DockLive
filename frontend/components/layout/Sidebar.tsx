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
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#ECECF1] bg-white/92 px-4 py-5 shadow-panel backdrop-blur-xl transition-transform lg:static lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Link href="/" className="flex items-center gap-3 rounded-[22px] px-3 py-2" onClick={onClose}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-lg font-bold text-[#5263E8]">D</span>
          <span>
            <span className="block text-base font-bold text-[#273044]">DockLive</span>
            <span className="text-xs text-[#7B8190]">Document Agent</span>
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
                  active ? 'bg-[#EEF2FF] text-[#5263E8]' : 'text-[#6B7280] hover:bg-[#F6F8FB] hover:text-[#273044]',
                ].join(' ')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-sm">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[24px] border border-[#ECECF1] bg-[#FAFAF7] p-4">
          <p className="text-sm font-semibold text-[#273044]">이번 달 사용량</p>
          <p className="mt-1 text-xs leading-5 text-[#7B8190]">문서 24개 중 15개를 처리했습니다.</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EDEFFF]">
            <div className="h-full w-[62%] rounded-full gradient-primary" />
          </div>
        </div>
      </aside>
    </>
  );
}
