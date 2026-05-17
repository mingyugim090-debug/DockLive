'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useCreditContext } from '@/lib/creditContext';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshCredits } = useCreditContext();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const confirmed = useRef(false);

  useEffect(() => {
    if (confirmed.current) return;
    confirmed.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMessage('결제 정보가 올바르지 않습니다.');
      return;
    }

    fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? 'confirm_failed');
        }
        return res.json() as Promise<{ creditsAdded: number }>;
      })
      .then(async (data) => {
        setCreditsAdded(data.creditsAdded);
        setStatus('success');
        await refreshCredits();
        setTimeout(() => router.push('/app'), 3000);
      })
      .catch((err: Error) => {
        setErrorMessage(err.message || '결제 처리 중 오류가 발생했습니다.');
        setStatus('error');
      });
  }, [searchParams, router, refreshCredits]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      {status === 'loading' && (
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#5263E8] border-t-transparent" />
          <p className="text-base font-semibold text-[#273044]">결제를 확인하는 중...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-[#273044]">결제 완료!</h2>
          <p className="mt-2 text-[#6B7280]">
            크레딧 <span className="font-bold text-[#5263E8]">{creditsAdded}개</span>가
            충전되었습니다.
          </p>
          <p className="mt-4 text-sm text-[#9CA3AF]">잠시 후 워크스페이스로 이동합니다...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            ❌
          </div>
          <h2 className="text-2xl font-bold text-[#273044]">결제 오류</h2>
          <p className="mt-2 text-sm text-[#6B7280]">{errorMessage}</p>
          <button
            onClick={() => router.push('/app')}
            className="mt-6 rounded-[14px] bg-[#5263E8] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#4051d4]"
          >
            워크스페이스로 돌아가기
          </button>
        </div>
      )}
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5263E8] border-t-transparent" />
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
