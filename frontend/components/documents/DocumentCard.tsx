import Link from 'next/link';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { MockDocument } from '@/data/types';

export function DocumentCard({ document }: { document: MockDocument }) {
  return (
    <Card hover>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#7B8190]">{document.type} · {document.size}</p>
          <h3 className="mt-2 text-lg font-bold text-[#273044]">{document.name}</h3>
        </div>
        <Badge tone={statusTone(document.status)}>{document.status}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#7B8190]">{document.summary}</p>
      <Link href={`/app/documents/${document.id}`} className="mt-5 inline-flex text-sm font-bold text-[#5263E8]">문서 열기</Link>
    </Card>
  );
}
