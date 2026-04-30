'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DropZone } from '@/components/upload/DropZone';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { analyzeDocument, getDemo, checkHealth } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { saveResult } from '@/lib/resultCache';

const STEPS = [
  { icon: '📅', label: '인터랙티브 타임라인', desc: '마감일·일정을 D-Day 로드맵으로' },
  { icon: '✅', label: '서류 준비 체크리스트', desc: '필수·선택 서류 자동 정리' },
  { icon: '📝', label: '제출 문서 틀 생성', desc: '공고 유형별 문서 구조 제시' },
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
      if (!cancelled) {
        clearTimeout(slowTimer);
        setBackendReady(ok);
        if (!ok) {
          const retry = setInterval(() => {
            checkHealth().then((retryOk) => {
              if (retryOk && !cancelled) {
                setBackendReady(true);
                clearInterval(retry);
              }
            });
          }, 10000);
        }
      }
    });

    return () => { cancelled = true; };
  }, []);

  const handleFileAccepted = (f: File) => {
    setFile(f);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setErrorMsg(null);
    setStage('uploading');

    try {
      // 짧은 딜레이로 업로드 단계 표시
      await new Promise((r) => setTimeout(r, 600));
      setStage('analyzing');

      const res = await analyzeDocument(file);
      setStage('done');
      setResult(res.data);
      saveResult(res.data); // localStorage 캐시 저장

      await new Promise((r) => setTimeout(r, 500));
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
      saveResult(res.data); // localStorage 캐시 저장
      setStage('done');
      await new Promise((r) => setTimeout(r, 400));
      router.push(`/result/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo 로딩 실패';
      setErrorMsg(msg);
      setError(msg);
      setStage(null);
    }
  };

  const isLoading = stage !== null;

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-white/7 bg-card">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #7C6FF7, #B89EFF)' }}
            >
              L
            </div>
            <span className="text-text font-bold text-lg tracking-tight">LiveDock</span>
          </div>
          <span className="text-text3 text-xs">공고문 AI 분석</span>
        </div>
      </header>

      {/* 콜드스타트 배너 */}
      <AnimatePresence>
        {backendReady === false && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-center text-xs py-2 px-4"
            style={{ background: 'rgba(124,111,247,0.1)', color: 'rgba(184,158,255,0.9)', borderBottom: '1px solid rgba(124,111,247,0.15)' }}
          >
            🔄 서버를 깨우는 중입니다. 잠시 후 이용해주세요 (최대 1분 소요)
          </motion.div>
        )}
      </AnimatePresence>

      {/* 본문 */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 flex flex-col gap-10">

        {/* 히어로 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl font-bold text-text leading-tight">
            공고문을 <span style={{ color: '#B89EFF' }}>인터랙티브</span>하게
          </h1>
          <p className="text-text2 text-base leading-relaxed">
            PDF 공고문을 업로드하면 AI가 일정·서류·문서 구조를 자동으로 분석합니다.
          </p>
        </motion.div>

        {/* 업로드 영역 */}
        <AnimatePresence mode="wait">
          {!isLoading ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              <DropZone onFileAccepted={handleFileAccepted} isLoading={isLoading} />

              {/* 에러 메시지 */}
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
                >
                  ⚠️ {errorMsg}
                </motion.div>
              )}

              {/* 분석 버튼 */}
              <motion.button
                whileHover={{ scale: file ? 1.02 : 1 }}
                whileTap={{ scale: file ? 0.98 : 1 }}
                onClick={handleAnalyze}
                disabled={!file}
                id="btn-analyze"
                className="w-full py-4 rounded-xl font-bold text-base text-white transition-all duration-200"
                style={{
                  background: file
                    ? 'linear-gradient(135deg, #7C6FF7, #B89EFF)'
                    : 'rgba(255,255,255,0.05)',
                  color: file ? 'white' : 'rgba(255,255,255,0.25)',
                  boxShadow: file ? '0 8px 24px rgba(124,111,247,0.35)' : 'none',
                  cursor: file ? 'pointer' : 'not-allowed',
                }}
              >
                {file ? '🚀 AI로 분석하기' : 'PDF 파일을 먼저 선택하세요'}
              </motion.button>

              {/* 구분선 + Demo 버튼 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>또는</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>

              <motion.button
                id="btn-demo"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDemo}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                style={{
                  background: 'rgba(124,111,247,0.08)',
                  color: '#B89EFF',
                  border: '1px solid rgba(124,111,247,0.25)',
                }}
              >
                ✨ 샘플 데이터로 미리보기 (Demo)
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card rounded-2xl border border-white/7 p-6"
            >
              <UploadProgress stage={stage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3단계 미리보기 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-bold text-text2 uppercase tracking-wider">분석 결과 미리보기</h2>
          <div className="bg-card rounded-2xl border border-white/7 overflow-hidden">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i < STEPS.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(124,111,247,0.15)', color: '#B89EFF', border: '1px solid rgba(124,111,247,0.2)' }}
                >
                  {i + 1}
                </div>
                <div className="flex flex-col">
                  <span className="text-text text-sm font-semibold">{step.icon} {step.label}</span>
                  <span className="text-text2 text-xs">{step.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </main>
  );
}
