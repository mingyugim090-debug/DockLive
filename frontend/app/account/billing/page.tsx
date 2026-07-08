'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCreditContext } from '@/lib/creditContext';

const plans = [
  {
    name: 'Starter',
    credits: '월 30건',
    price: '무료 체험',
    desc: '처음 공고를 분석하고 초안 흐름을 검증할 때 적합합니다.',
  },
  {
    name: 'Team',
    credits: '월 300건',
    price: '팀 플랜',
    desc: '공고 분석과 제출 초안 작성을 반복하는 팀에 적합합니다.',
  },
  {
    name: 'Enterprise',
    credits: '맞춤 제공',
    price: '별도 문의',
    desc: '기관, 연구조직, 보안과 서식 운영 환경에 맞춰 제공합니다.',
  },
];

export default function AccountBillingPage() {
  const { credits, loading, openPurchaseModal } = useCreditContext();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <p className="text-sm font-bold text-[#3A7A68]">계정</p>
        <h1 className="mt-2 text-3xl font-bold text-[#24312D]">사용량과 결제를 관리합니다.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
          공고 분석, 초안 작성, export에 사용하는 크레딧을 확인하고 충전할 수 있습니다.
        </p>
      </section>

      <Card className="rounded-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#7B8782]">보유 크레딧</p>
            <p className="mt-2 text-4xl font-extrabold text-[#24312D]">
              {loading ? '확인 중' : `${credits ?? 0}건`}
            </p>
          </div>
          <Button onClick={openPurchaseModal}>크레딧 충전</Button>
        </div>
      </Card>

      <section className="grid gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className="rounded-2xl">
            <p className="text-lg font-bold text-[#24312D]">{plan.name}</p>
            <p className="mt-3 text-2xl font-extrabold text-[#245D50]">{plan.price}</p>
            <p className="mt-1 text-sm font-semibold text-[#65736E]">{plan.credits}</p>
            <p className="mt-4 text-sm leading-6 text-[#65736E]">{plan.desc}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
