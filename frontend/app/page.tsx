'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeDocument, analyzeText, analyzeUrl, checkHealth, getDemo } from '@/lib/api';
import { saveResult } from '@/lib/resultCache';
import { useAppStore } from '@/lib/store';
import type { CompanyProfile } from '@/lib/types';

type InputMode = 'file' | 'url' | 'text';

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

  const canAnalyze =
    (mode === 'file' && file) ||
    (mode === 'url' && url.trim().startsWith('http')) ||
    (mode === 'text' && announcementText.trim().length >= 100);

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
      const msg = err instanceof Error ? err.message : 'Demo 로딩에 실패했습니다.';
      setErrorMsg(msg);
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="border-b border-white/10 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">L</div>
            <span className="text-lg font-bold">LiveDock</span>
          </div>
          <span className="text-xs text-text3">문서 자동화 Agent MVP</span>
        </div>
      </header>

      {backendReady === false && (
        <div className="border-b border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-center text-xs text-yellow-100">
          백엔드 연결을 확인하는 중입니다. 배포 환경에서는 첫 요청이 느릴 수 있습니다.
        </div>
      )}

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 lg:grid-cols-[1.35fr_0.9fr]">
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-bold leading-tight">공고를 넣으면 제출 준비 흐름까지 이어갑니다</h1>
            <p className="mt-3 text-sm leading-relaxed text-text2">
              PDF, URL, 텍스트 공고문을 분석하고 필요한 입력을 받은 뒤 섹션별 초안을 생성합니다. 최종 제출 전에는 확인 단계를 반드시 거칩니다.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-card p-1">
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

          {mode === 'file' && (
            <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-card p-6 text-center hover:border-primary/60">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <span className="text-sm font-bold">{file ? file.name : 'PDF 공고문 선택'}</span>
              <span className="mt-2 text-xs text-text2">파일을 선택하면 Agent가 일정, 제출서류, 작성 항목을 추출합니다.</span>
            </label>
          )}

          {mode === 'url' && (
            <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-4">
              <span className="text-sm font-bold">공고 URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none placeholder:text-text3 focus:border-primary"
              />
            </label>
          )}

          {mode === 'text' && (
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-card p-4">
              <input
                value={textTitle}
                onChange={(event) => setTextTitle(event.target.value)}
                placeholder="공고 제목 또는 출처"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none placeholder:text-text3 focus:border-primary"
              />
              <textarea
                value={announcementText}
                onChange={(event) => setAnnouncementText(event.target.value)}
                placeholder="공고문 본문을 붙여 넣어 주세요."
                className="min-h-[220px] resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-text3 focus:border-primary"
              />
            </div>
          )}

          {errorMsg && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{errorMsg}</div>}

          <button
            onClick={runAnalysis}
            disabled={!canAnalyze || isAnalyzing}
            className="rounded-xl bg-primary py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text3"
          >
            {isAnalyzing ? '분석 중...' : 'Agent로 분석하고 워크플로우 만들기'}
          </button>

          <button
            onClick={handleDemo}
            disabled={isAnalyzing}
            className="rounded-xl border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary disabled:opacity-50"
          >
            샘플 데이터로 Agent 흐름 미리보기
          </button>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/10 bg-card p-4">
            <h2 className="text-sm font-bold">사용자/팀 프로필</h2>
            <p className="mt-1 text-xs leading-relaxed text-text2">입력하면 지원 적합성 판단과 초안 작성에 반영합니다.</p>
            <div className="mt-4 grid gap-3">
              {[
                ['name', '팀/회사명'],
                ['industry', '분야'],
                ['stage', '단계'],
                ['region', '지역'],
              ].map(([key, label]) => (
                <input
                  key={key}
                  value={String(company[key as keyof CompanyProfile] ?? '')}
                  onChange={(event) => setCompany((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder={label}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-text3 focus:border-primary"
                />
              ))}
              <textarea
                value={company.strengths}
                onChange={(event) => setCompany((prev) => ({ ...prev, strengths: event.target.value }))}
                placeholder="핵심 강점, 성과, 보유 역량"
                className="min-h-[80px] resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-text3 focus:border-primary"
              />
              <textarea
                value={company.needs}
                onChange={(event) => setCompany((prev) => ({ ...prev, needs: event.target.value }))}
                placeholder="필요한 지원금, 멘토링, 인프라"
                className="min-h-[70px] resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-text3 focus:border-primary"
              />
            </div>
          </div>

          {[
            ['1', '근거 기반 분석', '원문에 있는 사실과 불확실한 항목을 구분합니다.'],
            ['2', '필수 입력 수집', '초안에 필요한 사용자 정보를 먼저 확인합니다.'],
            ['3', '섹션별 라이브 초안', '문서를 한 번에 뭉개지 않고 섹션 단위로 확인합니다.'],
            ['4', '최종 export', 'HTML export를 기본 제공하고 HWPX toolchain 연동을 지원합니다.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="rounded-xl border border-white/10 bg-card p-4">
              <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{num}</div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text2">{desc}</p>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
