'use client';

import { Input } from '@/components/ui/Input';
import { useCreditContext } from '@/lib/creditContext';
import { insforge } from '@/lib/insforge';
import { useRouter } from 'next/navigation';

export function Header({ title, onMenu }: { title: string; onMenu: () => void }) {
  const router = useRouter();
  const { credits, loading, user, openPurchaseModal } = useCreditContext();

  const signOut = async () => {
    await insforge.auth.signOut();
    router.replace('/auth');
  };

  const displayName =
    user?.profile?.name ??
    (typeof user?.metadata?.name === 'string' ? user.metadata.name : null) ??
    user?.email?.split('@')[0] ??
    '사용자';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-bg)_82%,transparent)] backdrop-blur-xl transition-colors duration-300">
      <div className="flex min-h-[76px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] lg:hidden"
          aria-label="메뉴 열기"
        >
          <span className="text-lg font-bold">≡</span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-[var(--theme-text)]">{title}</h1>
          <p className="hidden text-sm text-[var(--theme-muted)] sm:block">
            공고 분석부터 제출 문서 export까지 한 흐름으로 관리하세요.
          </p>
        </div>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <Input placeholder="문서, 작업, 템플릿 검색" aria-label="검색" />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {/* User avatar */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5263E8] text-xs font-bold text-white"
            title={displayName}
          >
            {initial}
          </div>

          {/* Credits chip */}
          <button
            type="button"
            onClick={openPurchaseModal}
            title="크레딧 충전"
            className="flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--theme-text)] transition hover:bg-[var(--theme-surface-muted)]"
          >
            <span className="text-yellow-500">⚡</span>
            {loading ? '…' : credits !== null ? `${credits}개` : '–'}
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-2 text-sm font-semibold text-[var(--theme-muted)] transition hover:bg-[var(--theme-surface-muted)] hover:text-[var(--theme-text)]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
