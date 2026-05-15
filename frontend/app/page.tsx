'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { analyzeDocument, analyzeText, analyzeUrl, checkHealth, getDemo } from '@/lib/api';
import { saveResult } from '@/lib/resultCache';
import { useAppStore } from '@/lib/store';
import type { CompanyProfile } from '@/lib/types';
import {
  AppHeader,
  Button,
  ErrorBanner,
  InputModeTabs,
  NoticeBanner,
  ProfileContextCard,
  SectionCard,
  StatusBadge,
  TextArea,
  TextInput,
  UploadDropzone,
  stagger,
  type InputMode,
} from '@/components/livedock/ui';
import { ProblemSection } from '@/components/livedock/landing/ProblemSection';
import { HowItWorks } from '@/components/livedock/landing/HowItWorks';
import { FeaturesSection } from '@/components/livedock/landing/FeaturesSection';
import { FAQSection } from '@/components/livedock/landing/FAQSection';

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
    desc: '일정, 자격, 제출서류, 평가 기준을 원문 근거와 함께 추출합니다.',
    badge: 'Evidence',
  },
  {
    title: '필수 입력만 질문',
    desc: '초안 작성에 꼭 필요한 사용자 정보만 단계적으로 묻습니다.',
    badge: 'Input',
  },
  {
    title: '섹션별 초안 생성',
    desc: '지원동기, 사업계획, 기대효과 같은 항목을 나눠서 검토 가능한 초안으로 만듭니다.',
    badge: 'Draft',
  },
  {
    title: '확인 게이트',
    desc: '사용자 확인이 필요한 주장과 수치를 체크해야 최종 문서로 넘어갑니다.',
    badge: 'Review',
  },
  {
    title: 'HWPX export',
    desc: '최종 문서를 HWPX/HTML로 내보내고, 공식 HWPX 양식 채우기 경로를 제공합니다.',
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
      return file
        ? `${file.name} 분석 준비가 완료되었습니다.`
        : 'PDF, HWPX, HWP 공고문 또는 양식을 업로드하면 분석을 시작할 수 있습니다.';
    }
    if (mode === 'url') {
      return url.trim().startsWith('http') ? 'URL 형식을 확인했습니다.' : 'https://로 시작하는 공고 URL을 입력해 주세요.';
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

  return (
    <main className="min-h-screen bg-bg text-text">
      <AppHeader
        title="Agent MVP"
        subtitle="공고 분석부터 HWPX 제출 문서까지"
        navItems={[
          { label: '입력', href: '#workspace' },
          { label: '흐름', href: '#workflow' },
          { label: 'FAQ', href: '#faq' },
        ]}
        right={
          <Button type="button" variant="secondary" onClick={() => router.push('/hwpx')}>
            HWPX 자동 작성
          </Button>
        }
      />

      <section id="workspace" className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_50%_0%,rgba(124,140,255,0.12),transparent_42%)]">
        <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Agent MVP" tone="info" />
                <StatusBadge label="PDF · HWPX · HWP" tone="success" />
                <StatusBadge label="확인 게이트" tone="warning" />
              </div>
              <div>
                <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-text sm:text-4xl">
                  공고문을 넣으면 제출 문서 초안까지 이어지는 작업공간
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-text3">
                  공모전, 정부지원사업, 장학금, 연구과제 공고를 분석하고 부족한 정보만 질문한 뒤 섹션별 초안과 최종 HWPX export로 이어갑니다.
                </p>
              </div>
            </div>

            {backendReady === false ? (
              <NoticeBanner tone="warning">
                백엔드 연결을 확인하는 중입니다. 배포 환경에서는 첫 요청이 잠시 느릴 수 있습니다.
              </NoticeBanner>
            ) : null}

            {errorMsg ? <ErrorBanner>{errorMsg}</ErrorBanner> : null}

            <SectionCard
              title="공고 입력"
              eyebrow="Start"
              desc="파일, URL, 텍스트 중 하나로 공고를 입력하세요. HWP 파일은 HWPX로 변환한 뒤 분석합니다."
              action={<StatusBadge label={canAnalyze ? 'Ready' : '입력 필요'} tone={canAnalyze ? 'success' : 'warning'} />}
            >
              <div className="space-y-4">
                <InputModeTabs mode={mode} onChange={setMode} />

                {mode === 'file' ? (
                  <UploadDropzone file={file} onFile={setFile} />
                ) : mode === 'url' ? (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <TextInput label="공고 URL" value={url} onChange={setUrl} placeholder="https://example.go.kr/notice/..." />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="grid gap-4">
                      <TextInput label="문서 제목" value={textTitle} onChange={setTextTitle} placeholder="예: 2026 청년 창업 지원사업 모집공고" />
                      <TextArea
                        label="공고 본문"
                        value={announcementText}
                        onChange={setAnnouncementText}
                        placeholder="공고문 본문을 붙여넣어 주세요."
                        minHeight="min-h-[220px]"
                      />
                    </div>
                  </div>
                )}

                <NoticeBanner tone={canAnalyze ? 'success' : 'info'}>{readinessText}</NoticeBanner>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="secondary" onClick={handleDemo} disabled={isAnalyzing}>
                    데모 실행
                  </Button>
                  <Button type="button" onClick={runAnalysis} disabled={!canAnalyze || isAnalyzing} loading={isAnalyzing}>
                    분석 시작
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5">
            <ProfileContextCard company={company} onChange={setCompany} />
            <SectionCard title="MVP 작업 흐름" eyebrow="Workflow" desc="커뮤니티 기능보다 제출 문서 자동화에 집중합니다.">
              <div className="grid gap-3">
                {WORKFLOW_FEATURES.map((feature) => (
                  <div key={feature.title} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text">{feature.title}</p>
                      <StatusBadge label={feature.badge} tone="neutral" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-text3">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </motion.div>
      </section>

      <section id="workflow" className="bg-white text-slate-950">
        <ProblemSection />
        <HowItWorks />
        <FeaturesSection />
      </section>

      <section id="faq" className="bg-white text-slate-950">
        <FAQSection />
      </section>
    </main>
  );
}
