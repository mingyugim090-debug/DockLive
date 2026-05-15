'use client';

import { useEffect, useState } from 'react';
import { FileUploadBox } from '@/components/upload/FileUploadBox';
import { JobOptionSelector } from '@/components/upload/JobOptionSelector';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';

const stages = ['업로드 완료', '분석 중', '결과 생성 중', '완료'];

export default function UploadPage() {
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<string[]>(['문서 요약']);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          window.clearInterval(timer);
          setRunning(false);
          return 100;
        }
        return value + 10;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [running]);

  const currentStage = progress >= 100 ? 3 : progress >= 70 ? 2 : progress >= 35 ? 1 : fileName ? 0 : -1;

  return (
    <div className="space-y-6">
      <FileUploadBox fileName={fileName} onFile={(name) => { setFileName(name); setProgress(18); }} />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#273044]">업로드 후 실행할 작업</h2>
            <p className="mt-2 text-sm text-[#7B8190]">문서를 업로드하고 원하는 작업을 선택하세요.</p>
          </div>
          <Button disabled={!fileName || selected.length === 0 || running} onClick={() => { setProgress(22); setRunning(true); }}>
            AI Agent 실행
          </Button>
        </div>
        <div className="mt-5">
          <JobOptionSelector selected={selected} onChange={setSelected} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#273044]">처리 상태</h2>
            <p className="mt-2 text-sm text-[#7B8190]">{progress >= 100 ? '결과 생성이 완료되었습니다.' : '진행 상태가 mock으로 표시됩니다.'}</p>
          </div>
          <span className="text-sm font-bold text-[#5263E8]">{progress}%</span>
        </div>
        <div className="mt-5">
          <Progress value={progress} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {stages.map((stage, index) => (
            <div key={stage} className={['rounded-[20px] border p-4 text-sm font-semibold', index <= currentStage ? 'border-[#D8DDFC] bg-[#EEF2FF] text-[#5263E8]' : 'border-[#ECECF1] bg-[#FBFBFD] text-[#9AA1AD]'].join(' ')}>
              {stage}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
