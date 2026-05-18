'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CreditPurchaseModal } from '@/components/credits/CreditPurchaseModal';
import { CreditProvider, useCreditContext } from '@/lib/creditContext';
import { loadSavedTheme } from '@/lib/theme';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const titles: Array<[string, string]> = [
  ['/app/documents', '문서함'],
  ['/app/billing', 'Billing'],
  ['/app/settings', '설정'],
  ['/app', '공고문 만들기'],
];

function AppLayoutInner({ children, title }: { children: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  const { isPurchaseModalOpen, closePurchaseModal, user } = useCreditContext();

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[var(--theme-text)] transition-colors duration-300 lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="min-w-0">
        <Header title={title} onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      {isPurchaseModalOpen && (
        <CreditPurchaseModal
          onClose={closePurchaseModal}
          userId={user?.id ?? ''}
          userEmail={user?.email ?? undefined}
          userName={
            user?.profile?.name ??
            (typeof user?.metadata?.name === 'string' ? user.metadata.name : undefined)
          }
        />
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = useMemo(
    () =>
      titles.find(
        ([path]) => pathname === path || (path !== '/app' && pathname.startsWith(path)),
      )?.[1] ?? '공고문 만들기',
    [pathname],
  );

  useEffect(() => {
    loadSavedTheme();
  }, []);

  return (
    <CreditProvider>
      <AppLayoutInner title={title}>{children}</AppLayoutInner>
    </CreditProvider>
  );
}
