'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function FailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message') ?? '결제가 취소되었거나 실패했습니다.';

  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-3xl">
          ⚠️
        </div>
        <h2 className="text-2xl font-bold text-[#273044]">결제 실패</h2>
        <p className="mt-2 text-sm text-[#6B7280]">{message}</p>
        <button
          onClick={() => router.push('/app')}
          className="mt-6 rounded-[14px] bg-[#5263E8] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#4051d4]"
        >
          워크스페이스로 돌아가기
        </button>
      </div>
    </main>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5263E8] border-t-transparent" />
        </main>
      }
    >
      <FailContent />
    </Suspense>
  );
}
