'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadProgressProps {
  stage: 'uploading' | 'analyzing' | 'done' | null;
}

// 분석 중 단계별 메시지 (약 2초 간격)
const ANALYZING_MESSAGES = [
  { icon: '📄', text: 'PDF 텍스트를 추출하고 있어요...' },
  { icon: '🔍', text: '공고문 구조를 파악하고 있어요...' },
  { icon: '📅', text: '일정과 마감일을 찾고 있어요...' },
  { icon: '📋', text: '제출 서류 목록을 정리하고 있어요...' },
  { icon: '📝', text: '문서 구조를 설계하고 있어요...' },
  { icon: '✨', text: '마무리 작업 중이에요...' },
];

const STAGE_CONFIG = {
  uploading: { icon: '📤', label: 'PDF 업로드 중...' },
  analyzing: { icon: '🤖', label: 'AI 분석 중...' },
  done: { icon: '✅', label: '분석 완료!' },
};

export function UploadProgress({ stage }: UploadProgressProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // 분석 중 메시지 순환
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
  const currentMsg = ANALYZING_MESSAGES[msgIndex];
  // 대략 15초 기준 progress
  const analysisProgress = stage === 'analyzing' ? Math.min((elapsed / 18) * 100, 95) : stage === 'done' ? 100 : 0;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* 메인 아이콘 + 스피너 */}
      <div className="relative w-20 h-20">
        {stage !== 'done' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid transparent',
              borderTopColor: '#7C6FF7',
              borderRightColor: 'rgba(124,111,247,0.4)',
            }}
          />
        )}
        <motion.div
          key={stage}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-2 rounded-full flex items-center justify-center text-2xl"
          style={{ background: '#141420' }}
        >
          {config.icon}
        </motion.div>
      </div>

      {/* 분석 중 상세 메시지 */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-bold text-base"
          style={{ color: 'rgba(255,255,255,0.9)' }}
        >
          {config.label}
        </motion.p>

        {stage === 'analyzing' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg w-full justify-center"
              style={{ background: 'rgba(124,111,247,0.08)', border: '1px solid rgba(124,111,247,0.15)' }}
            >
              <span>{currentMsg.icon}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {currentMsg.text}
              </span>
            </motion.div>
          </AnimatePresence>
        )}

        {stage === 'done' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-semibold"
            style={{ color: '#4ADE80' }}
          >
            결과 페이지로 이동합니다...
          </motion.p>
        )}

        {stage === 'uploading' && (
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            파일을 서버로 전송하고 있어요
          </p>
        )}
      </div>

      {/* 분석 진행률 바 */}
      {stage === 'analyzing' && (
        <div className="w-full max-w-xs flex flex-col gap-1.5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #7C6FF7, #B89EFF)' }}
              animate={{ width: `${analysisProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Claude AI 분석 중 · 약 15~20초 소요
          </p>
        </div>
      )}

      {/* 단계 인디케이터 */}
      <div className="flex items-center gap-2">
        {(['uploading', 'analyzing', 'done'] as const).map((s, i, arr) => {
          const currentIdx = arr.indexOf(stage);
          const isDone = i <= currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full transition-all duration-500"
                style={{
                  background: isDone ? '#7C6FF7' : 'rgba(255,255,255,0.15)',
                  transform: i === currentIdx ? 'scale(1.3)' : 'scale(1)',
                }}
              />
              {i < arr.length - 1 && (
                <div
                  className="w-8 h-px transition-all duration-500"
                  style={{ background: isDone ? '#7C6FF7' : 'rgba(255,255,255,0.1)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
