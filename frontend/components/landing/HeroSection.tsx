import { ButtonLink } from '@/components/ui/Button';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <div className="inline-flex rounded-full border border-[#D8DDFC] bg-white/80 px-4 py-2 text-sm font-semibold text-[#5263E8] shadow-sm">
            문서 자동화 AI Agent
          </div>
          <h1 className="mt-7 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-[#1F2937] sm:text-5xl lg:text-6xl">
            DockLive
            <span className="mt-3 block text-3xl leading-tight sm:text-4xl lg:text-5xl">문서 업로드부터 자동 정리까지, AI Agent가 처리하는 문서 자동화 플랫폼</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6B7280]">
            보고서, 기획서, 회의록, 공문서, 과제 문서를 업로드하면 AI가 분석하고 정리하여 바로 활용 가능한 결과물로 변환합니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/app">서비스 시작하기</ButtonLink>
            <ButtonLink href="#features" variant="secondary">기능 살펴보기</ButtonLink>
          </div>
        </div>

        <div className="rounded-[32px] border border-[#ECECF1] bg-white/88 p-5 shadow-panel">
          <div className="rounded-[26px] bg-[#F6F8FB] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#273044]">문서 처리 보드</p>
                <p className="mt-1 text-xs text-[#7B8190]">최근 업로드한 문서 상태</p>
              </div>
              <span className="rounded-full bg-[#EDEFFF] px-3 py-1 text-xs font-semibold text-[#5263E8]">처리 완료</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['지원사업 안내.pdf', '요약과 제출 서류 추출 완료', '100%'],
                ['회의록 초안.docx', '회의록 템플릿 변환 중', '68%'],
                ['기획서_v2.hwpx', '문서 구조 정리 완료', '100%'],
              ].map(([name, desc, progress]) => (
                <div key={name} className="rounded-[22px] border border-[#ECECF1] bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#273044]">{name}</p>
                      <p className="mt-1 text-xs text-[#7B8190]">{desc}</p>
                    </div>
                    <span className="text-xs font-bold text-[#5263E8]">{progress}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDEFFF]">
                    <div className="h-full rounded-full gradient-primary" style={{ width: progress }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
