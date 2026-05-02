'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Timeline } from '@/components/timeline/Timeline';
import { Checklist } from '@/components/checklist/Checklist';
import { DocTemplate } from '@/components/document/DocTemplate';
import {
  confirmWorkflow,
  finalizeWorkflow,
  generateDraft,
  getResult,
  getWorkflow,
  reviseDraft,
  saveDraftFeedback,
  saveWorkflowInputs,
} from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { getDocTypeLabel } from '@/lib/utils';
import { loadResult, saveResult } from '@/lib/resultCache';
import type { AnalysisResult, DraftSection, UserInputField, WorkflowSession } from '@/lib/types';

const TABS = [
  { step: 1 as const, label: '일정' },
  { step: 2 as const, label: '제출 서류' },
  { step: 3 as const, label: '작성 항목' },
  { step: 4 as const, label: '초안 작성' },
  { step: 5 as const, label: '최종본' },
];

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-text font-bold text-base">{title}</h2>
      <p className="text-text2 text-xs mt-1">{desc}</p>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/7 bg-white/3 p-4">
      <h3 className="text-sm font-bold text-text mb-2">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-text2 leading-relaxed">
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InputField({
  field,
  value,
  onChange,
}: {
  field: UserInputField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-xl border border-white/7 bg-card p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-text">{field.label}</span>
        {field.required && <span className="text-xs font-semibold text-primary">필수</span>}
      </span>
      {field.description && <span className="text-xs leading-relaxed text-text2">{field.description}</span>}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder ?? ''}
        className="min-h-[88px] w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
      />
    </label>
  );
}

function DraftCard({
  draft,
  feedback,
  onFeedbackChange,
  onSaveFeedback,
  onRevise,
  busy,
}: {
  draft: DraftSection;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onSaveFeedback: () => void;
  onRevise: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/7 bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3">
        <h3 className="text-sm font-bold text-text">{draft.title}</h3>
        <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-text2">{draft.status}</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {draft.needs_confirmation.length > 0 && (
          <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-3">
            <p className="text-xs font-bold text-yellow-300">확인 필요</p>
            <ul className="mt-2 flex flex-col gap-1">
              {draft.needs_confirmation.map((item) => (
                <li key={item} className="text-xs leading-relaxed text-yellow-100/80">
                  - {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        <pre className="whitespace-pre-wrap rounded-lg bg-white/5 p-3 text-sm leading-relaxed text-text2">
          {draft.content_markdown || '아직 초안이 없습니다. 사용자 입력을 저장한 뒤 초안을 생성하세요.'}
        </pre>
        <textarea
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="수정 방향을 입력하세요. 예: 시장 규모 근거를 더 강조하고, 표현은 대학생 팀답게 자연스럽게 바꿔줘."
          className="min-h-[72px] w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSaveFeedback}
            disabled={busy}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text2 transition hover:border-white/20 hover:text-text disabled:opacity-50"
          >
            피드백 저장
          </button>
          <button
            onClick={onRevise}
            disabled={busy || !draft.content_markdown}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50"
          >
            피드백 반영
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { analysisResult, workflowSession, currentStep, setStep, setResult, setWorkflow } = useAppStore();
  const [result, setLocalResult] = useState<AnalysisResult | null>(analysisResult);
  const [workflow, setLocalWorkflow] = useState<WorkflowSession | null>(workflowSession);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [feedbackValues, setFeedbackValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!analysisResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStep(1);
  }, [id, setStep]);

  useEffect(() => {
    if (workflow) {
      setInputValues(Object.fromEntries(workflow.user_inputs.map((field) => [field.id, field.value])));
      setFeedbackValues(Object.fromEntries(workflow.draft_sections.map((draft) => [draft.section_id, draft.user_feedback])));
    }
  }, [workflow]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let nextResult = analysisResult?.id === id ? analysisResult : null;
        if (!nextResult) {
          nextResult = loadResult(id);
        }
        if (!nextResult) {
          const res = await getResult(id);
          nextResult = res.data;
          saveResult(res.data);
        }
        const workflowRes = await getWorkflow(id);
        if (cancelled) return;
        setLocalResult(nextResult);
        setResult(nextResult);
        setLocalWorkflow(workflowRes.data);
        setWorkflow(workflowRes.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '결과를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const activeAnalysis = workflow?.analysis ?? result;
  const requiredMissing = useMemo(() => {
    if (!workflow) return [];
    return workflow.user_inputs.filter((field) => field.required && !inputValues[field.id]?.trim());
  }, [workflow, inputValues]);

  const applyWorkflow = (next: WorkflowSession) => {
    setLocalWorkflow(next);
    setWorkflow(next);
    setLocalResult(next.analysis);
    setResult(next.analysis);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveInputs = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveWorkflowInputs(
        workflow.id,
        workflow.user_inputs.map((field) => ({ field_id: field.id, value: inputValues[field.id] ?? '' })),
      );
      applyWorkflow(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입력 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveWorkflowInputs(
        workflow.id,
        workflow.user_inputs.map((field) => ({ field_id: field.id, value: inputValues[field.id] ?? '' })),
      );
      applyWorkflow(saved.data);
      const drafted = await generateDraft(workflow.id);
      applyWorkflow(drafted.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '초안 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFeedback = async (sectionId: string) => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveDraftFeedback(workflow.id, sectionId, feedbackValues[sectionId] ?? '');
      applyWorkflow(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '피드백 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = async (sectionId: string) => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      await saveDraftFeedback(workflow.id, sectionId, feedbackValues[sectionId] ?? '');
      const res = await reviseDraft(workflow.id, sectionId);
      applyWorkflow(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '초안 재작성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const confirmed = await confirmWorkflow(workflow.id);
      applyWorkflow(confirmed.data);
      const finalized = await finalizeWorkflow(workflow.id);
      applyWorkflow(finalized.data);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : '최종 문서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyFinal = () => {
    const markdown = workflow?.final_document?.content_markdown;
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p>Agent 작업실을 불러오는 중입니다.</p>
        </div>
      </div>
    );
  }

  if (error && !activeAnalysis) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <p className="text-text font-bold text-lg">결과를 찾을 수 없습니다</p>
          <p className="text-text2 text-sm">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-6 py-3 rounded-xl text-white font-semibold text-sm bg-primary"
          >
            다시 분석하기
          </button>
        </div>
      </div>
    );
  }

  if (!activeAnalysis || !workflow) return null;

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <header className="sticky top-0 z-10 border-b border-white/7 bg-card/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => router.push('/')} className="text-text2 hover:text-text transition-colors text-sm">
              이전
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <p className="max-w-md truncate text-sm font-bold text-text">{activeAnalysis.title}</p>
              <p className="text-xs text-text2">
                {activeAnalysis.organization} · {getDocTypeLabel(activeAnalysis.doc_type)} · {workflow.status}
              </p>
            </div>
            <button onClick={handleCopyLink} className="text-text2 hover:text-primary transition-colors text-sm">
              {copied ? '복사됨' : '공유'}
            </button>
          </div>
        </div>
      </header>

      <div className="sticky top-[57px] z-10 border-b border-white/7 bg-bg">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.step}
                onClick={() => setStep(tab.step)}
                className={`min-w-[92px] flex-1 border-b-2 py-3 text-sm font-semibold transition-all ${
                  currentStep === tab.step
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text2 hover:text-text'
                }`}
              >
                {tab.step}. {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionTitle title="일정 분석" desc="공고문에서 추출한 주요 일정과 마감일입니다." />
              <Timeline items={activeAnalysis.timeline} />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div key="checklist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionTitle title="제출 서류 체크리스트" desc="공고문 기준 필수·선택 제출 서류입니다." />
              <Checklist items={activeAnalysis.checklist} />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <InfoList title="지원 자격" items={activeAnalysis.eligibility} />
                <InfoList title="혜택" items={activeAnalysis.benefits} />
                <InfoList title="평가 기준" items={activeAnalysis.evaluation_criteria} />
                <InfoList title="유의사항" items={activeAnalysis.cautions} />
              </div>
              {activeAnalysis.submission_method && (
                <div className="mt-3 rounded-xl border border-white/7 bg-white/3 p-4 text-sm text-text2">
                  <span className="font-bold text-text">제출 방법: </span>
                  {activeAnalysis.submission_method}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div key="template" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionTitle title="작성 항목" desc="Agent가 초안을 작성할 문서 섹션입니다." />
              <DocTemplate docType={activeAnalysis.doc_type} sections={activeAnalysis.document_template} />
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div key="draft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionTitle
                title="초안 작성 Agent"
                desc="필수 정보를 입력하면 섹션별 초안을 생성하고 피드백을 반영할 수 있습니다."
              />
              <div className="mb-5 flex flex-col gap-3">
                {workflow.user_inputs.map((field) => (
                  <InputField
                    key={field.id}
                    field={field}
                    value={inputValues[field.id] ?? ''}
                    onChange={(value) => setInputValues((prev) => ({ ...prev, [field.id]: value }))}
                  />
                ))}
              </div>
              {requiredMissing.length > 0 && (
                <div className="mb-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
                  필수 입력이 남아 있습니다: {requiredMissing.map((field) => field.label).join(', ')}
                </div>
              )}
              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  onClick={handleSaveInputs}
                  disabled={busy}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-text2 transition hover:border-white/20 hover:text-text disabled:opacity-50"
                >
                  입력 저장
                </button>
                <button
                  onClick={handleGenerateDraft}
                  disabled={busy}
                  className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50"
                >
                  {busy ? '처리 중...' : '초안 생성'}
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {workflow.draft_sections.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    feedback={feedbackValues[draft.section_id] ?? ''}
                    onFeedbackChange={(value) =>
                      setFeedbackValues((prev) => ({ ...prev, [draft.section_id]: value }))
                    }
                    onSaveFeedback={() => handleSaveFeedback(draft.section_id)}
                    onRevise={() => handleRevise(draft.section_id)}
                    busy={busy}
                  />
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleFinalize}
                  disabled={busy || workflow.draft_sections.every((draft) => !draft.content_markdown)}
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition disabled:opacity-50"
                >
                  초안 확인 후 최종 문서 생성
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div key="final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionTitle title="최종 Markdown 문서" desc="제출 전 사용자가 한 번 더 검토해야 하는 최종 초안입니다." />
              {!workflow.final_document ? (
                <div className="rounded-xl border border-white/7 bg-card p-6 text-center">
                  <p className="text-sm text-text2">아직 최종 문서가 없습니다.</p>
                  <button
                    onClick={handleFinalize}
                    disabled={busy}
                    className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    최종 문서 생성
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/7 bg-card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3">
                    <h3 className="text-sm font-bold text-text">{workflow.final_document.title}</h3>
                    <button
                      onClick={handleCopyFinal}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text2 hover:text-text"
                    >
                      {copied ? '복사됨' : 'Markdown 복사'}
                    </button>
                  </div>
                  <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap p-4 text-sm leading-relaxed text-text2">
                    {workflow.final_document.content_markdown}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-between border-t border-white/7 pt-4">
          <button
            onClick={() => currentStep > 1 && setStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5)}
            disabled={currentStep === 1}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-text2 transition hover:border-white/20 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
          >
            이전
          </button>
          <button
            onClick={() => currentStep < 5 && setStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5)}
            disabled={currentStep === 5}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            다음
          </button>
        </div>
      </div>
    </main>
  );
}
