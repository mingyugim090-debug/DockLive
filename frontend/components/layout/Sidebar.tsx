'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/app', label: '공고문 만들기', icon: '문' },
  { href: '/app/templates', label: '템플릿', icon: '틀' },
  { href: '/app/documents', label: '문서함', icon: '함' },
  { href: '/app/history', label: '작업내역', icon: '역' },
  { href: '/app/settings', label: '설정', icon: '설' },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 bg-[#24312D]/25 backdrop-blur-sm transition lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[var(--theme-border)] bg-white px-4 py-5 shadow-panel transition-transform lg:static lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-3 py-2" onClick={onClose}>
          <Image src="/docklive-mark.svg" alt="" width={42} height={42} className="h-10 w-10" />
          <span>
            <span className="block text-base font-bold text-[#24312D]">DockLive</span>
            <span className="text-xs text-[#65736E]">공고문 자동화 도구</span>
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
                  active
                    ? 'bg-[#E7F1ED] text-[#245D50]'
                    : 'text-[#65736E] hover:bg-[#F3F7F5] hover:text-[#24312D]',
                ].join(' ')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-sm">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#DDE7E2] bg-[#F6FAF8] p-4">
          <p className="text-sm font-bold text-[#24312D]">1분 안에 시작</p>
          <p className="mt-2 text-xs leading-5 text-[#65736E]">
            템플릿 선택, 정보 입력, 참고자료 업로드, 미리보기, 다운로드 순서로 공고문을 만듭니다.
          </p>
        </div>
      </aside>
    </>
  );
}
