'use client';

import { useEffect, useRef, useState } from 'react';

type TossWidgets = {
  setAmount: (args: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (args: { selector: string; variantKey?: string }) => Promise<void>;
  renderAgreement: (args: { selector: string; variantKey?: string }) => Promise<void>;
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

const PAYMENT_METHOD_SELECTOR = '#toss-payment-method';
const AGREEMENT_SELECTOR = '#toss-agreement';

function clearTossWidgetDom() {
  document.querySelector(PAYMENT_METHOD_SELECTOR)?.replaceChildren();
  document.querySelector(AGREEMENT_SELECTOR)?.replaceChildren();
}

function tossWidgetVariant(value: string | undefined, fallback: string) {
  return (value ?? fallback).trim();
}

function normalizeCustomerKey(userId: string, anonymousKey: string) {
  const normalized = userId.trim().replace(/[^0-9a-zA-Z._=-]/g, '_').slice(0, 50);
  return normalized || anonymousKey;
}

async function renderWithVariantFallback(
  render: (args: { selector: string; variantKey?: string }) => Promise<unknown>,
  selector: string,
  variantKey: string,
) {
  try {
    await render({ selector, variantKey });
  } catch (err) {
    if (!variantKey) throw err;
    console.warn(`[TossWidgets] ${selector} variant "${variantKey}" failed. Retrying with default variant.`, err);
    document.querySelector(selector)?.replaceChildren();
    await render({ selector });
  }
}

function paymentLoadErrorMessage(err: unknown) {
  const error = err as { code?: string; message?: string };
  if (error?.message === 'missing_toss_client_key') {
    return 'TossPayments 클라이언트 키가 설정되지 않았습니다. frontend/.env.local을 확인해 주세요.';
  }
  if (error?.code === 'INVALID_CLIENT_KEY' || /clientKey/i.test(error?.message ?? '')) {
    return 'TossPayments 클라이언트 키가 올바르지 않습니다. 테스트/라이브 키 종류를 확인해 주세요.';
  }
  return '결제 수단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

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
  const paymentMethodVariantKey = tossWidgetVariant(
    process.env.NEXT_PUBLIC_TOSS_PAYMENT_WIDGET_VARIANT_KEY,
    'DEFAULT',
  );
  const agreementVariantKey = tossWidgetVariant(
    process.env.NEXT_PUBLIC_TOSS_AGREEMENT_WIDGET_VARIANT_KEY,
    'AGREEMENT',
  );

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
    clearTossWidgetDom();
    setStep('select');
  };

  useEffect(() => {
    if (step !== 'pay' || !selectedPkg) return;
    let cancelled = false;
    widgetsRef.current = null;
    setWidgetsReady(false);
    setError(null);
    clearTossWidgetDom();

    (async () => {
      try {
        if (!clientKey.trim()) {
          throw new Error('missing_toss_client_key');
        }
        const { ANONYMOUS, loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
        if (cancelled) return;

        const tossPayments = await loadTossPayments(clientKey.trim());
        const widgets = tossPayments.widgets({
          customerKey: normalizeCustomerKey(userId, ANONYMOUS),
        });

        await widgets.setAmount({ currency: 'KRW', value: selectedPkg.amount });
        await renderWithVariantFallback(
          widgets.renderPaymentMethods.bind(widgets),
          PAYMENT_METHOD_SELECTOR,
          paymentMethodVariantKey,
        );

        try {
          await renderWithVariantFallback(
            widgets.renderAgreement.bind(widgets),
            AGREEMENT_SELECTOR,
            agreementVariantKey,
          );
        } catch (agreementError) {
          console.warn('[TossWidgets] agreement widget skipped:', agreementError);
        }

        if (!cancelled) {
          widgetsRef.current = widgets as unknown as TossWidgets;
          setWidgetsReady(true);
        }
      } catch (err) {
        console.error('[TossWidgets] load error:', err);
        if (!cancelled) setError(paymentLoadErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      widgetsRef.current = null;
    };
  }, [step, selectedPkg, clientKey, paymentMethodVariantKey, agreementVariantKey, userId]);

  const handlePay = async () => {
    if (!widgetsRef.current || !selectedPkg || paying) return;
    if (!userId) {
      setError('로그인 세션을 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    setPaying(true);

    try {
      const orderRes = await fetch('/api/payments/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedPkg.amount, userId }),
      });
      if (!orderRes.ok) {
        throw new Error('order_create_failed');
      }
      const order = (await orderRes.json()) as { orderId: string; orderName: string };

      await widgetsRef.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
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
                  <div className="absolute inset-0 z-10 flex min-h-[160px] items-center justify-center rounded-[16px] bg-white/80 text-sm text-[#9CA3AF]">
                    결제 수단 불러오는 중...
                  </div>
                )}
                <div id="toss-payment-method" className="min-h-[160px]" />
                <div id="toss-agreement" className="mt-3 min-h-0" />
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
