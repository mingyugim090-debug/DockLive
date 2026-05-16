'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { MockTemplate } from '@/data/types';

export function TemplateCard({
  template,
  selected,
  onSelect,
  onStart,
}: {
  template: MockTemplate;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
}) {
  const handleStart = () => {
    onSelect();
    onStart();
  };

  return (
    <Card hover className={selected ? 'border-[#B8C0FF] bg-[#F8F7FF]' : ''}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#EEF2FF] text-[#5263E8]">◇</div>
        {selected ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#5263E8]">선택됨</span> : null}
      </div>
      <h3 className="mt-5 text-lg font-bold text-[#273044]">{template.name}</h3>
      <p className="mt-2 text-sm leading-6 text-[#7B8190]">{template.description}</p>
      <div className="mt-5 rounded-[18px] bg-[#FBFBFD] p-4">
        <p className="text-xs font-bold text-[#8A91A0]">추천 상황</p>
        <p className="mt-1 text-sm text-[#273044]">{template.recommendedFor}</p>
        <p className="mt-3 text-xs font-bold text-[#8A91A0]">출력 형식</p>
        <p className="mt-1 text-sm text-[#273044]">{template.output}</p>
        <p className="mt-3 text-xs font-bold text-[#8A91A0]">활용 결과</p>
        <p className="mt-1 text-sm leading-6 text-[#273044]">{template.sampleResult}</p>
      </div>
      <div className="mt-4 space-y-2">
        {template.workflow.slice(0, 3).map((step, index) => (
          <div key={step} className="flex items-center gap-2 text-xs text-[#7B8190]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF2FF] text-[10px] font-bold text-[#5263E8]">{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      <Button className="mt-5 w-full" variant={selected ? 'secondary' : 'primary'} onClick={handleStart}>
        {selected ? '설정 패널로 이동' : '선택하고 설정하기'}
      </Button>
    </Card>
  );
}
