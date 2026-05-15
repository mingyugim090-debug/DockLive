import Link from 'next/link';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { MockDocument } from '@/data/types';

export function RecentDocuments({ documents }: { documents: MockDocument[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#273044]">최근 문서</h2>
        <Link href="/app/documents" className="text-sm font-semibold text-[#5263E8]">전체 보기</Link>
      </div>
      <div className="mt-5 space-y-3">
        {documents.map((doc) => (
          <Link key={doc.id} href={`/app/documents/${doc.id}`} className="flex flex-col gap-3 rounded-[20px] border border-[#ECECF1] p-4 transition hover:-translate-y-0.5 hover:bg-[#FBFBFD] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#273044]">{doc.name}</p>
              <p className="mt-1 text-sm text-[#7B8190]">{doc.type} · {doc.lastJob} · {doc.updatedAt}</p>
            </div>
            <Badge tone={statusTone(doc.status)}>{doc.status}</Badge>
          </Link>
        ))}
      </div>
    </Card>
  );
}
