'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { MockTemplate } from '@/data/types';

export function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: MockTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card hover className={selected ? 'border-[#B8C0FF] bg-[#F8F7FF]' : ''}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[#EEF2FF] text-[#5263E8]">◇</div>
        {selected ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#5263E8]">선택됨</span> : null}
      </div>
      <h3 className="mt-5 text-lg font-bold text-[#273044]">{template.name}</h3>
      <p className="mt-2 text-sm leading-6 text-[#7B8190]">{template.description}</p>
      <div className="mt-5 rounded-[18px] bg-[#FBFBFD] p-4">
        <p className="text-xs font-bold text-[#8A91A0]">추천 상황</p>
        <p className="mt-1 text-sm text-[#273044]">{template.recommendedFor}</p>
        <p className="mt-3 text-xs font-bold text-[#8A91A0]">출력 형식</p>
        <p className="mt-1 text-sm text-[#273044]">{template.output}</p>
      </div>
      <Button className="mt-5 w-full" variant={selected ? 'secondary' : 'primary'} onClick={onSelect}>
        사용하기
      </Button>
    </Card>
  );
}
