'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { analyzeDocument, analyzeText, analyzeUrl, checkHealth, getDemo } from '@/lib/api';
import { saveResult } from '@/lib/resultCache';
import { useAppStore } from '@/lib/store';
import type { CompanyProfile } from '@/lib/types';
import {
  Button,
  ErrorBanner,
  InfoCard,
  InputModeTabs,
  NoticeBanner,
  ProfileContextCard,
  SectionCard,
  StatusBadge,
  TextArea,
  TextInput,
  UploadDropzone,
  fadeUp,
  stagger,
  type InputMode,
} from '@/components/livedock/ui';

import { LandingHeader } from '@/components/livedock/landing/LandingHeader';
import { HeroSection } from '@/components/livedock/landing/HeroSection';
import { ProblemSection } from '@/components/livedock/landing/ProblemSection';
import { HowItWorks } from '@/components/livedock/landing/HowItWorks';
import { FeaturesSection } from '@/components/livedock/landing/FeaturesSection';
import { UseCasesSection } from '@/components/livedock/landing/UseCasesSection';
import { FAQSection } from '@/components/livedock/landing/FAQSection';
import { CTASection } from '@/components/livedock/landing/CTASection';
import { LandingFooter } from '@/components/livedock/landing/LandingFooter';

const EMPTY_COMPANY: CompanyProfile = {
  name: '',
  industry: '',
  stage: '',
  region: '',
  team_size: null,
  strengths: '',
  needs: '',
  previous_support: '',
};

const WORKFLOW_FEATURES = [
  {
    title: '근거 기반 분석',
    desc: '원문에서 일정, 자격, 제출서류, 평가 기준을 추출하고 중요한 사실에는 근거를 연결합니다.',
    badge: 'Evidence',
  },
  {
    title: '필수 입력만 질문',
    desc: '초안 작성에 꼭 필요한 사용자 정보만 먼저 수집해 문서 작성 부담을 줄입니다.',
    badge: 'Input',
  },
  {
    title: '섹션별 초안 생성',
    desc: '지원동기, 사업계획, 기대효과 같은 문서 섹션을 나누어 검토 가능한 초안으로 만듭니다.',
    badge: 'Draft',
  },
  {
    title: '확인 필요 주장 표시',
    desc: '사용자 확인 없이는 단정하기 어려운 성과, 수치, 자격 조건을 별도로 표시합니다.',
    badge: 'Review',
  },
  {
    title: 'HWPX/HTML export',
    desc: '최종 문서를 editable HTML로 확보하고, HWPX 또는 공식 양식 채우기 흐름으로 이어갑니다.',
    badge: 'Export',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { setResult, setError } = useAppStore();
  const [mode, setMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [company, setCompany] = useState<CompanyProfile>(EMPTY_COMPANY);
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    checkHealth().then(setBackendReady);
  }, []);

  const hasCompany = useMemo(
    () => Object.values(company).some((value) => value !== null && String(value).trim()),
    [company],
  );

  const canAnalyze = useMemo(() => {
    if (mode === 'file') return Boolean(file);
    if (mode === 'url') return url.trim().startsWith('http');
    return announcementText.trim().length >= 100;
  }, [announcementText, file, mode, url]);

  const readinessText = useMemo(() => {
    if (mode === 'file') {
      return file ? `${file.name} 분석 준비가 완료되었습니다.` : 'PDF 공고문을 업로드하면 분석을 시작할 수 있습니다.';
    }
    if (mode === 'url') {
      return url.trim().startsWith('http') ? 'URL 형식이 확인되었습니다.' : 'https://로 시작하는 공고 URL을 입력해 주세요.';
    }
    const count = announcementText.trim().length;
    return count >= 100
      ? `${count.toLocaleString()}자 본문을 분석할 수 있습니다.`
      : `본문을 100자 이상 입력해 주세요. 현재 ${count}자입니다.`;
  }, [announcementText, file, mode, url]);

  const runAnalysis = async () => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const profile = hasCompany ? company : undefined;
      const res =
        mode === 'file' && file
          ? await analyzeDocument(file, profile)
          : mode === 'url'
            ? await analyzeUrl(url.trim(), profile)
            : await analyzeText(announcementText.trim(), textTitle.trim(), profile);

      setResult(res.data);
      saveResult(res.data);
      router.push(`/result/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.';
      setErrorMsg(msg);
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDemo = async () => {
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await getDemo();
      setResult(res.data);
      saveResult(res.data);
      router.push(`/result/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '데모를 불러오지 못했습니다.';
      setErrorMsg(msg);
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const scrollToWorkspace = () => {
    document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Fixed header */}
      <LandingHeader onScrollToWorkspace={scrollToWorkspace} />

      {/* ── Landing page (light theme) ── */}
      <div className="bg-white">
        <HeroSection onStart={scrollToWorkspace} onDemo={handleDemo} isLoading={isAnalyzing} />
        <ProblemSection />
        <HowItWorks />
        <FeaturesSection />
        <UseCasesSection />
        <FAQSection />
        <CTASection onStart={scrollToWorkspace} />
      </div>

      {/* ── Workspace (dark theme) ── */}
      <div className="bg-bg text-text">
        {backendReady === false ? (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
            <NoticeBanner tone="warning">
              백엔드 연결을 확인하는 중입니다. 배포 환경에서는 첫 요청이 잠시 느릴 수 있습니다.
            </NoticeBanner>
          </div>
        ) : null}

        {/* Workspace heading */}
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <div className="mb-8 text-center">
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <StatusBadge label="Agent MVP" tone="info" />
              <StatusBadge label="PDF · URL · Text" tone="neutral" />
              <StatusBadge label="HWPX ready" tone="success" />
            </div>
            <h2 className="text-3xl font-semibold tracking-normal text-text">공고 분석 작업공간</h2>
            <p className="mt-3 text-text2">공고문을 업로드하고 AI Agent의 분석을 바로 시작하세요.</p>
          </div>
        </div>

        {/* Upload workspace */}
        <motion.section
          id="workspace"
          variants={stagger}
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: '-120px' }}
          className="mx-auto grid max-w-7xl scroll-mt-20 gap-6 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1.12fr_0.88fr]"
        >
          <SectionCard
            title="공고 입력 작업공간"
            eyebrow="Start"
            desc="공고를 넣으면 분석 결과와 문서 작성 워크플로가 생성됩니다. 입력 방식만 고르면 API 흐름은 동일하게 유지됩니다."
            action={
              <StatusBadge label={canAnalyze ? 'Ready' : 'Input needed'} tone={canAnalyze ? 'success' : 'warning'} />
            }
          >
            <div className="space-y-5">
              <InputModeTabs mode={mode} onChange={setMode} />

              {mode === 'file' ? (
                <UploadDropzone file={file} onFile={setFile} />
              ) : mode === 'url' ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <TextInput
                    label="공고 URL"
                    value={url}
                    onChange={setUrl}
                    placeholder="https://www.example.go.kr/notice/..."
                  />
                  <p className="mt-3 text-xs leading-5 text-text3">
                    원문 접근이 가능한 공개 URL을 입력해 주세요. PDF 링크와 공고 상세 페이지 모두 사용할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="grid gap-4">
                    <TextInput
                      label="공고 제목 또는 출처"
                      value={textTitle}
                      onChange={setTextTitle}
                      placeholder="예: 2026 청년창업 지원사업"
                    />
                    <TextArea
                      label="공고문 본문"
                      value={announcementText}
                      onChange={setAnnouncementText}
                      placeholder="공고문 내용을 붙여 넣어 주세요. 일정, 지원 자격, 제출 서류가 포함될수록 분석 품질이 좋아집니다."
                      minHeight="min-h-[260px]"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-bg/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">분석 준비 상태</p>
                  <p className="mt-1 text-xs leading-5 text-text3">{readinessText}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="secondary" onClick={handleDemo} disabled={isAnalyzing}>
                    샘플 실행
                  </Button>
                  <Button type="button" onClick={runAnalysis} disabled={!canAnalyze || isAnalyzing}>
                    {isAnalyzing ? '분석 중...' : 'Agent 분석 시작'}
                  </Button>
                </div>
              </div>

              {errorMsg ? <ErrorBanner>{errorMsg}</ErrorBanner> : null}
            </div>
          </SectionCard>

          <ProfileContextCard company={company} onChange={setCompany} />
        </motion.section>

        {/* Workflow explanation */}
        <motion.section
          id="workflow"
          variants={stagger}
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: '-120px' }}
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6"
        >
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Workflow</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-normal text-text">문서 제출까지 끊기지 않는 Agent 흐름</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-text2">
              분석, 입력, 초안, 최종 export를 한 화면의 작업 단계로 분리해 사용자가 확인해야 할 내용을 놓치지 않도록 정리했습니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {WORKFLOW_FEATURES.map((feature, index) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <InfoCard title={feature.title} tone={index === 4 ? 'success' : index === 3 ? 'warning' : 'info'}>
                  <div className="mt-3">
                    <StatusBadge label={feature.badge} tone={index === 4 ? 'success' : index === 3 ? 'warning' : 'info'} />
                    <p className="mt-4 text-sm leading-6 text-text2">{feature.desc}</p>
                  </div>
                </InfoCard>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Export options */}
        <section id="export" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mesh-bg rounded-lg border border-white/10 p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_0.7fr] md:items-center">
              <div>
                <StatusBadge label="Export" tone="success" />
                <h2 className="mt-4 text-2xl font-semibold tracking-normal text-text">최종 문서는 검토 가능한 형태로 남깁니다</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-text2">
                  HTML export는 즉시 편집 가능한 fallback으로, HWPX export는 한국 공공문서 제출 환경에 맞춘 최종 포맷으로 유지합니다.
                  공식 HWPX 양식이 있다면 템플릿 채우기 방식으로 이어갈 수 있습니다.
                </p>
                <div className="mt-5">
                  <Button type="button" onClick={() => router.push('/hwpx')}>
                    HWPX 자동 작성 MVP 열기
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['HTML', 'HWPX', 'Template'].map((item) => (
                  <div key={item} className="rounded-lg border border-white/10 bg-bg/45 px-3 py-4 text-center">
                    <p className="text-sm font-semibold text-text">{item}</p>
                    <p className="mt-1 text-[11px] text-text3">export</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <LandingFooter />
    </>
  );
}
