'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const titles: Array<[string, string]> = [
  ['/app/upload', '문서 업로드'],
  ['/app/documents', '문서 목록'],
  ['/app/templates', '템플릿'],
  ['/app/history', '작업 이력'],
  ['/app/settings', '설정'],
  ['/app', '대시보드'],
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title = useMemo(() => titles.find(([path]) => pathname === path || (path !== '/app' && pathname.startsWith(path)))?.[1] ?? '대시보드', [pathname]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#273044] lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="min-w-0">
        <Header title={title} onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
