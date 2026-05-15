import { HistoryTable } from '@/components/history/HistoryTable';
import { Card } from '@/components/ui/Card';
import { mockJobs } from '@/data/mockJobs';

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-[#273044]">AI Agent 작업 이력</h2>
        <p className="mt-2 text-sm text-[#7B8190]">요약, 변환, 템플릿 적용, 키워드 추출, 서식 정리 작업을 확인합니다.</p>
      </Card>
      <HistoryTable jobs={mockJobs} />
    </div>
  );
}
