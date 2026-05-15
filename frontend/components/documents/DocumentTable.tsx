import Link from 'next/link';
import { Badge, statusTone } from '@/components/ui/Badge';
import type { MockDocument } from '@/data/types';

export function DocumentTable({ documents }: { documents: MockDocument[] }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-[#ECECF1] bg-white shadow-panel">
      <div className="hidden grid-cols-[1.6fr_0.7fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-4 border-b border-[#ECECF1] bg-[#FBFBFD] px-5 py-3 text-xs font-bold uppercase text-[#8A91A0] lg:grid">
        <span>문서 이름</span>
        <span>유형</span>
        <span>크기</span>
        <span>상태</span>
        <span>마지막 작업</span>
        <span>열기</span>
      </div>
      {documents.map((doc) => (
        <div key={doc.id} className="grid gap-3 border-b border-[#F0F1F5] px-5 py-4 last:border-b-0 lg:grid-cols-[1.6fr_0.7fr_0.8fr_0.9fr_0.9fr_0.7fr] lg:items-center">
          <div>
            <p className="font-semibold text-[#273044]">{doc.name}</p>
            <p className="mt-1 text-sm text-[#7B8190]">생성일 {doc.createdAt}</p>
          </div>
          <p className="text-sm text-[#6B7280]">{doc.type}</p>
          <p className="text-sm text-[#6B7280]">{doc.size}</p>
          <Badge tone={statusTone(doc.status)}>{doc.status}</Badge>
          <p className="text-sm text-[#6B7280]">{doc.lastJob}</p>
          <Link href={`/app/documents/${doc.id}`} className="text-sm font-bold text-[#5263E8]">열기</Link>
        </div>
      ))}
      {!documents.length ? <p className="p-8 text-center text-sm text-[#7B8190]">조건에 맞는 문서가 없습니다.</p> : null}
    </div>
  );
}
