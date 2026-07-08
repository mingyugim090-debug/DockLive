'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCreditContext } from '@/lib/creditContext';

const plans = [
  { name: 'Starter', credits: '월 30건', price: '무료 체험', desc: '랩미팅 데모와 초기 사용자 검증에 적합합니다.' },
  { name: 'Team', credits: '월 300건', price: '팀용', desc: '공고 분석과 제출 초안 작성을 반복하는 팀에 적합합니다.' },
  { name: 'Enterprise', credits: '맞춤 제공', price: '별도 협의', desc: '대학, 기관, 연구조직의 보안·서식·저장 환경에 맞춰 운영합니다.' },
];

export default function BillingPage() {
  const { credits, loading, openPurchaseModal } = useCreditContext();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <p className="text-sm font-bold text-[#3A7A68]">Billing</p>
        <h2 className="mt-2 text-3xl font-bold text-[#24312D]">Agent 사용량을 관리하세요.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
          분석, 초안 생성, export 작업에 사용할 크레딧을 확인합니다.
        </p>
      </section>

      <Card className="rounded-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#7B8782]">보유 크레딧</p>
            <p className="mt-2 text-4xl font-extrabold text-[#24312D]">{loading ? '확인 중' : `${credits ?? 0}개`}</p>
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
