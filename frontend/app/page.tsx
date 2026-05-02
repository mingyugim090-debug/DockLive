'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DropZone } from '@/components/upload/DropZone';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { analyzeDocument, checkHealth, getDemo } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { saveResult } from '@/lib/resultCache';

const STEPS = [
  { label: '공고문 분석', desc: '일정, 자격, 제출 서류, 평가 기준을 구조화합니다.' },
  { label: '사용자 입력 수집', desc: '초안 작성에 필요한 팀 정보와 아이디어를 받습니다.' },
  { label: '초안 작성 Agent', desc: '섹션별 초안을 만들고 피드백을 반영합니다.' },
];

export default function HomePage() {
  const router = useRouter();
  const { setResult, setError } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<'uploading' | 'analyzing' | 'done' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);

  useEffect(() => {
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

  const handleAnalyze = async () => {
    if (!file) return;

    setErrorMsg(null);
    setStage('uploading');

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStage('analyzing');
      const res = await analyzeDocument(file);
      setStage('done');
      setResult(res.data);
      saveResult(res.data);
      await new Promise((resolve) => setTimeout(resolve, 400));
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
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              L
            </div>
            <span className="text-lg font-bold tracking-tight text-text">LiveDock</span>
          </div>
          <span className="text-xs text-text3">문서 자동화 Agent</span>
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
            백엔드 서버를 확인하는 중입니다. Render 무료 인스턴스는 잠시 시간이 걸릴 수 있습니다.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl font-bold leading-tight text-text">
            공고문을 올리면 Agent가 제출 초안까지 이어갑니다
          </h1>
          <p className="text-base leading-relaxed text-text2">
            PDF 공고문을 분석해 일정, 제출 서류, 작성 항목을 정리하고 사용자 입력을 받아 섹션별 초안을 생성합니다.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!isLoading ? (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <DropZone onFileAccepted={setFile} isLoading={isLoading} />

              {errorMsg && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file}
                className="w-full rounded-xl py-4 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-text3 bg-primary"
              >
                {file ? 'AI로 분석하기' : 'PDF 파일을 먼저 선택하세요'}
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
                샘플 데이터로 Agent 작업실 미리보기
              </button>
            </motion.div>
          ) : (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-white/7 bg-card p-6">
              <UploadProgress stage={stage} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-3 md:grid-cols-3">
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
      </div>
    </main>
  );
}
