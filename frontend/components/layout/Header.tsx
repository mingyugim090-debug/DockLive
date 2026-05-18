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
    <header className="sticky top-0 z-30 border-b border-[#E4EBE7] bg-white/88 backdrop-blur-xl">
      <div className="flex min-h-[76px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#DDE7E2] bg-white text-[#24312D] lg:hidden"
          aria-label="메뉴 열기"
        >
          <span className="text-lg font-bold">≡</span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-[#24312D]">{title}</h1>
          <p className="hidden text-sm text-[#65736E] sm:block">
            템플릿 선택부터 HWPX 다운로드까지 한 흐름으로 공고문을 작성합니다.
          </p>
        </div>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <Input placeholder="템플릿, 공고문, 문서 검색" aria-label="검색" />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3A7A68] text-xs font-bold text-white"
            title={displayName}
          >
            {initial}
          </div>

          <button
            type="button"
            onClick={openPurchaseModal}
            title="크레딧 충전"
            className="flex items-center gap-1.5 rounded-full border border-[#DDE7E2] bg-white px-3 py-1.5 text-sm font-semibold text-[#24312D] transition hover:bg-[#F3F7F5]"
          >
            <span className="text-[#B7943E]">C</span>
            {loading ? '확인 중' : credits !== null ? `${credits}개` : '확인'}
          </button>

          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-[#DDE7E2] bg-white px-4 py-2 text-sm font-semibold text-[#65736E] transition hover:bg-[#F3F7F5] hover:text-[#24312D]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
