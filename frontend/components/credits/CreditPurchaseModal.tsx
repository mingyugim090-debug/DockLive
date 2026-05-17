'use client';

import { useEffect, useRef, useState } from 'react';

type TossWidgets = {
  setAmount: (args: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (args: { selector: string; variantKey: string }) => Promise<void>;
  renderAgreement: (args: { selector: string; variantKey: string }) => Promise<void>;
  requestPayment: (args: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    customerName?: string;
  }) => Promise<void>;
};

interface Package {
  id: string;
  credits: number;
  amount: number;
  perCredit: number;
  popular?: boolean;
}

const PACKAGES: Package[] = [
  { id: 'basic', credits: 10, amount: 4900, perCredit: 490 },
  { id: 'value', credits: 25, amount: 9900, perCredit: 396, popular: true },
];

export function CreditPurchaseModal({
  onClose,
  userId,
  userEmail,
  userName,
}: {
  onClose: () => void;
  userId: string;
  userEmail?: string;
  userName?: string;
}) {
  const [step, setStep] = useState<'select' | 'pay'>('select');
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [widgetsReady, setWidgetsReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetsRef = useRef<TossWidgets | null>(null);

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';

  const selectPackage = (pkg: Package) => {
    setSelectedPkg(pkg);
    setError(null);
    setWidgetsReady(false);
    setStep('pay');
  };

  const goBack = () => {
    widgetsRef.current = null;
    setWidgetsReady(false);
    setError(null);
    // Clear Toss widget DOM
    const el1 = document.getElementById('toss-payment-method');
    const el2 = document.getElementById('toss-agreement');
    if (el1) el1.innerHTML = '';
    if (el2) el2.innerHTML = '';
    setStep('select');
  };

  useEffect(() => {
    if (step !== 'pay' || !selectedPkg) return;
    let cancelled = false;

    (async () => {
      try {
        const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
        if (cancelled) return;

        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey: userId || `guest_${Date.now()}` });

        await widgets.setAmount({ currency: 'KRW', value: selectedPkg.amount });
        await widgets.renderPaymentMethods({
          selector: '#toss-payment-method',
          variantKey: 'DEFAULT',
        });
        await widgets.renderAgreement({
          selector: '#toss-agreement',
          variantKey: 'AGREEMENT',
        });

        if (!cancelled) {
          widgetsRef.current = widgets as unknown as TossWidgets;
          setWidgetsReady(true);
        }
      } catch (err) {
        console.error('[TossWidgets] load error:', err);
        if (!cancelled) setError('결제 수단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, selectedPkg, clientKey]);

  const handlePay = async () => {
    if (!widgetsRef.current || !selectedPkg || paying) return;
    setPaying(true);

    // orderId format: livedock_{userId}_{base36Timestamp}_{random6}  (≤ 64 chars)
    const orderId = `livedock_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: `LiveDock 크레딧 ${selectedPkg.credits}개`,
        successUrl: `${window.location.origin}/app/payments/success`,
        failUrl: `${window.location.origin}/app/payments/fail`,
        customerEmail: userEmail,
        customerName: userName,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'USER_CANCEL') {
        setError('결제 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="relative w-full max-w-md rounded-[28px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#273044]">크레딧 충전</h2>
            <p className="text-xs text-[#9CA3AF]">문서 생성 1회 = 1 크레딧</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#273044]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {step === 'select' ? (
            <div className="grid grid-cols-2 gap-3">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => selectPackage(pkg)}
                  className={`relative rounded-[20px] border-2 p-5 text-left transition hover:shadow-md ${
                    pkg.popular
                      ? 'border-[#5263E8] bg-[#EEF2FF]'
                      : 'border-[#E5E7EB] bg-white hover:border-[#5263E8]'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#5263E8] px-3 py-0.5 text-xs font-bold text-white">
                      인기
                    </span>
                  )}
                  <p className="text-3xl font-extrabold text-[#273044]">{pkg.credits}</p>
                  <p className="text-sm font-semibold text-[#6B7280]">크레딧</p>
                  <p className="mt-3 text-xl font-bold text-[#5263E8]">
                    {pkg.amount.toLocaleString()}원
                  </p>
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">개당 {pkg.perCredit}원</p>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {/* Selected package summary */}
              <div className="mb-4 flex items-center justify-between rounded-[14px] bg-[#EEF2FF] px-4 py-3">
                <div>
                  <span className="text-sm font-bold text-[#5263E8]">
                    크레딧 {selectedPkg?.credits}개
                  </span>
                  <span className="ml-2 text-sm font-semibold text-[#273044]">
                    {selectedPkg?.amount.toLocaleString()}원
                  </span>
                </div>
                <button
                  onClick={goBack}
                  className="text-xs font-semibold text-[#5263E8] hover:underline"
                >
                  변경
                </button>
              </div>

              {/* Toss widget mount points — must NOT be display:none when Toss renders into them */}
              <div className="relative">
                {!widgetsReady && !error && (
                  <div className="absolute inset-0 flex min-h-[160px] items-center justify-center text-sm text-[#9CA3AF]">
                    결제 수단 불러오는 중...
                  </div>
                )}
                <div id="toss-payment-method" className={widgetsReady ? '' : 'invisible min-h-[160px]'} />
                <div id="toss-agreement" className={widgetsReady ? 'mt-3' : 'invisible'} />
              </div>

              {error && (
                <p className="mt-3 rounded-[10px] bg-red-50 px-4 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                onClick={handlePay}
                disabled={!widgetsReady || paying}
                className="mt-4 w-full rounded-[14px] bg-[#5263E8] py-3.5 text-sm font-bold text-white transition hover:bg-[#4051d4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying ? '결제 처리 중...' : `${selectedPkg?.amount.toLocaleString()}원 결제하기`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
