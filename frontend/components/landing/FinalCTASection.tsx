import { ButtonLink } from '@/components/ui/Button';

export function FinalCTASection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[36px] border border-[#ECECF1] bg-white p-10 text-center shadow-panel">
        <h2 className="text-3xl font-bold text-[#1F2937]">반복적인 문서 작업을 자동화하세요</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#6B7280]">DockLive에서 문서를 올리고, 필요한 작업을 선택하고, 정리된 결과물을 확인하세요.</p>
        <div className="mt-8">
          <ButtonLink href="/app">문서 자동화 시작하기</ButtonLink>
        </div>
      </div>
    </section>
  );
}
