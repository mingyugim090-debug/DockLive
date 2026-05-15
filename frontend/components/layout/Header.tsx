'use client';

import { Input } from '@/components/ui/Input';

export function Header({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#ECECF1]/80 bg-[#FAFAF7]/82 backdrop-blur-xl">
      <div className="flex min-h-[76px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ECECF1] bg-white text-[#273044] lg:hidden"
          aria-label="메뉴 열기"
        >
          ☰
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-[#273044]">{title}</h1>
          <p className="hidden text-sm text-[#7B8190] sm:block">문서 작업을 차분하게 정리하고 필요한 결과를 빠르게 만드세요.</p>
        </div>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <Input placeholder="문서, 작업, 템플릿 검색" aria-label="검색" />
        </div>
        <button className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#ECECF1] bg-white text-[#6B7280] sm:flex" aria-label="알림">
          ○
        </button>
        <div className="flex items-center gap-3 rounded-full border border-[#ECECF1] bg-white px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDEFFF] text-sm font-bold text-[#5263E8]">유</span>
          <span className="hidden text-sm font-semibold text-[#273044] sm:inline">사용자</span>
        </div>
      </div>
    </header>
  );
}
