import Link from 'next/link';
import { noticeTemplates } from '@/data/mockTemplates';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <p className="text-sm font-bold text-[#3A7A68]">공고문 템플릿</p>
        <h2 className="mt-2 text-3xl font-bold text-[#24312D]">업무에 맞는 공고문 샘플을 선택하세요.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
          템플릿을 선택하면 필요한 정보 입력 단계로 바로 이어집니다. 각 템플릿은 제목, 주요 정보 표, 본문, 문의처, 붙임 영역을 갖춘 공고문 구조로 생성됩니다.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {noticeTemplates.map((template) => (
          <Card key={template.id} hover className="flex min-h-[340px] flex-col rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: template.accent }}>
                {template.purpose}
              </span>
              <span className="rounded-full bg-[#F3F7F5] px-3 py-1 text-xs font-bold text-[#65736E]">
                {template.inputCount}개 입력
              </span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-[#24312D]">{template.name}</h3>
            <p className="mt-2 text-sm leading-6 text-[#65736E]">{template.description}</p>
            <div className="mt-5 rounded-xl border border-[#E4EBE7] bg-[#FBFCFB] p-4">
              <p className="text-xs font-bold text-[#7B8782]">미리보기 구성</p>
              <ul className="mt-3 space-y-1 text-sm leading-6 text-[#34443F]">
                {template.previewSections.map((section) => <li key={section}>- {section}</li>)}
              </ul>
            </div>
            <div className="mt-auto flex gap-2 pt-5">
              <Link
                href={`/app?template=${template.id}`}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-[#DDE7E2] bg-white px-3 py-2.5 text-sm font-semibold text-[#34443F] transition hover:bg-[#F3F7F5]"
              >
                미리보기
              </Link>
              <ButtonLink href={`/app?template=${template.id}`} className="flex-1 px-3">
                이 템플릿으로 작성하기
              </ButtonLink>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
