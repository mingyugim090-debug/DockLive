'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { label: '사용 방법', href: '#how-it-works' },
  { label: '기능', href: '#features' },
  { label: '활용 사례', href: '#use-cases' },
  { label: 'FAQ', href: '#faq' },
];

interface LandingHeaderProps {
  onScrollToWorkspace: () => void;
}

export function LandingHeader({ onScrollToWorkspace }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? 'border-b border-slate-200/80 bg-white/96 shadow-sm backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="DockLive">
          <Image src="/docklive-logo.svg" alt="DockLive" width={150} height={44} priority className="h-9 w-auto" />
        </a>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="주요 섹션">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onScrollToWorkspace}
            className="hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 sm:inline-flex"
          >
            작업 시작
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white/98 px-4 pb-4 pt-2 md:hidden">
          <nav className="space-y-0.5" aria-label="모바일 메뉴">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              onClick={() => {
                setMobileOpen(false);
                onScrollToWorkspace();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white"
            >
              작업 시작
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
