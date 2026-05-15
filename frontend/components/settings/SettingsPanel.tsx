'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';

export function SettingsPanel() {
  const [format, setFormat] = useState('HWPX');
  const [summary, setSummary] = useState('보고서형 정리');

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="text-xl font-bold text-[#273044]">프로필 정보</h2>
        <div className="mt-5 grid gap-4">
          <Input defaultValue="DockLive 사용자" aria-label="이름" />
          <Input defaultValue="user@docklive.example" aria-label="이메일" />
          <Input defaultValue="문서 자동화 팀" aria-label="소속" />
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-[#273044]">기본 문서 설정</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[#6B7280]">
            기본 출력 형식
            <Select value={format} onChange={(event) => setFormat(event.target.value)} className="mt-2">
              {['PDF', 'DOCX', 'HWPX', 'Markdown'].map((item) => <option key={item}>{item}</option>)}
            </Select>
          </label>
          <label className="text-sm font-semibold text-[#6B7280]">
            AI 처리 옵션
            <Select value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-2">
              {['간결한 요약', '자세한 요약', '보고서형 정리'].map((item) => <option key={item}>{item}</option>)}
            </Select>
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-[#273044]">알림 설정</h2>
        <div className="mt-5 space-y-3">
          {['작업 완료 알림', '오류 발생 알림', '주간 작업 요약'].map((item) => (
            <label key={item} className="flex items-center justify-between rounded-[18px] bg-[#FBFBFD] p-4 text-sm font-semibold text-[#273044]">
              {item}
              <input type="checkbox" defaultChecked className="h-5 w-5 accent-[#6C7DFF]" />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-[#273044]">테마 설정</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {['밝은 기본', '라벤더', '미스트 그레이'].map((item, index) => (
            <button key={item} className={['rounded-[20px] border p-4 text-left text-sm font-bold', index === 0 ? 'border-[#B8C0FF] bg-[#EEF2FF] text-[#5263E8]' : 'border-[#ECECF1] bg-white text-[#6B7280]'].join(' ')}>
              {item}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
