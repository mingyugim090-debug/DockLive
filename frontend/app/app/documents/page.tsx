'use client';

import { useEffect, useMemo, useState } from 'react';
import { DocumentTable } from '@/components/documents/DocumentTable';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import type { MockDocument } from '@/data/types';
import { loadAllDocuments } from '@/lib/workflow/workflowStore';

const filters = ['전체', '분석 완료', '처리 중', '오류', '최근 업로드'];

export default function DocumentsPage() {
  const [filter, setFilter] = useState('전체');
  const [query, setQuery] = useState('');
  const [sourceDocuments, setSourceDocuments] = useState<MockDocument[]>([]);

  useEffect(() => {
    setSourceDocuments(loadAllDocuments());
  }, []);

  const documents = useMemo(() => {
    return sourceDocuments.filter((doc) => {
      const matchesQuery = doc.name.toLowerCase().includes(query.toLowerCase()) || doc.category.includes(query);
      const matchesFilter =
        filter === '전체' ||
        doc.status === filter ||
        (filter === '최근 업로드' && ['2026.05.12', '2026.05.11', '2026.05.10'].includes(doc.createdAt));
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, sourceDocuments]);

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[#ECECF1] bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#273044]">작성한 공고문</h2>
            <p className="mt-2 text-sm leading-6 text-[#7B8190]">
              생성한 모집공고, 지원사업 공고, 행사 안내문을 확인하고 이어서 수정할 수 있습니다.
            </p>
          </div>
          <div className="w-full max-w-md">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공고문 이름 또는 유형 검색" />
          </div>
        </div>
        <div className="mt-5">
          <Tabs tabs={filters} active={filter} onChange={setFilter} />
        </div>
      </div>
      <DocumentTable documents={documents} />
    </div>
  );
}
