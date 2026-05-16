import { Badge, statusTone } from '@/components/ui/Badge';
import type { MockJob } from '@/data/types';
import Link from 'next/link';

export function HistoryTable({ jobs }: { jobs: MockJob[] }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-[#ECECF1] bg-white shadow-panel">
      {jobs.map((job) => (
        <div key={job.id} className="grid gap-3 border-b border-[#F0F1F5] px-5 py-4 last:border-b-0 lg:grid-cols-[1.2fr_1.2fr_0.7fr_0.7fr_0.8fr_0.6fr] lg:items-center">
          <div>
            <p className="font-semibold text-[#273044]">{job.name}</p>
            <p className="mt-1 text-sm text-[#7B8190]">{job.createdAt}</p>
          </div>
          <p className="text-sm text-[#6B7280]">{job.documentName}</p>
          <p className="text-sm text-[#6B7280]">{job.type}</p>
          <Badge tone={statusTone(job.status)}>{job.status}</Badge>
          <p className="text-sm text-[#6B7280]">{job.duration}</p>
          {'resultId' in job ? (
            <Link href={`/app/documents/${job.resultId}`} className="text-left text-sm font-bold text-[#5263E8]">결과 보기</Link>
          ) : (
            <span className="text-left text-sm font-bold text-[#8A91A0]">샘플</span>
          )}
        </div>
      ))}
      {!jobs.length ? <p className="p-8 text-center text-sm text-[#7B8190]">아직 실행한 작업 이력이 없습니다.</p> : null}
    </div>
  );
}
