'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  confirmWorkflow,
  createDraftStream,
  exportWorkflowHtml,
  exportWorkflowHwpx,
  finalizeWorkflow,
  generateDraft,
  getResult,
  getWorkflow,
  reviseDraft,
  saveDraftFeedback,
  saveWorkflowInputs,
} from '@/lib/api';
import { loadResult, saveResult } from '@/lib/resultCache';
import { useAppStore } from '@/lib/store';
import type { AnalysisResult, DraftSection, DraftStreamEvent, UserInputField, WorkflowSession } from '@/lib/types';

const TABS = [
  { step: 1 as const, label: '분석' },
  { step: 2 as const, label: '입력' },
  { step: 3 as const, label: '초안' },
  { step: 4 as const, label: '최종' },
];

const STATUS_LABEL: Record<DraftSection['status'], string> = {
  empty: '대기',
  needs_input: '입력 필요',
  drafted: '초안 완료',
  revised: '수정됨',
  confirmed: '확인 완료',
};

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-text">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-text2">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="text-xs leading-relaxed text-text2">
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InputField({ field, value, onChange }: { field: UserInputField; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-text">{field.label}</span>
        {field.required && <span className="text-xs font-semibold text-primary">필수</span>}
      </span>
      {field.description && <span className="text-xs leading-relaxed text-text2">{field.description}</span>}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder ?? ''}
        className="min-h-[86px] resize-y rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
      />
    </label>
  );
}

function DraftCard({
  draft,
  feedback,
  streamState,
  onFeedbackChange,
  onSaveFeedback,
  onRevise,
  busy,
}: {
  draft: DraftSection;
  feedback: string;
  streamState?: string;
  onFeedbackChange: (value: string) => void;
  onSaveFeedback: () => void;
  onRevise: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-bold text-text">{draft.title}</h3>
        <span className="rounded-md bg-bg px-2 py-1 text-xs text-text2">{streamState ?? STATUS_LABEL[draft.status]}</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {draft.confirmation_required.length > 0 && (
          <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs text-yellow-100">
            <p className="font-bold">제출 전 확인 필요</p>
            <ul className="mt-2 flex flex-col gap-1">
              {draft.confirmation_required.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        )}
        <pre className="whitespace-pre-wrap rounded-lg bg-bg p-3 text-sm leading-relaxed text-text2">
          {draft.content_markdown || '아직 초안이 없습니다. 필수 정보를 입력한 뒤 초안을 생성하세요.'}
        </pre>
        <textarea
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="수정 방향을 입력하세요."
          className="min-h-[70px] resize-y rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-text3 focus:border-primary"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={onSaveFeedback} disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text2 hover:text-text disabled:opacity-50">
            피드백 저장
          </button>
          <button onClick={onRevise} disabled={busy || !draft.content_markdown} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
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
  const [streamStates, setStreamStates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!analysisResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setStep(1);
    return () => {
      streamRef.current?.close();
    };
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
        if (!nextResult) nextResult = loadResult(id);
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
  }, [analysisResult, id, setResult, setWorkflow]);

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

  const handleSaveInputs = async () => {
    if (!workflow) return null;
    setBusy(true);
    setError(null);
    try {
      const res = await saveWorkflowInputs(
        workflow.id,
        workflow.user_inputs.map((field) => ({ field_id: field.id, value: inputValues[field.id] ?? '' })),
      );
      applyWorkflow(res.data);
      setNotice('입력을 저장했습니다.');
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '입력 저장에 실패했습니다.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const mergeDraftEvent = (event: DraftStreamEvent) => {
    if (event.type === 'section_start') {
      setNotice(event.content || '초안 생성을 시작합니다.');
      setStreamStates((prev) => {
        const next = { ...prev };
        workflow?.draft_sections.forEach((draft) => {
          next[draft.section_id] = '생성 대기';
        });
        return next;
      });
      return;
    }
    if (event.type === 'section_done' && event.draft_section) {
      setStreamStates((prev) => ({ ...prev, [event.draft_section!.section_id]: '완료' }));
      setLocalWorkflow((prev) => {
        if (!prev) return prev;
        const draftSections = prev.draft_sections.map((draft) =>
          draft.section_id === event.draft_section?.section_id ? event.draft_section : draft,
        );
        const next = { ...prev, draft_sections: draftSections, status: 'reviewing' as const };
        setWorkflow(next);
        return next;
      });
      return;
    }
    if (event.type === 'workflow_done') {
      setNotice(event.content || '초안 생성이 완료되었습니다.');
      setBusy(false);
      setStep(3);
      streamRef.current?.close();
      return;
    }
    if (event.type === 'error') {
      setError(event.content || '초안 생성 중 오류가 발생했습니다.');
      setBusy(false);
      streamRef.current?.close();
    }
  };

  const handleGenerateDraft = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setStreamStates({});
    streamRef.current?.close();

    const savedWorkflow = await handleSaveInputs();
    if (!savedWorkflow) {
      setBusy(false);
      return;
    }

    let completed = false;
    try {
      const source = createDraftStream(savedWorkflow.id, (event) => {
        if (event.type === 'workflow_done') completed = true;
        mergeDraftEvent(event);
      });
      streamRef.current = source;
      source.onerror = async () => {
        source.close();
        if (completed) return;
        setNotice('라이브 스트리밍 연결이 끊겨 일괄 생성으로 다시 시도합니다.');
        try {
          const drafted = await generateDraft(savedWorkflow.id);
          applyWorkflow(drafted.data);
          setStep(3);
        } catch (err) {
          setError(err instanceof Error ? err.message : '초안 생성에 실패했습니다.');
        } finally {
          setBusy(false);
        }
      };
    } catch (err) {
      try {
        const drafted = await generateDraft(savedWorkflow.id);
        applyWorkflow(drafted.data);
        setStep(3);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : err instanceof Error ? err.message : '초안 생성에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    }
  };

  const handleSaveFeedback = async (sectionId: string) => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const res = await saveDraftFeedback(workflow.id, sectionId, feedbackValues[sectionId] ?? '');
      applyWorkflow(res.data);
      setNotice('피드백을 저장했습니다.');
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
      setError(err instanceof Error ? err.message : '초안 수정에 실패했습니다.');
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
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : '최종 문서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const downloadExport = (filename: string, contentType: string, content: string, encoding: 'text' | 'base64') => {
    const payload =
      encoding === 'base64'
        ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
        : content;
    const blob = new Blob([payload], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleExportHtml = async () => {
    if (!workflow) return;
    const exported = await exportWorkflowHtml(workflow.id);
    downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
  };

  const handleExportHwpx = async () => {
    if (!workflow) return;
    setError(null);
    try {
      const exported = await exportWorkflowHwpx(workflow.id);
      downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX export에는 서버 toolchain 설정이 필요합니다. HTML export를 먼저 사용할 수 있습니다.');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text2">Agent 작업을 불러오는 중입니다.</div>;
  }

  if (error && !activeAnalysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center">
        <div>
          <p className="text-lg font-bold text-text">결과를 찾을 수 없습니다</p>
          <p className="mt-2 text-sm text-text2">{error}</p>
          <button onClick={() => router.push('/')} className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
            다시 분석하기
          </button>
        </div>
      </div>
    );
  }

  if (!activeAnalysis || !workflow) return null;

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <button onClick={() => router.push('/')} className="text-sm text-text2 hover:text-text">이전</button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-bold">{activeAnalysis.title}</p>
            <p className="text-xs text-text2">{activeAnalysis.organization} · {workflow.status}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="text-sm text-text2 hover:text-primary">
            공유
          </button>
        </div>
      </header>

      <div className="sticky top-[65px] z-10 border-b border-white/10 bg-bg">
        <div className="mx-auto flex max-w-5xl overflow-x-auto px-5">
          {TABS.map((tab) => (
            <button
              key={tab.step}
              onClick={() => setStep(tab.step)}
              className={`min-w-[96px] flex-1 border-b-2 py-3 text-sm font-semibold ${
                currentStep === tab.step ? 'border-primary text-primary' : 'border-transparent text-text2 hover:text-text'
              }`}
            >
              {tab.step}. {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-6">
        {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        {notice && <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</div>}

        {currentStep === 1 && (
          <Section title="공고 분석" desc="원문에서 추출한 사실, 불확실한 항목, 근거 인용을 확인합니다.">
            <p className="mb-4 text-sm leading-relaxed text-text2">{activeAnalysis.summary || '요약 정보가 없습니다.'}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoList title="지원 자격" items={activeAnalysis.eligibility} />
              <InfoList title="혜택" items={activeAnalysis.benefits} />
              <InfoList title="평가 기준" items={activeAnalysis.evaluation_criteria} />
              <InfoList title="주의사항" items={activeAnalysis.cautions} />
              <InfoList title="불확실한 항목" items={activeAnalysis.uncertain_fields} />
              <InfoList title="근거 인용" items={(activeAnalysis.source_evidence ?? []).map((item) => `${item.field}: ${item.quote}`)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <h3 className="text-sm font-bold">일정</h3>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-text2">
                  {activeAnalysis.timeline.map((item) => (
                    <li key={item.id}>{item.date} · {item.label} · D{item.d_day >= 0 ? '-' : '+'}{Math.abs(item.d_day)}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <h3 className="text-sm font-bold">제출 서류</h3>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-text2">
                  {activeAnalysis.checklist.map((item) => (
                    <li key={item.id}>{item.category === 'required' ? '[필수]' : '[선택]'} {item.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
        )}

        {currentStep === 2 && (
          <Section title="필수 입력 수집" desc="초안에 필요한 내용을 입력합니다. 필수 항목이 비어 있으면 초안을 만들지 않습니다.">
            <div className="flex flex-col gap-3">
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
              <p className="mt-4 rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
                남은 필수 입력: {requiredMissing.map((field) => field.label).join(', ')}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={handleSaveInputs} disabled={busy} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-text2 hover:text-text disabled:opacity-50">
                입력 저장
              </button>
              <button onClick={handleGenerateDraft} disabled={busy} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {busy ? '처리 중...' : '섹션별 초안 생성'}
              </button>
            </div>
          </Section>
        )}

        {currentStep === 3 && (
          <Section title="섹션별 초안" desc="Agent가 만든 초안을 확인하고 피드백을 반영합니다.">
            <div className="flex flex-col gap-4">
              {workflow.draft_sections.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  streamState={streamStates[draft.section_id]}
                  feedback={feedbackValues[draft.section_id] ?? ''}
                  onFeedbackChange={(value) => setFeedbackValues((prev) => ({ ...prev, [draft.section_id]: value }))}
                  onSaveFeedback={() => handleSaveFeedback(draft.section_id)}
                  onRevise={() => handleRevise(draft.section_id)}
                  busy={busy}
                />
              ))}
            </div>
            <button
              onClick={handleFinalize}
              disabled={busy || workflow.draft_sections.every((draft) => !draft.content_markdown)}
              className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              확인 후 최종 문서 생성
            </button>
          </Section>
        )}

        {currentStep === 4 && (
          <Section title="최종 문서" desc="제출 전 사용자가 반드시 검토해야 하는 최종 초안입니다.">
            {!workflow.final_document ? (
              <button onClick={handleFinalize} disabled={busy} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                최종 문서 생성
              </button>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleExportHtml} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                    HTML export
                  </button>
                  <button onClick={handleExportHwpx} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                    HWPX export
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(workflow.final_document?.content_markdown ?? '')} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text2">
                    Markdown 복사
                  </button>
                </div>
                <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-4 text-sm leading-relaxed text-text2">
                  {workflow.final_document.content_markdown}
                </pre>
              </div>
            )}
          </Section>
        )}
      </div>
    </main>
  );
}
