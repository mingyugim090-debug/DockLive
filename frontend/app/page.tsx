import { FeatureSection } from '@/components/landing/FeatureSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';
import { HeroSection } from '@/components/landing/HeroSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { SolutionSection } from '@/components/landing/SolutionSection';
import { WorkflowSection } from '@/components/landing/WorkflowSection';
import { ButtonLink } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <main className="min-h-screen text-[#273044]">
      <header className="sticky top-0 z-40 border-b border-[#ECECF1]/80 bg-[#FAFAF7]/84 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] font-bold text-[#5263E8]">D</span>
            <span className="text-base font-bold text-[#273044]">DockLive</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#6B7280] md:flex">
            <a href="#features" className="hover:text-[#273044]">기능</a>
            <a href="#workflow" className="hover:text-[#273044]">사용 흐름</a>
            <a href="/app" className="hover:text-[#273044]">대시보드</a>
          </nav>
          <ButtonLink href="/app" className="px-4 py-2">서비스 시작하기</ButtonLink>
        </div>
      </header>

      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeatureSection />
      <div id="workflow">
        <WorkflowSection />
      </div>
      <FinalCTASection />
    </main>
  );
}
