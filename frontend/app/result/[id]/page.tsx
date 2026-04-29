'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Timeline } from '@/components/timeline/Timeline';
import { Checklist } from '@/components/checklist/Checklist';
import { DocTemplate } from '@/components/document/DocTemplate';
import { getResult } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { getDocTypeLabel } from '@/lib/utils';
import { loadResult, saveResult } from '@/lib/resultCache';
import type { AnalysisResult } from '@/lib/types';

const TABS = [
  { step: 1 as const, icon: '📅', label: '타임라인' },
  { step: 2 as const, icon: '✅', label: '체크리스트' },
  { step: 3 as const, icon: '📝', label: '문서 틀' },
];

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { analysisResult, currentStep, setStep, setResult } = useAppStore();
  const [result, setLocalResult] = useState<AnalysisResult | null>(analysisResult);
  const [loading, setLoading] = useState(!analysisResult);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 페이지 진입 시 탭을 항상 1번(타임라인)으로 초기화
  useEffect(() => {
    setStep(1);
  }, [id]);

  useEffect(() => {
    if (analysisResult?.id === id) {
      setLocalResult(analysisResult);
      return;
    }
    // Zustand 없으면 localStorage 먼저 확인 (서버 재시작 대비)
    const cached = loadResult(id);
    if (cached) {
      setLocalResult(cached);
      setResult(cached);
      setLoading(false);
      return;
    }
    // 쾐시 없으면 API 조회
    setLoading(true);
    getResult(id)
      .then((res) => {
        setLocalResult(res.data);
        setResult(res.data);
        saveResult(res.data); // localStorage 업데이트
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p>결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <p className="text-5xl">😢</p>
          <p className="text-text font-bold text-lg">결과를 찾을 수 없습니다</p>
          <p className="text-text2 text-sm">{error ?? '서버가 재시작되어 결과가 초기화되었을 수 있습니다.'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, #7C6FF7, #B89EFF)' }}
          >
            다시 분석하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-white/7 bg-card/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-text2 hover:text-text transition-colors text-sm flex items-center gap-1"
            >
              ← 홈
            </button>
            <div className="flex flex-col items-center min-w-0 flex-1">
              <p className="text-text font-bold text-sm truncate max-w-xs">{result.title}</p>
              <p className="text-text2 text-xs">{result.organization}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="text-text2 hover:text-primary transition-colors text-sm flex items-center gap-1 flex-shrink-0"
            >
              {copied ? '✅ 복사됨' : '🔗 공유'}
            </button>
          </div>
        </div>
      </header>

      {/* 탭 */}
      <div className="sticky top-[57px] z-10 bg-bg border-b border-white/7">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.step}
                onClick={() => setStep(tab.step)}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold
                  border-b-2 transition-all duration-200
                  ${currentStep === tab.step
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text2 hover:text-text'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-6">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-4">
                <h2 className="text-text font-bold text-base">📅 인터랙티브 타임라인</h2>
                <p className="text-text2 text-xs mt-1">공고문에서 추출한 모든 일정입니다</p>
              </div>
              <Timeline items={result.timeline} />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="checklist"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-4">
                <h2 className="text-text font-bold text-base">✅ 서류 준비 체크리스트</h2>
                <p className="text-text2 text-xs mt-1">클릭하여 준비 완료 처리할 수 있습니다</p>
              </div>
              <Checklist items={result.checklist} />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="document"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-4">
                <h2 className="text-text font-bold text-base">📝 제출 문서 틀</h2>
                <p className="text-text2 text-xs mt-1">공고 유형에 맞는 문서 구조입니다</p>
              </div>
              <DocTemplate
                docType={result.doc_type as import('@/lib/types').DocType}
                sections={result.document_template}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 단계 이동 버튼 */}
        <div className="flex justify-between mt-8 pt-4 border-t border-white/7">
          <button
            onClick={() => currentStep > 1 && setStep((currentStep - 1) as 1 | 2 | 3)}
            disabled={currentStep === 1}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-text2
              hover:border-white/20 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed
              transition-all"
          >
            ← 이전
          </button>
          <button
            onClick={() => currentStep < 3 && setStep((currentStep + 1) as 1 | 2 | 3)}
            disabled={currentStep === 3}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white
              disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{
              background: currentStep < 3 ? 'linear-gradient(135deg, #7C6FF7, #B89EFF)' : undefined,
            }}
          >
            다음 →
          </button>
        </div>
      </div>
    </main>
  );
}
