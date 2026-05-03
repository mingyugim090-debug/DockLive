'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DropZone } from '@/components/upload/DropZone';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { analyzeDocument, analyzeText, analyzeUrl, checkHealth, getDemo } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { saveResult } from '@/lib/resultCache';
import type { CompanyProfile } from '@/lib/types';

type InputMode = 'file' | 'url' | 'text';

const STEPS = [
  { label: '공고 검토', desc: 'PDF, URL, 붙여넣은 공고문에서 일정과 제출 요건을 추출합니다.' },
  { label: '회사 DB 매칭', desc: '회사/팀 정보를 바탕으로 지원 적합도와 누락 정보를 확인합니다.' },
  { label: '사업계획서 작성', desc: '필수 입력을 받아 섹션별 초안과 최종 제출 문서를 만듭니다.' },
];

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

export default function HomePage() {
  const router = useRouter();
  const { setResult, setError } = useAppStore();
  const [mode, setMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [company, setCompany] = useState<CompanyProfile>(EMPTY_COMPANY);
  const [stage, setStage] = useState<'uploading' | 'analyzing' | 'done' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });

    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setBackendReady(false);
    }, 2000);

    checkHealth().then((ok) => {
      if (cancelled) return;
      clearTimeout(slowTimer);
      setBackendReady(ok);
    });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  const hasCompany = useMemo(
    () => Object.values(company).some((value) => value !== null && String(value).trim()),
    [company],
  );

  const canAnalyze =
    (mode === 'file' && file) ||
    (mode === 'url' && url.trim().startsWith('http')) ||
    (mode === 'text' && announcementText.trim().length >= 100);

  const runAnalysis = async () => {
    if (!canAnalyze) return;

    setErrorMsg(null);
    setStage(mode === 'file' ? 'uploading' : 'analyzing');

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStage('analyzing');
      const profile = hasCompany ? company : undefined;
      const res =
        mode === 'file' && file
          ? await analyzeDocument(file, profile)
          : mode === 'url'
            ? await analyzeUrl(url.trim(), profile)
            : await analyzeText(announcementText.trim(), textTitle.trim(), profile);

      setStage('done');
      setResult(res.data);
      saveResult(res.data);
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push(`/result/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.';
      setErrorMsg(msg);
      setError(msg);
      setStage(null);
    }
  };

  const handleDemo = async () => {
    setErrorMsg(null);
    setStage('analyzing');
    try {
      const res = await getDemo();
      setResult(res.data);
      saveResult(res.data);
      setStage('done');
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push(`/result/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo 로딩에 실패했습니다.';
      setErrorMsg(msg);
      setError(msg);
      setStage(null);
    }
  };

  const isLoading = stage !== null;

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-white/7 bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              L
            </div>
            <span className="text-lg font-bold tracking-tight text-text">LiveDock</span>
          </div>
          <span className="text-xs text-text3">지원사업 자동화 Agent</span>
        </div>
      </header>

      <AnimatePresence>
        {backendReady === false && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-primary/30 bg-primary/10 px-4 py-2 text-center text-xs text-primary"
          >
            백엔드 서버를 확인하는 중입니다. 무료 인스턴스는 첫 요청에 시간이 걸릴 수 있습니다.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 px-5 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.4fr_0.9fr] lg:gap-8">
        <section className="flex flex-col gap-5">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold leading-tight text-text">
              공고를 넣으면 지원 검토부터 사업계획서 초안까지 이어갑니다
            </h1>
            <p className="text-base leading-relaxed text-text2">
              지원사업 URL, PDF, 본문 텍스트를 분석하고 회사 정보와 매칭해 제출 서류와 작성 항목을 정리합니다.
            </p>
          </motion.div>

          {!isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/7 bg-card p-1">
                {[
                  ['file', 'PDF'],
                  ['url', 'URL'],
                  ['text', '텍스트'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key as InputMode)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      mode === key ? 'bg-primary text-white' : 'text-text2 hover:bg-white/5 hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'file' && <DropZone onFileAccepted={setFile} isLoading={isLoading} />}

              {mode === 'url' && (
                <label className="flex flex-col gap-2 rounded-xl border border-white/7 bg-card p-4">
                  <span className="text-sm font-bold text-text">지원사업 공고 URL</span>
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://..."
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
                  />
                </label>
              )}

              {mode === 'text' && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/7 bg-card p-4">
                  <input
                    value={textTitle}
                    onChange={(event) => setTextTitle(event.target.value)}
                    placeholder="공고 제목 또는 출처"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
                  />
                  <textarea
                    value={announcementText}
                    onChange={(event) => setAnnouncementText(event.target.value)}
                    placeholder="공고문 본문을 붙여넣어 주세요."
                    className="min-h-[220px] resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm leading-relaxed text-text outline-none placeholder:text-text3 focus:border-primary"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={runAnalysis}
                disabled={!canAnalyze}
                className="w-full rounded-xl bg-primary py-4 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-text3"
              >
                AI로 분석하고 매칭하기
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/7" />
                <span className="text-xs text-text3">또는</span>
                <div className="h-px flex-1 bg-white/7" />
              </div>

              <button
                onClick={handleDemo}
                className="w-full rounded-xl border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
              >
                샘플 데이터로 Agent 작업 미리보기
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/7 bg-card p-6">
              <UploadProgress stage={stage} />
            </motion.div>
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="rounded-xl border border-white/7 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-text">회사 DB 프로필</h2>
              <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-semibold text-text3">선택 입력</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-text2">
              실제 DB 연동 전 단계로, 입력한 회사 정보를 적합도 판단과 초안 작성에 바로 반영합니다.
            </p>
            <div className="mt-4 grid gap-3">
              {[
                ['name', '회사/팀명'],
                ['industry', '업종'],
                ['stage', '성장 단계'],
                ['region', '지역'],
              ].map(([key, label]) => (
                <input
                  key={key}
                  value={String(company[key as keyof CompanyProfile] ?? '')}
                  onChange={(event) => setCompany((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder={label}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
                />
              ))}
              <textarea
                value={company.strengths}
                onChange={(event) => setCompany((prev) => ({ ...prev, strengths: event.target.value }))}
                placeholder="핵심 강점, 성과, 보유 역량"
                className="min-h-[80px] resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
              />
              <textarea
                value={company.needs}
                onChange={(event) => setCompany((prev) => ({ ...prev, needs: event.target.value }))}
                placeholder="필요한 지원금, 멘토링, 인프라, 판로 등"
                className="min-h-[70px] resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {STEPS.map((step, index) => (
              <div key={step.label} className="rounded-xl border border-white/7 bg-card p-4">
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </div>
                <h2 className="text-sm font-bold text-text">{step.label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-text2">{step.desc}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
