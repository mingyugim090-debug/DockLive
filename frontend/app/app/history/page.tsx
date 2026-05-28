'use client';

import { useEffect, useState } from 'react';
import { HistoryTable } from '@/components/history/HistoryTable';
import { Card } from '@/components/ui/Card';
import type { MockJob } from '@/data/types';
import { loadAllHistory } from '@/lib/workflow/workflowStore';

export default function HistoryPage() {
  const [jobs, setJobs] = useState<MockJob[]>([]);

  useEffect(() => {
    setJobs(loadAllHistory());
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-[#273044]">Agent 작업 이력</h2>
        <p className="mt-2 text-sm text-[#7B8190]">공고 분석, 확인 질문, 초안 생성, export 작업을 확인합니다.</p>
      </Card>
      <HistoryTable jobs={jobs} />
    </div>
  );
}
