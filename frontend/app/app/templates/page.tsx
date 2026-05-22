import Link from 'next/link';
import { sampleTemplates } from '@/data/sampleTemplates';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">Workspace Templates</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">자주 쓰는 HWPX 템플릿</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
          업로드 기반 HWPX 자동작성 흐름과 별도로, 공고문 유형별 기본 템플릿을 Workspace 아래에서 관리합니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sampleTemplates.map((template) => (
          <article key={template.id} className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#3A7A68]">{template.category}</p>
                <h2 className="mt-2 text-lg font-extrabold text-[#24312D]">{template.name}</h2>
              </div>
              <span className="rounded-full bg-[#E7F1ED] px-3 py-1 text-xs font-bold text-[#245D50]">HWPX</span>
            </div>
            <p className="mt-3 min-h-[72px] text-sm leading-6 text-[#65736E]">{template.description}</p>
            <div className="mt-4 rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] p-3">
              <p className="text-xs font-bold text-[#65736E]">주요 입력 필드</p>
              <p className="mt-2 text-sm leading-6 text-[#24312D]">{template.editableFields.slice(0, 5).join(', ')}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/app?template=${template.id}`}
                className="inline-flex items-center justify-center rounded-full bg-[#245D50] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Workspace에서 시작
              </Link>
              <span className="inline-flex items-center justify-center rounded-full border border-[#DDE7E2] bg-white px-4 py-2 text-sm font-semibold text-[#65736E]">
                {template.fileName}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
