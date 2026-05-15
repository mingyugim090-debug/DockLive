import { Badge, statusTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { MockJob } from '@/data/types';

export function RecentJobs({ jobs }: { jobs: MockJob[] }) {
  return (
    <Card>
      <h2 className="text-lg font-bold text-[#273044]">최근 작업 이력</h2>
      <div className="mt-5 space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-[20px] border border-[#ECECF1] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#273044]">{job.name}</p>
                <p className="mt-1 text-sm text-[#7B8190]">{job.type} · {job.createdAt}</p>
              </div>
              <Badge tone={statusTone(job.status)}>{job.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
