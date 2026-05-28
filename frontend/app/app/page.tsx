'use client';

import { useEffect, useRef, useState } from 'react';
import {
  analyzeDocument,
  analyzeText,
  analyzeUrl,
  createDraftStream,
  exportWorkflowHtml,
  exportWorkflowHwpx,
  exportWorkflowPdf,
  finalizeWorkflow,
  getDemo,
  getWorkflow,
  reviseDraft,
  restoreWorkflow,
  saveDraftFeedback,
  saveWorkflowInputs,
} from '@/lib/api';
import type { DraftSection, DraftStreamEvent, ExportResponse, WorkflowSession } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { HwpxFormEditor } from '@/components/workspace/HwpxFormEditor';

type AgentStep = 'input' | 'analysis' | 'questions' | 'draft' | 'review' | 'download';

const STEPS: Array<{ id: AgentStep; label: string }> = [
  { id: 'input', label: '원문 입력' },
  { id: 'analysis', label: '요구사항' },
  { id: 'questions', label: '확인 질문' },
  { id: 'draft', label: '섹션 초안' },
  { id: 'review', label: '검토' },
  { id: 'download', label: 'Export' },
];

function downloadExport(exported: ExportResponse) {
  const bytes =
    exported.encoding === 'base64'
      ? Uint8Array.from(atob(exported.content), (ch) => ch.charCodeAt(0))
      : new TextEncoder().encode(exported.content);
  const blob = new Blob([bytes], { type: exported.content_type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exported.filename;
  a.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const LOADING_PHASES = [
  '공고문을 읽고 있습니다...',
  '마감일과 제출 서류를 확인하고 있습니다...',
  '지원 자격과 평가 기준을 정리하고 있습니다...',
  '원문 근거와 불확실한 항목을 분리하고 있습니다...',
  '사용자에게 물어볼 항목을 구성하고 있습니다...',
];

interface SavedSession {
  workflowId: string;
  step: AgentStep;
  workflow?: WorkflowSession;
  answers?: Record<string, string>;
  localEdits?: Record<string, string>;
}

function isWorkflowMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('워크플로를 찾을 수 없습니다') || message.includes('Workflow not found');
}

function answersFromWorkflow(workflow: WorkflowSession): Record<string, string> {
  return Object.fromEntries(workflow.user_inputs.map((field) => [field.id, field.value ?? '']));
}

export default function AppPage() {
  const [step, setStep] = useState<AgentStep>('input');
  const [workflow, setWorkflow] = useState<WorkflowSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftLog, setDraftLog] = useState<Array<{ section: string; done: boolean }>>([]);
  const [hwpxMode, setHwpxMode] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [revisingSectionId, setRevisingSectionId] = useState<string | null>(null);
  const [activeDelta, setActiveDelta] = useState<string>('');
  const esRef = useRef<EventSource | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('livedock_session');
    if (!saved) return;
    try {
      const session = JSON.parse(saved) as SavedSession;
      const { workflowId } = session;
      if (!workflowId) return;
      setBusy('restore');
      getWorkflow(workflowId)
        .then((res) => {
          setWorkflow(res.data);
          setAnswers(session.answers ?? answersFromWorkflow(res.data));
          setLocalEdits(session.localEdits ?? {});
          const hasDraft = res.data.draft_sections.length > 0;
          const isFinalized = res.data.status === 'finalized';
          setStep(session.step ?? (isFinalized ? 'download' : hasDraft ? 'review' : 'analysis'));
        })
        .catch(async () => {
          if (!session.workflow) {
            localStorage.removeItem('livedock_session');
            return;
          }
          try {
            const restored = await restoreWorkflow(session.workflow.id, session.workflow);
            setWorkflow(restored.data);
            setAnswers(session.answers ?? answersFromWorkflow(restored.data));
            setLocalEdits(session.localEdits ?? {});
            setStep(session.step ?? 'questions');
          } catch {
            localStorage.removeItem('livedock_session');
          }
        })
        .finally(() => setBusy(null));
    } catch {
      localStorage.removeItem('livedock_session');
    }
  }, []);

  // Persist session to localStorage whenever workflowId or step changes
  useEffect(() => {
    if (workflow?.id) {
      try {
        localStorage.setItem(
          'livedock_session',
          JSON.stringify({ workflowId: workflow.id, step, workflow, answers, localEdits } satisfies SavedSession),
        );
      } catch {
        localStorage.setItem('livedock_session', JSON.stringify({ workflowId: workflow.id, step } satisfies SavedSession));
      }
    }
  }, [workflow, answers, localEdits, step]);

  // Cycle loading phase messages during analysis
  useEffect(() => {
    if (busy !== 'analyze') {
      setLoadingPhase(null);
      return;
    }
    let i = 0;
    setLoadingPhase(LOADING_PHASES[0]);
    const id = setInterval(() => {
      i = (i + 1) % LOADING_PHASES.length;
      setLoadingPhase(LOADING_PHASES[i]);
    }, 2000);
    return () => clearInterval(id);
  }, [busy]);

  function reset() {
    esRef.current?.close();
    esRef.current = null;
    setStep('input');
    setWorkflow(null);
    setBusy(null);
    setError(null);
    setAnswers({});
    setDraftLog([]);
    setHwpxMode(true);
    setLocalEdits({});
    setRevisingSectionId(null);
    setActiveDelta('');
    localStorage.removeItem('livedock_session');
  }

  async function handleAnalysis(apiCall: () => Promise<{ success: boolean; data: { id: string } }>) {
    setBusy('analyze');
    setError(null);
    try {
      const res = await apiCall();
      const wf = await getWorkflow(res.data.id);
      setWorkflow(wf.data);
      setAnswers(answersFromWorkflow(wf.data));
      setStep('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveInputs() {
    if (!workflow) return;
    setBusy('save');
    setError(null);
    try {
      const inputs = Object.entries(answers).map(([field_id, value]) => ({ field_id, value }));
      const res = await withWorkflowRecovery((wf) => saveWorkflowInputs(wf.id, inputs));
      setWorkflow(res.data);
      setStep('draft');
      handleStartDraft(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '정보 저장에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function handleLocalEdit(sectionId: string, content: string) {
    setLocalEdits((prev) => ({ ...prev, [sectionId]: content }));
  }

  async function handleAiRevise(sectionId: string, feedback: string) {
    if (!workflow) return;
    setRevisingSectionId(sectionId);
    setError(null);
    try {
      await withWorkflowRecovery((wf) => saveDraftFeedback(wf.id, sectionId, feedback));
      const res = await withWorkflowRecovery((wf) => reviseDraft(wf.id, sectionId));
      setWorkflow(res.data);
      // Clear local edit for this section so server content shows
      setLocalEdits((prev) => { const next = { ...prev }; delete next[sectionId]; return next; });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 재작성에 실패했습니다.');
    } finally {
      setRevisingSectionId(null);
    }
  }

  function handleStartDraft(workflowId: string, recovered = false) {
    setBusy('draft');
    setDraftLog([]);
    setActiveDelta('');
    esRef.current?.close();

    const es = createDraftStream(workflowId, (event: DraftStreamEvent) => {
      if (event.type === 'section_start') {
        setActiveDelta('');
        setDraftLog((prev) => [...prev, { section: event.content, done: false }]);
      } else if (event.type === 'delta') {
        setActiveDelta((prev) => prev + event.content);
      } else if (event.type === 'section_done') {
        const title = event.draft_section?.title ?? event.content;
        setDraftLog((prev) => {
          const next = [...prev];
          const last = next.findLastIndex((item) => !item.done);
          if (last >= 0) next[last] = { section: title, done: true };
          return next;
        });
      } else if (event.type === 'workflow_done') {
        es.close();
        esRef.current = null;
        getWorkflow(workflowId).then((res) => {
          setWorkflow(res.data);
          setBusy(null);
        });
      } else if (event.type === 'error') {
        if (!recovered && isWorkflowMissingError(event.content)) {
          es.close();
          esRef.current = null;
          recoverWorkflowSession()
            .then((restored) => {
              if (restored) handleStartDraft(restored.id, true);
              else {
                setError(event.content);
                setBusy(null);
              }
            });
          return;
        }
        setError(event.content);
        es.close();
        esRef.current = null;
        setBusy(null);
      }
    });
    esRef.current = es;
  }

  async function handleFinalize() {
    if (!workflow) return;
    setBusy('finalize');
    setError(null);
    try {
      const res = await withWorkflowRecovery((wf) => finalizeWorkflow(wf.id));
      setWorkflow(res.data);
      setStep('download');
    } catch (err) {
      setError(err instanceof Error ? err.message : '최종 문서 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload(format: 'hwpx' | 'pdf' | 'html') {
    if (!workflow) return;
    setBusy(format);
    setError(null);
    try {
      let exported: ExportResponse;
      if (format === 'hwpx') exported = await withWorkflowRecovery((wf) => exportWorkflowHwpx(wf.id));
      else if (format === 'pdf') exported = await withWorkflowRecovery((wf) => exportWorkflowPdf(wf.id));
      else exported = await withWorkflowRecovery((wf) => exportWorkflowHtml(wf.id));
      downloadExport(exported);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${format.toUpperCase()} 다운로드에 실패했습니다.`);
    } finally {
      setBusy(null);
    }
  }

  async function recoverWorkflowSession(): Promise<WorkflowSession | null> {
    if (!workflow) return null;
    try {
      const restored = await restoreWorkflow(workflow.id, workflow);
      setWorkflow(restored.data);
      return restored.data;
    } catch {
      return null;
    }
  }

  async function withWorkflowRecovery<T>(operation: (wf: WorkflowSession) => Promise<T>): Promise<T> {
    if (!workflow) throw new Error('워크플로가 준비되지 않았습니다.');
    try {
      return await operation(workflow);
    } catch (err) {
      if (!isWorkflowMissingError(err)) throw err;
      const restored = await recoverWorkflowSession();
      if (!restored) throw err;
      return operation(restored);
    }
  }

  if (hwpxMode) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setHwpxMode(false)}
          className="flex items-center gap-1 text-sm font-semibold text-[#3A7A68] hover:underline"
        >
          공고 분석 모드로 전환
        </button>
        <HwpxFormEditor />
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">공고 기반 제출문서 Agent</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#24312D]">
              공고를 분석하고 제출 초안을 준비합니다.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#65736E]">
              PDF, HWPX, URL, 텍스트를 입력하면 요구사항과 근거를 정리하고, 부족한 정보만 질문한 뒤 섹션별 초안을 생성합니다.
            </p>
          </div>
          {workflow ? (
            <Button variant="secondary" onClick={reset} disabled={Boolean(busy)}>
              처음부터
            </Button>
          ) : null}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <div
                key={s.id}
                className={[
                  'rounded-xl border px-3 py-2 text-center text-xs font-bold transition',
                  active
                    ? 'border-[#245D50] bg-[#EDF7F2] text-[#245D50]'
                    : done
                      ? 'border-[#C8DBD2] bg-[#F7FBF9] text-[#3A7A68]'
                      : 'border-[#E4EBE7] bg-white text-[#9AABA4]',
                ].join(' ')}
              >
                <span className="block">{i + 1}</span>
                <span className="block">{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {error ? (
        <ErrorRecovery
          message={error}
          workflowId={workflow?.id ?? null}
          onDismiss={() => setError(null)}
          onReset={reset}
          onHtmlExport={workflow ? () => handleDownload('html') : undefined}
        />
      ) : null}

      {step === 'input' && (
        <InputStep
          busy={busy}
          loadingPhase={loadingPhase}
          onAnalyzeFile={(file) => handleAnalysis(() => analyzeDocument(file))}
          onAnalyzeUrl={(url) => handleAnalysis(() => analyzeUrl(url))}
          onAnalyzeText={(text, title) => handleAnalysis(() => analyzeText(text, title))}
          onDemo={(docType) => handleAnalysis(() => getDemo(docType))}
          onHwpxMode={() => setHwpxMode(true)}
        />
      )}

      {step === 'analysis' && workflow ? (
        <AnalysisStep
          workflow={workflow}
          onBack={reset}
          onNext={() => setStep('questions')}
        />
      ) : null}

      {step === 'questions' && workflow ? (
        <QuestionsStep
          workflow={workflow}
          answers={answers}
          onAnswer={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
          busy={busy}
          onBack={() => setStep('analysis')}
          onNext={handleSaveInputs}
        />
      ) : null}

      {step === 'draft' && workflow ? (
        <DraftStep
          log={draftLog}
          activeDelta={activeDelta}
          busy={busy}
          onBack={() => setStep('questions')}
          onNext={() => setStep('review')}
        />
      ) : null}

      {step === 'review' && workflow ? (
        <ReviewStep
          workflow={workflow}
          localEdits={localEdits}
          revisingSectionId={revisingSectionId}
          onLocalEdit={handleLocalEdit}
          onAiRevise={handleAiRevise}
          busy={busy}
          onBack={() => setStep('draft')}
          onFinalize={handleFinalize}
        />
      ) : null}

      {step === 'download' && workflow ? (
        <DownloadStep
          workflow={workflow}
          busy={busy}
          onDownloadHwpx={() => handleDownload('hwpx')}
          onDownloadPdf={() => handleDownload('pdf')}
          onDownloadHtml={() => handleDownload('html')}
          onReset={reset}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Step 1: Input                                              */
/* ─────────────────────────────────────────────────────────── */

function InputStep({
  busy,
  loadingPhase,
  onAnalyzeFile,
  onAnalyzeUrl,
  onAnalyzeText,
  onDemo,
  onHwpxMode,
}: {
  busy: string | null;
  loadingPhase: string | null;
  onAnalyzeFile: (file: File) => void;
  onAnalyzeUrl: (url: string) => void;
  onAnalyzeText: (text: string, title: string) => void;
  onDemo: (docType?: string) => void;
  onHwpxMode: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'file' | 'url' | 'text'>('file');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [textTitle, setTextTitle] = useState('');

  const isAnalyzing = busy === 'analyze';

  return (
    <div className="space-y-4">
      {/* Main input card */}
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        {/* Tab selector */}
        <div className="flex gap-1 rounded-xl bg-[#F4F7F5] p-1">
          {(['file', 'url', 'text'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'flex-1 rounded-lg px-3 py-2 text-sm font-bold transition',
                tab === t ? 'bg-white text-[#245D50] shadow-sm' : 'text-[#65736E] hover:text-[#24312D]',
              ].join(' ')}
            >
              {t === 'file' ? '파일 업로드' : t === 'url' ? 'URL 입력' : '텍스트 입력'}
            </button>
          ))}
          <button
            type="button"
            onClick={onHwpxMode}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition text-[#65736E] hover:text-[#24312D]"
          >
            HWPX 양식 작성
          </button>
        </div>

        <div className="mt-5">
          {tab === 'file' && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.hwp,.hwpx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAnalyzeFile(f);
                }}
              />
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) onAnalyzeFile(f);
                }}
                className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#BFD1C9] bg-[#F8FBFA] transition hover:border-[#6A9C89] hover:bg-[#F2F8F5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF7F2]">
                  <svg className="h-7 w-7 text-[#245D50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </span>
                <div className="text-center">
                  <p className="text-base font-bold text-[#245D50]">
                    {isAnalyzing
                      ? (loadingPhase ?? '공고를 분석하고 있습니다...')
                      : '공고 파일을 올려주세요'}
                  </p>
                  <p className="mt-1 text-sm text-[#65736E]">PDF, HWP, HWPX를 지원합니다.</p>
                </div>
              </button>
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-[#24312D]">공고 URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.example.com/notice/12345"
                  className="mt-2 w-full rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm outline-none focus:border-[#6A9C89]"
                />
              </label>
              <Button
                onClick={() => url.trim() && onAnalyzeUrl(url.trim())}
                disabled={!url.trim() || isAnalyzing}
              >
                {isAnalyzing ? (loadingPhase ?? 'URL을 분석하고 있습니다...') : 'URL 공고 분석'}
              </Button>
            </div>
          )}

          {tab === 'text' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-[#24312D]">공고 제목 (선택)</span>
                <input
                  type="text"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="예: 2026 청년 창업 지원 공고"
                  className="mt-2 w-full rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm outline-none focus:border-[#6A9C89]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-[#24312D]">공고 내용 붙여넣기</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  placeholder="공고 전체 내용을 붙여넣으세요. (100자 이상)"
                  className="mt-2 w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
                />
              </label>
              <Button
                onClick={() => text.trim().length >= 100 && onAnalyzeText(text.trim(), textTitle.trim())}
                disabled={text.trim().length < 100 || isAnalyzing}
              >
                {isAnalyzing ? (loadingPhase ?? '공고를 분석하고 있습니다...') : '텍스트 공고 분석'}
              </Button>
              {text.length > 0 && text.length < 100 && (
                <p className="text-xs text-rose-600">{100 - text.length}자 더 입력해 주세요.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Demo option — 5 doc-type quick-start buttons */}
      <section className="rounded-2xl border border-[#C8DBD2] bg-[#EDF7F2] p-5">
        <p className="text-sm font-bold text-[#245D50]">데모 공고로 바로 체험</p>
        <p className="mt-1 text-xs leading-5 text-[#3A7A68]">
          대표 공고 fixture로 분석, 질문, 초안 생성 흐름을 확인합니다. 파일은 필요 없습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { id: 'startup', label: '공모전' },
              { id: 'scholarship', label: '장학금' },
              { id: 'business_plan', label: '지원사업' },
              { id: 'application', label: '신청서' },
              { id: 'research', label: '연구과제' },
            ] as const
          ).map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onDemo(type.id)}
              disabled={isAnalyzing}
              className="rounded-xl border border-[#C8DBD2] bg-white px-4 py-2 text-xs font-bold text-[#245D50] transition hover:border-[#3A7A68] hover:bg-[#F0FAF5] disabled:opacity-50"
            >
              {isAnalyzing ? '분석 중...' : `${type.label} 데모`}
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Step 2: Analysis                                           */
/* ─────────────────────────────────────────────────────────── */

function AnalysisStep({
  workflow,
  onBack,
  onNext,
}: {
  workflow: WorkflowSession;
  onBack: () => void;
  onNext: () => void;
}) {
  const a = workflow.analysis;
  const deadline = a.timeline.find((t) => t.is_deadline);

  return (
    <section className="space-y-5">
      {/* Summary card */}
      <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">원문에서 확인한 핵심 정보</p>
        <h2 className="mt-2 text-2xl font-bold text-[#24312D]">{a.title || '제목 없음'}</h2>
        {a.organization ? (
          <p className="mt-1 text-sm font-semibold text-[#65736E]">{a.organization}</p>
        ) : null}
        {a.summary ? (
          <p className="mt-3 text-sm leading-7 text-[#40504B]">{a.summary}</p>
        ) : null}

        {/* Key facts */}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="마감일"
            value={deadline ? deadline.date : '확인 필요'}
            highlight={Boolean(deadline)}
          />
          <InfoCard label="제출 방법" value={a.submission_method || '확인 필요'} />
          <InfoCard label="제출 서류" value={`${a.checklist.length}종`} />
          <InfoCard label="초안 섹션" value={`${a.document_template.length}개`} />
        </div>
      </div>

      {/* Eligibility */}
      {a.eligibility.length > 0 && (
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#24312D]">신청 자격</p>
          <ul className="mt-3 space-y-1">
            {a.eligibility.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-6 text-[#40504B]">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3A7A68]" />
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline */}
      {a.timeline.length > 0 && (
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#24312D]">일정</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {a.timeline.map((t) => (
              <div
                key={t.id}
                className={[
                  'rounded-xl border px-4 py-2 text-sm',
                  t.is_deadline ? 'border-rose-200 bg-rose-50' : 'border-[#E4EBE7] bg-[#F8FBFA]',
                ].join(' ')}
              >
                <span className="font-bold text-[#24312D]">{t.label}</span>
                <span className="ml-2 text-[#65736E]">{t.date}</span>
                {t.is_deadline && (
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                    마감
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {a.checklist.length > 0 && (
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#24312D]">제출 서류</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {a.checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-3 py-2 text-sm">
                <span
                  className={[
                    'h-2 w-2 flex-shrink-0 rounded-full',
                    item.category === 'required' ? 'bg-[#3A7A68]' : 'bg-[#B5CAC1]',
                  ].join(' ')}
                />
                <span className="font-semibold text-[#24312D]">{item.label}</span>
                {item.category === 'required' && (
                  <span className="ml-auto text-[10px] font-bold text-[#3A7A68]">필수</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncertain / needs confirmation */}
      {a.uncertain_fields.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">확인이 필요한 항목</p>
          <ul className="mt-3 space-y-1">
            {a.uncertain_fields.map((f, i) => (
              <li key={i} className="text-sm leading-6 text-amber-700">
                · {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What AI will ask */}
      {a.missing_questions.length > 0 && (
        <div className="rounded-2xl border border-[#DDE7E2] bg-[#F8FBFA] p-5">
          <p className="text-sm font-bold text-[#24312D]">다음 단계에서 물어볼 정보</p>
          <ul className="mt-3 space-y-1">
            {a.missing_questions.map((q) => (
              <li key={q.id} className="text-sm leading-6 text-[#65736E]">
                · {q.question}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          다시 입력
        </Button>
        <Button onClick={onNext}>확인 질문으로 이동</Button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Step 3: Questions                                          */
/* ─────────────────────────────────────────────────────────── */

function QuestionsStep({
  workflow,
  answers,
  onAnswer,
  busy,
  onBack,
  onNext,
}: {
  workflow: WorkflowSession;
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  busy: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const required = workflow.user_inputs.filter((f) => f.required);
  const optional = workflow.user_inputs.filter((f) => !f.required);
  const requiredFilled = required.every((f) => answers[f.id]?.trim());

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">확인 질문</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">
        공고에 없는 정보만 채워 주세요.
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        원문에서 확인한 내용은 분석 결과에 남겨두고, 초안 작성에 필요한 사용자 정보만 받습니다.
      </p>

      <div className="mt-6 space-y-5">
        {required.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#3A7A68]">필수 항목</p>
            <div className="space-y-4">
              {required.map((field) => (
                <InputField
                  key={field.id}
                  field={field}
                  value={answers[field.id] ?? ''}
                  onChange={(v) => onAnswer(field.id, v)}
                />
              ))}
            </div>
          </div>
        )}

        {optional.length > 0 && (
          <details className="rounded-xl border border-[#E4EBE7]">
            <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-[#24312D]">
              선택 항목 ({optional.length}개) — 입력하면 초안 맥락이 보강됩니다
            </summary>
            <div className="space-y-4 border-t border-[#E4EBE7] px-4 py-4">
              {optional.map((field) => (
                <InputField
                  key={field.id}
                  field={field}
                  value={answers[field.id] ?? ''}
                  onChange={(v) => onAnswer(field.id, v)}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          분석 결과 보기
        </Button>
        <Button onClick={onNext} disabled={Boolean(busy) || !requiredFilled}>
          {busy === 'save' ? '저장 중...' : '섹션별 초안 생성'}
        </Button>
      </div>
      {!requiredFilled && (
        <p className="mt-2 text-right text-xs text-rose-500">필수 항목을 모두 입력해 주세요.</p>
      )}
    </section>
  );
}

function InputField({
  field,
  value,
  onChange,
}: {
  field: { id: string; label: string; field_type: string; required: boolean; description?: string | null; placeholder?: string | null };
  value: string;
  onChange: (v: string) => void;
}) {
  const isTextarea = field.field_type === 'textarea';
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#24312D]">
        {field.label}
        {field.required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {field.description && (
        <span className="mt-0.5 block text-xs text-[#65736E]">{field.description}</span>
      )}
      {isTextarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          rows={4}
          className="mt-2 w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
        />
      ) : (
        <input
          type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          className="mt-2 w-full rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm outline-none focus:border-[#6A9C89]"
        />
      )}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Step 4: Draft                                              */
/* ─────────────────────────────────────────────────────────── */

function DraftStep({
  log,
  activeDelta,
  busy,
  onBack,
  onNext,
}: {
  log: Array<{ section: string; done: boolean }>;
  activeDelta: string;
  busy: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const generating = busy === 'draft';
  const allDone = !generating && log.length > 0;

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">섹션별 초안 생성</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">
        {generating ? '공고 근거와 입력값으로 초안을 작성하고 있습니다...' : allDone ? '초안 생성 완료' : '초안을 생성합니다.'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        각 섹션은 검토 가능한 단위로 생성됩니다. 확인이 필요한 항목은 초안 안에 남깁니다.
      </p>

      {log.length > 0 && (
        <div className="mt-6 space-y-2">
          {log.map((item, i) => {
            const isLast = i === log.length - 1;
            const showDelta = isLast && !item.done && activeDelta;
            return (
              <div key={i} className="space-y-1">
                <div
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                    item.done
                      ? 'border-[#C8DBD2] bg-[#F7FBF9] text-[#3A7A68]'
                      : 'border-[#E4EBE7] bg-[#FAFCFB] text-[#65736E]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-2 w-2 flex-shrink-0 rounded-full',
                      item.done ? 'bg-[#3A7A68]' : 'animate-pulse bg-[#6A9C89]',
                    ].join(' ')}
                  />
                  <span className="font-semibold">{item.section}</span>
                  {item.done && <span className="ml-auto text-xs font-bold">완료</span>}
                </div>
                {showDelta && (
                  <div className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-4 py-3 text-xs leading-6 text-[#65736E] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {activeDelta}
                    <span className="animate-pulse">▍</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {generating && log.length === 0 && (
        <div className="mt-6 flex items-center gap-3 text-sm text-[#65736E]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#6A9C89]" />
          초안 작성을 시작합니다...
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        {!generating && (
          <Button variant="secondary" onClick={onBack}>
            정보 다시 입력
          </Button>
        )}
        {allDone && <Button onClick={onNext}>초안 검토하기</Button>}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Step 5: Review                                             */
/* ─────────────────────────────────────────────────────────── */

function ReviewStep({
  workflow,
  localEdits,
  revisingSectionId,
  onLocalEdit,
  onAiRevise,
  busy,
  onBack,
  onFinalize,
}: {
  workflow: WorkflowSession;
  localEdits: Record<string, string>;
  revisingSectionId: string | null;
  onLocalEdit: (sectionId: string, content: string) => void;
  onAiRevise: (sectionId: string, feedback: string) => void;
  busy: string | null;
  onBack: () => void;
  onFinalize: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">초안 검토</p>
        <h2 className="mt-2 text-2xl font-bold text-[#24312D]">
          섹션별 초안을 확인하고 최종 문서를 생성합니다.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#65736E]">
          제출 전 문장, 근거, 확인 필요 항목을 살펴보고 필요한 부분만 수정하세요.
        </p>
      </div>

      {workflow.draft_sections.map((section) => (
        <DraftSectionCard
          key={section.id}
          section={section}
          localContent={localEdits[section.section_id]}
          isRevising={revisingSectionId === section.section_id}
          onLocalEdit={(content) => onLocalEdit(section.section_id, content)}
          onAiRevise={(feedback) => onAiRevise(section.section_id, feedback)}
        />
      ))}

      <div className="flex justify-end gap-2 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <Button variant="secondary" onClick={onBack}>
          초안 다시 생성
        </Button>
        <Button onClick={onFinalize} disabled={Boolean(busy)}>
          {busy === 'finalize' ? '최종 문서 생성 중...' : '최종 문서 생성'}
        </Button>
      </div>
    </section>
  );
}

const STATUS_COLORS: Record<string, string> = {
  empty: 'bg-[#E4EBE7] text-[#65736E]',
  needs_input: 'bg-amber-100 text-amber-700',
  drafted: 'bg-blue-50 text-blue-700',
  revised: 'bg-[#EDF7F2] text-[#3A7A68]',
  confirmed: 'bg-[#C8DBD2] text-[#245D50]',
};
const STATUS_LABEL: Record<string, string> = {
  empty: '비어 있음',
  needs_input: '입력 필요',
  drafted: 'AI 작성',
  revised: '수정됨',
  confirmed: '확인 완료',
};

function DraftSectionCard({
  section,
  localContent,
  isRevising,
  onLocalEdit,
  onAiRevise,
}: {
  section: DraftSection;
  localContent: string | undefined;
  isRevising: boolean;
  onLocalEdit: (content: string) => void;
  onAiRevise: (feedback: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const displayContent = localContent ?? section.content_markdown;

  function startEdit() {
    setEditText(displayContent);
    setIsEditing(true);
    setShowFeedback(false);
  }

  function saveEdit() {
    onLocalEdit(editText);
    setIsEditing(false);
  }

  function submitFeedback() {
    if (!feedbackText.trim()) return;
    onAiRevise(feedbackText.trim());
    setFeedbackText('');
    setShowFeedback(false);
  }

  return (
    <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className="text-base font-bold text-[#24312D]">{section.title}</h3>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            STATUS_COLORS[section.status] ?? 'bg-[#F8FBFA] text-[#65736E]',
          ].join(' ')}
        >
          {STATUS_LABEL[section.status] ?? section.status}
        </span>
        {localContent && (
          <span className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#3A7A68]">
            로컬 편집
          </span>
        )}
        {displayContent && !isEditing && !showFeedback && (
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={startEdit}
              className="rounded-lg border border-[#DDE7E2] bg-white px-3 py-1 text-xs font-bold text-[#40504B] transition hover:border-[#6A9C89] hover:text-[#245D50]"
            >
              편집
            </button>
            <button
              type="button"
              onClick={() => { setShowFeedback(true); setIsEditing(false); }}
              disabled={isRevising}
              className="rounded-lg border border-[#DDE7E2] bg-white px-3 py-1 text-xs font-bold text-[#3A7A68] transition hover:border-[#3A7A68] hover:bg-[#EDF7F2] disabled:opacity-50"
            >
              {isRevising ? 'AI 재작성 중...' : 'AI 재작성'}
            </button>
          </div>
        )}
      </div>

      {/* Inline edit mode */}
      {isEditing ? (
        <div className="mt-4 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="w-full resize-y rounded-xl border border-[#6A9C89] bg-[#F8FBFA] px-4 py-3 text-sm leading-7 text-[#24312D] outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-[#DDE7E2] px-3 py-1.5 text-xs font-bold text-[#65736E] hover:bg-[#F8FBFA]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="rounded-lg bg-[#245D50] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E4F44]"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        displayContent && (
          <div className="mt-4 whitespace-pre-wrap rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-4 py-3 text-sm leading-7 text-[#40504B]">
            {displayContent}
          </div>
        )
      )}

      {/* AI feedback panel */}
      {showFeedback && !isEditing && (
        <div className="mt-4 space-y-2 rounded-xl border border-[#C8DBD2] bg-[#EDF7F2] p-4">
          <p className="text-xs font-bold text-[#245D50]">AI 재작성 방향을 입력하세요</p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={3}
            placeholder="예: 구체적인 수치를 추가해줘 / 더 간결하게 작성해줘 / 마지막 문단을 삭제해줘"
            className="w-full resize-none rounded-xl border border-[#C8DBD2] bg-white px-3 py-2 text-sm outline-none focus:border-[#3A7A68]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFeedback(false)}
              className="rounded-lg border border-[#DDE7E2] px-3 py-1.5 text-xs font-bold text-[#65736E] hover:bg-white"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitFeedback}
              disabled={!feedbackText.trim() || isRevising}
              className="rounded-lg bg-[#245D50] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E4F44] disabled:opacity-50"
            >
              AI로 다시 작성
            </button>
          </div>
        </div>
      )}

      {/* revision_notes */}
      {section.revision_notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {section.revision_notes.map((note, i) => (
            <p key={i} className="text-xs text-[#65736E]">· {note}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Step 6: Download                                           */
/* ─────────────────────────────────────────────────────────── */

function DownloadStep({
  workflow,
  busy,
  onDownloadHwpx,
  onDownloadPdf,
  onDownloadHtml,
  onReset,
}: {
  workflow: WorkflowSession;
  busy: string | null;
  onDownloadHwpx: () => void;
  onDownloadPdf: () => void;
  onDownloadHtml: () => void;
  onReset: () => void;
}) {
  const cautions = workflow.analysis.cautions;
  const final = workflow.final_document;

  return (
    <section className="space-y-5">
      {/* Success banner */}
      <div className="rounded-2xl border border-[#C8DBD2] bg-[#EDF7F2] p-6 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">Export 준비 완료</p>
        <h2 className="mt-2 text-2xl font-bold text-[#24312D]">{final?.title || workflow.analysis.title}</h2>
        <p className="mt-2 text-sm text-[#65736E]">
          제출 전 내용을 한 번 더 확인한 뒤 필요한 형식으로 내려받으세요.
        </p>
      </div>

      {cautions.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-800">공고 유의사항</p>
          <ul className="mt-2 space-y-1">
            {cautions.map((c, i) => (
              <li key={i} className="text-sm text-amber-700">· {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Download buttons */}
      <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#24312D]">Export 형식 선택</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <DownloadCard
            label="HWPX"
            description="편집 가능한 한글 문서"
            recommended
            busy={busy === 'hwpx'}
            onClick={onDownloadHwpx}
          />
          <DownloadCard
            label="PDF"
            description="검토와 공유용 문서"
            busy={busy === 'pdf'}
            onClick={onDownloadPdf}
          />
          <DownloadCard
            label="HTML"
            description="HWPX 실패 시 백업"
            busy={busy === 'html'}
            onClick={onDownloadHtml}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onReset}>
          새 공고 분석
        </Button>
      </div>
    </section>
  );
}

function DownloadCard({
  label,
  description,
  recommended,
  busy,
  onClick,
}: {
  label: string;
  description: string;
  recommended?: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-center gap-2 rounded-2xl border border-[#DDE7E2] bg-[#F8FBFA] px-4 py-5 text-center transition hover:border-[#6A9C89] hover:bg-[#EDF7F2] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {recommended && (
        <span className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#3A7A68]">
          권장
        </span>
      )}
      <span className="text-lg font-extrabold text-[#24312D]">{busy ? '생성 중...' : label}</span>
      <span className="text-xs text-[#65736E]">{description}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Shared                                                     */
/* ─────────────────────────────────────────────────────────── */

function ErrorRecovery({
  message,
  workflowId,
  onDismiss,
  onReset,
  onHtmlExport,
}: {
  message: string;
  workflowId: string | null;
  onDismiss: () => void;
  onReset: () => void;
  onHtmlExport?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <p className="text-sm font-bold text-rose-700">{message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
        >
          닫기
        </button>
        {onHtmlExport && workflowId && (
          <button
            type="button"
            onClick={onHtmlExport}
            className="rounded-xl border border-[#C8DBD2] bg-white px-4 py-2 text-sm font-bold text-[#245D50] transition hover:bg-[#EDF7F2]"
          >
            HTML로 저장 (백업)
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-[#E4EBE7] bg-white px-4 py-2 text-sm font-bold text-[#65736E] transition hover:bg-[#F8FBFA]"
        >
          처음부터
        </button>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-xl border p-3',
        highlight ? 'border-rose-200 bg-rose-50' : 'border-[#E4EBE7] bg-[#F8FBFA]',
      ].join(' ')}
    >
      <p className="text-xs font-bold text-[#65736E]">{label}</p>
      <p className={['mt-1 text-sm font-bold', highlight ? 'text-rose-700' : 'text-[#24312D]'].join(' ')}>
        {value}
      </p>
    </div>
  );
}
