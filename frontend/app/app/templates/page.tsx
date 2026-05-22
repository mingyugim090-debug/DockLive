import { GovernmentNoticeTemplateStudio } from '@/components/templates/GovernmentNoticeTemplateStudio';

export default function TemplatesPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#DDE4EA] bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#2563EB]">Templates</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-normal text-[#172033]">샘플 HWPX 기반 공고문 제작</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#64748B]">
              공공기관 담당자가 샘플 공고문 구조를 확인하고, 실제 요청사항을 입력해 HWPX 제출본을 준비하는 작업 화면입니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#475569]">
            {['샘플 선택', '구조 확인', '제작 입력'].map((step, index) => (
              <div key={step} className="rounded-md border border-[#E3E8EF] bg-[#F8FAFC] px-3 py-2">
                <span className="block text-[#2563EB]">{index + 1}</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>

      <GovernmentNoticeTemplateStudio />
    </div>
  );
}
