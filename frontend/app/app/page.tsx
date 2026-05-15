import Link from 'next/link';
import { RecentDocuments } from '@/components/dashboard/RecentDocuments';
import { RecentJobs } from '@/components/dashboard/RecentJobs';
import { StatCard } from '@/components/dashboard/StatCard';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mockDocuments } from '@/data/mockDocuments';
import { mockJobs } from '@/data/mockJobs';
import { mockTemplates } from '@/data/mockTemplates';

export default function DashboardPage() {
  const completed = mockDocuments.filter((doc) => doc.status === '분석 완료').length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 문서 수" value={`${mockDocuments.length}`} hint="업로드된 문서" />
        <StatCard label="이번 달 작업" value="24" hint="요약, 변환, 정리 포함" />
        <StatCard label="생성 결과물" value={`${completed + 4}`} hint="최근 완료된 결과" />
        <StatCard label="사용 가능 템플릿" value={`${mockTemplates.length}`} hint="문서 유형별 템플릿" />
      </section>

      <Card className="bg-[#EEF2FF]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#5263E8]">빠른 실행</p>
            <h2 className="mt-2 text-2xl font-bold text-[#273044]">문서를 업로드하고 원하는 작업을 선택하세요.</h2>
            <p className="mt-2 text-sm leading-6 text-[#6B7280]">요약, 회의록 변환, 보고서 초안, 서식 정리까지 한 화면에서 시작할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/app/upload">문서 업로드</ButtonLink>
            <ButtonLink href="/app/templates" variant="secondary">템플릿 선택</ButtonLink>
            <ButtonLink href={`/app/documents/${mockDocuments[0].id}`} variant="secondary">최근 문서 열기</ButtonLink>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <RecentDocuments documents={mockDocuments.slice(0, 4)} />
        <RecentJobs jobs={mockJobs.slice(0, 4)} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {['문서 업로드', '새 자동화 작업 시작', '템플릿 선택', '최근 문서 열기'].map((item, index) => (
          <Link key={item} href={index === 0 ? '/app/upload' : index === 2 ? '/app/templates' : '/app/documents'} className="rounded-[24px] border border-[#ECECF1] bg-white p-5 shadow-panel transition hover:-translate-y-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF] text-[#5263E8]">{index + 1}</span>
            <p className="mt-5 font-bold text-[#273044]">{item}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
