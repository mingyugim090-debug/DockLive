'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadProgressProps {
  stage: 'uploading' | 'analyzing' | 'done' | null;
}

const ANALYZING_MESSAGES = [
  'PDF 텍스트를 추출하고 있습니다.',
  '공고문의 일정과 제출 서류를 찾고 있습니다.',
  '지원 자격과 평가 기준을 정리하고 있습니다.',
  '문서 작성 항목을 설계하고 있습니다.',
  'Agent 작업실을 준비하고 있습니다.',
];

const STAGE_CONFIG = {
  uploading: { label: 'PDF 업로드 중' },
  analyzing: { label: 'AI 분석 중' },
  done: { label: '분석 완료' },
};

export function UploadProgress({ stage }: UploadProgressProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stage !== 'analyzing') {
      setMsgIndex(0);
      setElapsed(0);
      return;
    }
    const msgTimer = setInterval(() => {
      setMsgIndex((prev) => Math.min(prev + 1, ANALYZING_MESSAGES.length - 1));
    }, 2500);
    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      clearInterval(msgTimer);
      clearInterval(elapsedTimer);
    };
  }, [stage]);

  if (!stage) return null;

  const config = STAGE_CONFIG[stage];
  const progress = stage === 'analyzing' ? Math.min((elapsed / 12) * 100, 95) : stage === 'done' ? 100 : 18;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative h-20 w-20">
        {stage !== 'done' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{ borderTopColor: '#7C6FF7', borderRightColor: 'rgba(124,111,247,0.4)' }}
          />
        )}
        <div className="absolute inset-2 flex items-center justify-center rounded-full bg-card text-sm font-bold text-primary">
          AI
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <p className="text-base font-bold text-text">{config.label}</p>
        {stage === 'analyzing' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-xs text-text2"
            >
              {ANALYZING_MESSAGES[msgIndex]}
            </motion.div>
          </AnimatePresence>
        )}
        {stage === 'done' && <p className="text-sm font-semibold text-green-400">결과 페이지로 이동합니다.</p>}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #7C6FF7, #B89EFF)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-center text-[10px] text-text3">보통 10~20초 정도 걸립니다.</p>
      </div>
    </div>
  );
}
