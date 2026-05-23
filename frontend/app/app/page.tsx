'use client';

import { useEffect, useRef, useState } from 'react';
import {
  analyzeDocument,
  analyzeText,
  analyzeUrl,
  confirmWorkflow,
  createDraftStream,
  exportWorkflowHtml,
  exportWorkflowHwpx,
  exportWorkflowPdf,
  finalizeWorkflow,
  getDemo,
  getWorkflow,
  saveWorkflowInputs,
} from '@/lib/api';
import type { DraftSection, DraftStreamEvent, ExportResponse, WorkflowSession } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { HwpxFormEditor } from '@/components/workspace/HwpxFormEditor';

type AgentStep = 'input' | 'analysis' | 'questions' | 'draft' | 'review' | 'download';

const STEPS: Array<{ id: AgentStep; label: string }> = [
  { id: 'input', label: '공고 입력' },
  { id: 'analysis', label: 'AI 분석' },
  { id: 'questions', label: '정보 입력' },
  { id: 'draft', label: '초안 생성' },
  { id: 'review', label: '검토' },
  { id: 'download', label: '다운로드' },
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
  '제출 요구사항을 파악하고 있습니다...',
  '필수 서류를 확인하고 있습니다...',
  '마감일과 일정을 추출하고 있습니다...',
  '질문 항목을 구성하고 있습니다...',
];

export default function AppPage() {
  const [step, setStep] = useState<AgentStep>('input');
  const [workflow, setWorkflow] = useState<WorkflowSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftLog, setDraftLog] = useState<Array<{ section: string; done: boolean }>>([]);
  const [confirmedItems, setConfirmedItems] = useState<string[]>([]);
  const [hwpxMode, setHwpxMode] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('livedock_session');
    if (!saved) return;
    try {
      const { workflowId } = JSON.parse(saved) as { workflowId: string };
      if (!workflowId) return;
      setBusy('restore');
      getWorkflow(workflowId)
        .then((res) => {
          const inputAnswers: Record<string, string> = {};
          for (const field of res.data.user_inputs) {
            inputAnswers[field.id] = field.value ?? '';
          }
          setWorkflow(res.data);
          setAnswers(inputAnswers);
          const hasDraft = res.data.draft_sections.length > 0;
          const isFinalized = res.data.status === 'finalized';
          setStep(isFinalized ? 'download' : hasDraft ? 'review' : 'analysis');
        })
        .catch(() => localStorage.removeItem('livedock_session'))
        .finally(() => setBusy(null));
    } catch {
      localStorage.removeItem('livedock_session');
    }
  }, []);

  // Persist session to localStorage whenever workflowId or step changes
  useEffect(() => {
    if (workflow?.id) {
      localStorage.setItem('livedock_session', JSON.stringify({ workflowId: workflow.id, step }));
    }
  }, [workflow?.id, step]);

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
    setConfirmedItems([]);
    setHwpxMode(false);
    localStorage.removeItem('livedock_session');
  }

  async function handleAnalysis(apiCall: () => Promise<{ success: boolean; data: { id: string } }>) {
    setBusy('analyze');
    setError(null);
    try {
      const res = await apiCall();
      const wf = await getWorkflow(res.data.id);
      const inputAnswers: Record<string, string> = {};
      for (const field of wf.data.user_inputs) {
        inputAnswers[field.id] = field.value ?? '';
      }
      setWorkflow(wf.data);
      setAnswers(inputAnswers);
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
      const res = await saveWorkflowInputs(workflow.id, inputs);
      setWorkflow(res.data);
      setStep('draft');
      handleStartDraft(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '정보 저장에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function handleStartDraft(workflowId: string) {
    setBusy('draft');
    setDraftLog([]);
    esRef.current?.close();

    const es = createDraftStream(workflowId, (event: DraftStreamEvent) => {
      if (event.type === 'section_start') {
        setDraftLog((prev) => [...prev, { section: event.content, done: false }]);
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
      const needsConfirm = workflow.draft_sections.some((s) => s.confirmation_required.length > 0);
      let wf = workflow;
      if (needsConfirm) {
        const res = await confirmWorkflow(workflow.id, confirmedItems);
        wf = res.data;
        setWorkflow(wf);
      }
      const res = await finalizeWorkflow(wf.id);
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
      if (format === 'hwpx') exported = await exportWorkflowHwpx(workflow.id);
      else if (format === 'pdf') exported = await exportWorkflowPdf(workflow.id);
      else exported = await exportWorkflowHtml(workflow.id);
      downloadExport(exported);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${format.toUpperCase()} 다운로드에 실패했습니다.`);
    } finally {
      setBusy(null);
    }
  }

  if (hwpxMode) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 text-sm font-semibold text-[#3A7A68] hover:underline"
        >
          ← 공고 분석으로 돌아가기
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
            <p className="text-sm font-bold text-[#3A7A68]">AI 문서 자동 작성</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#24312D]">
              공고문을 올리면 AI가 제출 문서 초안을 자동으로 구성합니다.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#65736E]">
              PDF, URL, 텍스트를 입력하면 AI가 공고 요구사항을 분석하고, 부족한 정보만 질문한 뒤, 제출 가능한 초안을 생성합니다.
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
          onDemo={() => handleAnalysis(() => getDemo())}
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
          busy={busy}
          onBack={() => setStep('questions')}
          onNext={() => setStep('review')}
        />
      ) : null}

      {step === 'review' && workflow ? (
        <ReviewStep
          workflow={workflow}
          confirmedItems={confirmedItems}
          onToggleConfirm={(item) =>
            setConfirmedItems((prev) =>
              prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
            )
          }
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
  onDemo: () => void;
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
              {t === 'file' ? 'PDF / HWP 업로드' : t === 'url' ? 'URL 입력' : '텍스트 붙여넣기'}
            </button>
          ))}
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
                      ? (loadingPhase ?? 'AI가 공고문을 분석하고 있습니다...')
                      : '공고문 파일을 올려주세요'}
                  </p>
                  <p className="mt-1 text-sm text-[#65736E]">PDF, HWP, HWPX · 드래그&드롭 또는 클릭</p>
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
                {isAnalyzing ? (loadingPhase ?? 'URL 분석 중...') : '공고 분석 시작'}
              </Button>
            </div>
          )}

          {tab === 'text' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-[#24312D]">공고문 제목 (선택)</span>
                <input
                  type="text"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="예: 2026 청년 창업 지원 공고"
                  className="mt-2 w-full rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm outline-none focus:border-[#6A9C89]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-[#24312D]">공고문 내용 붙여넣기</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  placeholder="공고문 전체 내용을 붙여넣으세요. (100자 이상)"
                  className="mt-2 w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
                />
              </label>
              <Button
                onClick={() => text.trim().length >= 100 && onAnalyzeText(text.trim(), textTitle.trim())}
                disabled={text.trim().length < 100 || isAnalyzing}
              >
                {isAnalyzing ? (loadingPhase ?? '공고 분석 중...') : '공고 분석 시작'}
              </Button>
              {text.length > 0 && text.length < 100 && (
                <p className="text-xs text-rose-600">{100 - text.length}자 더 입력해 주세요.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Demo option */}
      <section className="rounded-2xl border border-[#C8DBD2] bg-[#EDF7F2] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#245D50]">파일 없이 예시로 바로 체험</p>
            <p className="mt-1 text-xs leading-5 text-[#3A7A68]">
              샘플 공고문으로 AI 분석 → 초안 생성 → 다운로드 전 과정을 60초 안에 확인할 수 있습니다.
            </p>
          </div>
          <Button onClick={onDemo} disabled={isAnalyzing}>
            {isAnalyzing ? '분석 중...' : '예시 시작'}
          </Button>
        </div>
      </section>

      {/* Secondary option */}
      <section className="rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#24312D]">공식 HWPX 양식 직접 작성</p>
            <p className="mt-1 text-xs leading-5 text-[#65736E]">
              공고에서 요구하는 공식 양식 파일(HWP/HWPX)을 업로드하고 항목을 바로 채워 다운로드할 수 있습니다.
            </p>
          </div>
          <Button variant="secondary" onClick={onHwpxMode}>
            양식 직접 편집
          </Button>
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
        <p className="text-sm font-bold text-[#3A7A68]">AI가 추출한 공고 핵심 정보</p>
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
          <InfoCard label="작성 섹션" value={`${a.document_template.length}개`} />
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
          <p className="text-sm font-bold text-[#24312D]">AI가 다음 단계에서 질문할 정보</p>
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
        <Button onClick={onNext}>정보 입력 시작</Button>
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
      <p className="text-sm font-bold text-[#3A7A68]">AI 초안에 반영할 정보 입력</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">
        부족한 정보만 입력하면 AI가 나머지를 작성합니다.
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        공고 근거가 있는 항목은 이미 채워졌습니다. 아래 항목만 입력해 주세요.
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
              선택 항목 ({optional.length}개) — 입력하면 더 풍부한 초안이 생성됩니다
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
          {busy === 'save' ? '저장 중...' : 'AI 초안 생성'}
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
  busy,
  onBack,
  onNext,
}: {
  log: Array<{ section: string; done: boolean }>;
  busy: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const generating = busy === 'draft';
  const allDone = !generating && log.length > 0;

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">AI 초안 자동 생성</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">
        {generating ? '섹션별 초안을 작성하고 있습니다...' : allDone ? '초안 생성 완료' : '초안을 생성합니다.'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        공고 요구사항과 입력 정보를 바탕으로 각 섹션을 작성합니다. 확인이 필요한 항목은 다음 단계에서 표시됩니다.
      </p>

      {log.length > 0 && (
        <div className="mt-6 space-y-2">
          {log.map((item, i) => (
            <div
              key={i}
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
          ))}
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
  confirmedItems,
  onToggleConfirm,
  busy,
  onBack,
  onFinalize,
}: {
  workflow: WorkflowSession;
  confirmedItems: string[];
  onToggleConfirm: (item: string) => void;
  busy: string | null;
  onBack: () => void;
  onFinalize: () => void;
}) {
  const allConfirmItems = workflow.draft_sections.flatMap((s) => s.confirmation_required);
  const allChecked = allConfirmItems.every((item) => confirmedItems.includes(item));

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">AI 초안 검토</p>
        <h2 className="mt-2 text-2xl font-bold text-[#24312D]">
          섹션별 초안을 확인하고 최종 문서를 생성합니다.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#65736E]">
          확인이 필요한 항목을 체크하고 최종 문서 생성 버튼을 눌러주세요.
        </p>
      </div>

      {workflow.draft_sections.map((section) => (
        <DraftSectionCard
          key={section.id}
          section={section}
          confirmedItems={confirmedItems}
          onToggleConfirm={onToggleConfirm}
        />
      ))}

      <div className="flex justify-end gap-2 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <Button variant="secondary" onClick={onBack}>
          초안 다시 생성
        </Button>
        <Button
          onClick={onFinalize}
          disabled={Boolean(busy) || (allConfirmItems.length > 0 && !allChecked)}
        >
          {busy === 'finalize' ? '최종 문서 생성 중...' : '최종 문서 생성'}
        </Button>
      </div>
      {allConfirmItems.length > 0 && !allChecked && (
        <p className="text-right text-xs text-amber-600">
          모든 확인 필요 항목을 체크해야 최종 문서를 생성할 수 있습니다.
        </p>
      )}
    </section>
  );
}

function DraftSectionCard({
  section,
  confirmedItems,
  onToggleConfirm,
}: {
  section: DraftSection;
  confirmedItems: string[];
  onToggleConfirm: (item: string) => void;
}) {
  const statusColors: Record<string, string> = {
    empty: 'bg-[#E4EBE7] text-[#65736E]',
    needs_input: 'bg-amber-100 text-amber-700',
    drafted: 'bg-blue-50 text-blue-700',
    revised: 'bg-[#EDF7F2] text-[#3A7A68]',
    confirmed: 'bg-[#C8DBD2] text-[#245D50]',
  };
  const statusLabel: Record<string, string> = {
    empty: '비어 있음',
    needs_input: '입력 필요',
    drafted: 'AI 작성',
    revised: '수정됨',
    confirmed: '확인 완료',
  };

  return (
    <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-bold text-[#24312D]">{section.title}</h3>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            statusColors[section.status] ?? 'bg-[#F8FBFA] text-[#65736E]',
          ].join(' ')}
        >
          {statusLabel[section.status] ?? section.status}
        </span>
      </div>

      {section.content_markdown && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-4 py-3 text-sm leading-7 text-[#40504B]">
          {section.content_markdown}
        </div>
      )}

      {section.confirmation_required.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs font-bold text-amber-800">확인 필요 항목</p>
          <div className="mt-2 space-y-2">
            {section.confirmation_required.map((item, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirmedItems.includes(item)}
                  onChange={() => onToggleConfirm(item)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-amber-300 accent-[#245D50]"
                />
                <span className="text-sm text-amber-800">{item}</span>
              </label>
            ))}
          </div>
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
        <p className="text-sm font-bold text-[#3A7A68]">최종 문서가 생성되었습니다</p>
        <h2 className="mt-2 text-2xl font-bold text-[#24312D]">{final?.title || workflow.analysis.title}</h2>
        <p className="mt-2 text-sm text-[#65736E]">
          아래에서 원하는 형식으로 다운로드하세요.
        </p>
      </div>

      {/* Pre-download checklist */}
      <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#24312D]">다운로드 전 최종 확인</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            '마감일과 접수 방법을 다시 확인했나요?',
            '제출 이메일/주소가 정확한가요?',
            '공고에 없는 내용이 임의로 포함되지 않았나요?',
            '필수 첨부서류를 모두 준비했나요?',
            '개인정보 및 서명/날인이 필요한 부분을 확인했나요?',
            '확인 필요로 표시된 항목을 모두 처리했나요?',
          ].map((item, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#245D50]" />
              <span className="text-[#40504B]">{item}</span>
            </label>
          ))}
        </div>
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
        <p className="text-sm font-bold text-[#24312D]">다운로드 형식 선택</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <DownloadCard
            label="HWPX"
            description="한글 호환 공식 제출 형식"
            recommended
            busy={busy === 'hwpx'}
            onClick={onDownloadHwpx}
          />
          <DownloadCard
            label="PDF"
            description="범용 문서 형식"
            busy={busy === 'pdf'}
            onClick={onDownloadPdf}
          />
          <DownloadCard
            label="HTML"
            description="한글에서 열 수 있는 웹 문서"
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
