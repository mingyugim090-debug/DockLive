'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  createWorkflowHwpxPlaceholderMap,
  downloadWorkflowExport,
  exportWorkflowHtml,
  exportWorkflowHwpx,
  exportWorkflowPdf,
  exportWorkflowHwpxTemplate,
  finalizeWorkflow,
  generateDraft,
  getHwpxStatus,
  getResult,
  getWorkflow,
  listWorkflowExports,
  reviseDraft,
  saveDraftFeedback,
  saveWorkflowInputs,
} from '@/lib/api';
import { loadResult, saveResult } from '@/lib/resultCache';
import { useAppStore } from '@/lib/store';
import type { AnalysisResult, ExportMetadata, HwpxStatusResponse, UserInputField, WorkflowSession } from '@/lib/types';
import {
  AppHeader,
  Button,
  DayStatusBadge,
  DraftSectionCard,
  EmptyState,
  ErrorBanner,
  EvidenceList,
  ExportPanel,
  InfoCard,
  LoadingState,
  NoticeBanner,
  SectionCard,
  StatusBadge,
  Toast,
  WorkflowStatusBadge,
  WorkflowStepper,
  stagger,
} from '@/components/livedock/ui';

function getDocTypeLabel(docType: string): string {
  const map: Record<string, string> = {
    competition: '공모전',
    research: '연구과제',
    scholarship: '장학금',
    startup: '창업지원',
  };
  return map[docType] ?? '기타 공고';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function formatDDay(dDay: number): string {
  if (dDay < 0) return '마감';
  if (dDay === 0) return 'D-Day';
  return `D-${dDay}`;
}

function WorkflowInputField({
  field,
  value,
  onChange,
}: {
  field: UserInputField;
  value: string;
  onChange: (value: string) => void;
}) {
  const isShort = field.field_type === 'text' || field.field_type === 'number' || field.field_type === 'date';
  const inputType = field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text">{field.label}</p>
          {field.description ? <p className="mt-1 text-xs leading-5 text-text3">{field.description}</p> : null}
        </div>
        {field.required ? <StatusBadge label="필수" tone="warning" /> : <StatusBadge label="선택" tone="neutral" />}
      </div>
      {isShort ? (
        <input
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? ''}
          className="input-shell w-full rounded-md px-3 py-2.5 text-sm"
        />
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? ''}
          className="input-shell min-h-[118px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-6"
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, desc, tone = 'neutral' }: { label: string; value: React.ReactNode; desc?: string; tone?: 'neutral' | 'info' | 'warning' | 'success' }) {
  const toneClass =
    tone === 'info'
      ? 'border-sky-400/20 bg-sky-400/[0.05]'
      : tone === 'warning'
        ? 'border-amber-400/20 bg-amber-400/[0.06]'
        : tone === 'success'
          ? 'border-emerald-400/20 bg-emerald-400/[0.05]'
          : 'border-white/[0.08] bg-white/[0.03]';
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text3">{label}</p>
      <div className="mt-2 text-base font-bold text-text">{value}</div>
      {desc ? <p className="mt-0.5 text-xs leading-5 text-text3">{desc}</p> : null}
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
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateMap, setTemplateMap] = useState('{}');
  const [placeholderMapPreview, setPlaceholderMapPreview] = useState('');
  const [placeholderWarnings, setPlaceholderWarnings] = useState<string[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportMetadata[]>([]);
  const [hwpxStatus, setHwpxStatus] = useState<HwpxStatusResponse | null>(null);
  const [loading, setLoading] = useState(!analysisResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setStep(1);
  }, [id, setStep]);

  useEffect(() => {
    getHwpxStatus()
      .then(setHwpxStatus)
      .catch(() =>
        setHwpxStatus({
          success: false,
          enabled: false,
          skill_dir: '',
          scripts_found: {},
          validation_available: false,
          template_clone_available: false,
          pdf_export_available: false,
          pdf_converter: null,
          pdf_warnings: ['PDF export status unavailable.'],
          warnings: ['HWPX toolchain 상태를 확인하지 못했습니다. HTML export를 fallback으로 사용할 수 있습니다.'],
        }),
      );
  }, []);

  useEffect(() => {
    if (!workflow) return;
    setInputValues(Object.fromEntries(workflow.user_inputs.map((field) => [field.id, field.value])));
    setFeedbackValues(Object.fromEntries(workflow.draft_sections.map((draft) => [draft.section_id, draft.user_feedback])));
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
        void refreshExports(workflowRes.data.id);
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

  const requiredStats = useMemo(() => {
    if (!workflow) return { total: 0, filled: 0, missing: [] as UserInputField[], percent: 100 };
    const required = workflow.user_inputs.filter((field) => field.required);
    const filled = required.filter((field) => inputValues[field.id]?.trim()).length;
    return {
      total: required.length,
      filled,
      missing: required.filter((field) => !inputValues[field.id]?.trim()),
      percent: required.length ? Math.round((filled / required.length) * 100) : 100,
    };
  }, [workflow, inputValues]);

  const mainDeadline = useMemo(() => {
    if (!activeAnalysis?.timeline.length) return null;
    const deadlines = activeAnalysis.timeline.filter((item) => item.is_deadline).sort((a, b) => a.d_day - b.d_day);
    return deadlines.find((item) => item.d_day >= 0) ?? deadlines[0] ?? activeAnalysis.timeline[0];
  }, [activeAnalysis]);

  const draftReady = Boolean(workflow?.draft_sections.some((draft) => draft.content_markdown.trim()));
  const canFinalize = draftReady;

  const refreshExports = async (workflowId: string) => {
    try {
      const res = await listWorkflowExports(workflowId);
      setExportHistory(res.data);
    } catch {
      setExportHistory([]);
    }
  };

  const applyWorkflow = (next: WorkflowSession) => {
    setLocalWorkflow(next);
    setWorkflow(next);
    setLocalResult(next.analysis);
    setResult(next.analysis);
    saveResult(next.analysis);
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
      setNotice('입력값을 저장했습니다.');
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '입력 저장에 실패했습니다.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const savedWorkflow = await handleSaveInputs();
    if (!savedWorkflow) {
      setBusy(false);
      return;
    }
    try {
      setStep(3);
      const drafted = await generateDraft(savedWorkflow.id);
      applyWorkflow(drafted.data);
      setNotice('섹션별 초안을 생성했습니다.');
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
      setNotice('피드백을 반영해 초안을 수정했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '초안 수정에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    if (!workflow || !canFinalize) return;
    setBusy(true);
    setError(null);
    try {
      const finalized = await finalizeWorkflow(workflow.id);
      applyWorkflow(finalized.data);
      setStep(4);
      setNotice('최종 문서를 생성했습니다. 제출 전 내용을 다시 검토해 주세요.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '최종 문서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const downloadExport = (filename: string, contentType: string, content: string, encoding: 'text' | 'base64') => {
    const payload = encoding === 'base64' ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0)) : content;
    const blob = new Blob([payload], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const handleExportHtml = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const exported = await exportWorkflowHtml(workflow.id);
      downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
      await refreshExports(workflow.id);
      setNotice('HTML export를 생성했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HTML export에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportHwpx = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const exported = await exportWorkflowHwpx(workflow.id);
      downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
      await refreshExports(workflow.id);
      setNotice('HWPX export를 생성했습니다.');
    } catch (err) {
      await refreshExports(workflow.id);
      setError(err instanceof Error ? `${err.message} HTML export를 fallback으로 사용할 수 있습니다.` : 'HWPX export에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const exported = await exportWorkflowPdf(workflow.id);
      downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
      await refreshExports(workflow.id);
      setNotice('PDF export를 생성했습니다.');
    } catch (err) {
      await refreshExports(workflow.id);
      setError(err instanceof Error ? err.message : 'PDF export에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePlaceholderMap = async () => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const response = await createWorkflowHwpxPlaceholderMap(workflow.id);
      const json = JSON.stringify(response.placeholder_map, null, 2);
      setTemplateMap(json);
      setPlaceholderMapPreview(json);
      setPlaceholderWarnings(response.warnings);
      await refreshExports(workflow.id);
      setNotice(response.warnings.length ? 'Placeholder map을 생성했습니다. 경고 항목을 확인해 주세요.' : 'Placeholder map을 생성했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Placeholder map 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportTemplate = async () => {
    if (!workflow || !templateFile) return;
    setBusy(true);
    setError(null);
    try {
      JSON.parse(templateMap || '{}');
      const exported = await exportWorkflowHwpxTemplate(workflow.id, templateFile, templateMap || '{}');
      downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
      await refreshExports(workflow.id);
      setNotice('템플릿 HWPX export를 생성했습니다.');
    } catch (err) {
      await refreshExports(workflow.id);
      setError(err instanceof Error ? err.message : 'HWPX 템플릿 export에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadStoredExport = async (exportId: string) => {
    if (!workflow) return;
    setBusy(true);
    setError(null);
    try {
      const exported = await downloadWorkflowExport(workflow.id, exportId);
      downloadExport(exported.filename, exported.content_type, exported.content, exported.encoding);
      setNotice('저장된 export 파일을 다운로드했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장된 export 파일 다운로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('공유 링크를 복사했습니다.');
    } catch {
      setError('공유 링크를 복사하지 못했습니다.');
    }
  };

  const handleCopyMarkdown = async () => {
    if (!workflow?.final_document) return;
    try {
      await navigator.clipboard.writeText(workflow.final_document.content_markdown);
      setNotice('최종 문서 Markdown을 복사했습니다.');
    } catch {
      setError('Markdown을 복사하지 못했습니다.');
    }
  };

  if (loading) return <LoadingState />;

  if (error && !activeAnalysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center text-text">
        <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-8">
          <p className="text-lg font-bold text-text">결과를 찾을 수 없습니다</p>
          <p className="mt-2 text-sm leading-6 text-text3">{error}</p>
          <Button type="button" className="mt-6" onClick={() => router.push('/')}>다시 분석하기</Button>
        </div>
      </div>
    );
  }

  if (!activeAnalysis || !workflow) return null;

  return (
    <main className="min-h-screen bg-bg text-text">
      <AppHeader
        onBack={() => router.push('/')}
        title={activeAnalysis.title}
        subtitle={`${activeAnalysis.organization || '기관 미상'} · ${getDocTypeLabel(activeAnalysis.doc_type)}`}
        status={<WorkflowStatusBadge status={workflow.status} />}
        right={
          <>
            <Button type="button" variant="ghost" onClick={handleCopyShare} className="hidden sm:inline-flex">공유</Button>
            <Button type="button" onClick={() => setStep(4)} className="text-sm">Export</Button>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 pb-20 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:pb-5">
        <aside className="space-y-4 lg:sticky lg:top-[72px] lg:h-fit">
          <WorkflowStepper currentStep={currentStep} onChange={(step) => setStep(step)} />
          <div className="hidden space-y-3 rounded-xl border border-white/[0.08] bg-[rgba(13,19,36,0.6)] p-4 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text3">세션 상태</p>
            <MetricCard label="필수 입력" value={`${requiredStats.filled} / ${requiredStats.total}`} desc={`${requiredStats.percent}% 완료`} tone="warning" />
            <MetricCard label="초안 섹션" value={workflow.draft_sections.length} desc={draftReady ? '초안 내용 있음' : '생성 대기 중'} tone="info" />
            {mainDeadline ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">마감</p>
                <p className="mt-1.5 text-sm font-bold text-text">{mainDeadline.label}</p>
                <p className="mt-0.5 text-[11px] text-text3">{formatDate(mainDeadline.date)}</p>
              </div>
            ) : null}
          </div>
        </aside>

        <motion.div variants={stagger} initial={false} animate="show" className="min-w-0 space-y-5">
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}

          {currentStep === 1 ? (
            <div className="space-y-5">
              <SectionCard title="공고 분석 요약" eyebrow="Analysis" desc="공고 원문에서 추출한 핵심 요구사항과 불확실한 항목을 먼저 검토합니다." action={<StatusBadge label={activeAnalysis.source_type.toUpperCase()} tone="neutral" />}>
                <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
                  <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                    <p className="text-sm leading-7 text-text2">{activeAnalysis.summary || '요약 정보가 없습니다.'}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <MetricCard label="주관/운영기관" value={activeAnalysis.organization || '확인 필요'} />
                      <MetricCard label="제출 방법" value={activeAnalysis.submission_method || '확인 필요'} tone="info" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Timeline</p>
                        <h3 className="mt-3 text-lg font-semibold text-text">{mainDeadline?.label ?? '주요 일정 없음'}</h3>
                      </div>
                      {mainDeadline ? <DayStatusBadge status={mainDeadline.status} label={formatDDay(mainDeadline.d_day)} /> : null}
                    </div>
                    {mainDeadline ? (
                      <p className="mt-3 text-sm leading-6 text-text2">{formatDate(mainDeadline.date)}{mainDeadline.is_deadline ? '까지 제출 마감으로 표시되었습니다.' : ' 일정으로 표시되었습니다.'}</p>
                    ) : (
                      <p className="mt-3 text-sm text-text2">분석 결과에 일정이 포함되지 않았습니다.</p>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="요구사항 보드" desc="지원 자격, 혜택, 평가 기준, 주의사항을 나누어 검토합니다.">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard title="지원 자격" items={activeAnalysis.eligibility} tone="info" />
                  <InfoCard title="혜택/지원 내용" items={activeAnalysis.benefits} tone="success" />
                  <InfoCard title="평가 기준" items={activeAnalysis.evaluation_criteria} tone="neutral" />
                  <InfoCard title="주의사항" items={activeAnalysis.cautions} tone="warning" />
                  <InfoCard title="불확실한 항목" items={activeAnalysis.uncertain_fields} tone="warning" emptyText="확인 필요한 불확실 항목이 없습니다." />
                </div>
              </SectionCard>

              <SectionCard title="일정과 제출서류" desc="required/optional 구분과 파일 형식 요구사항을 확인합니다.">
                <div className="grid gap-4 lg:grid-cols-[0.84fr_1fr]">
                  <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <h3 className="text-sm font-semibold text-text">일정</h3>
                    <div className="mt-4 space-y-3">
                      {activeAnalysis.timeline.length ? (
                        activeAnalysis.timeline.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-4 rounded-md border border-white/8 bg-bg/45 p-3">
                            <div>
                              <p className="text-sm font-semibold text-text">{item.label}</p>
                              <p className="mt-1 text-xs text-text3">{formatDate(item.date)}</p>
                            </div>
                            <DayStatusBadge status={item.status} label={formatDDay(item.d_day)} />
                          </div>
                        ))
                      ) : (
                        <EmptyState title="일정 정보가 없습니다." />
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <h3 className="text-sm font-semibold text-text">제출서류 체크리스트</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {activeAnalysis.checklist.length ? (
                        activeAnalysis.checklist.map((item) => (
                          <div key={item.id} className="rounded-md border border-white/8 bg-bg/45 p-3">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-text">{item.label}</p>
                              <StatusBadge label={item.category === 'required' ? '필수' : '선택'} tone={item.category === 'required' ? 'warning' : 'neutral'} />
                            </div>
                            {item.description ? <p className="text-xs leading-5 text-text3">{item.description}</p> : null}
                            {item.file_format ? <p className="mt-2 text-xs text-sky-200">{item.file_format}</p> : null}
                          </div>
                        ))
                      ) : (
                        <EmptyState title="제출서류 정보가 없습니다." />
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Source evidence" desc="중요 추출값의 원문 근거를 확인합니다.">
                <EvidenceList evidence={activeAnalysis.source_evidence ?? []} />
              </SectionCard>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <SectionCard title="필수 입력 수집" eyebrow="Input" desc="비어 있는 필수 입력을 채울수록 초안 정확도가 좋아집니다. 저장 후 섹션별 초안을 생성하세요." action={<StatusBadge label={`${requiredStats.percent}% 완료`} tone={requiredStats.percent === 100 ? 'success' : 'warning'} />}>
              <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text">필수 입력 진행률</p>
                    <p className="mt-1 text-xs text-text3">{requiredStats.total ? `${requiredStats.total - requiredStats.filled}개 항목이 남았습니다.` : '필수 입력 항목이 없습니다.'}</p>
                  </div>
                  <span className="text-sm font-semibold text-text">{requiredStats.filled}/{requiredStats.total}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#6fd3ff,#8b78ff)] transition-all" style={{ width: `${requiredStats.percent}%` }} />
                </div>
              </div>

              <div className="grid gap-4">
                {workflow.user_inputs.length ? (
                  workflow.user_inputs.map((field) => (
                    <WorkflowInputField key={field.id} field={field} value={inputValues[field.id] ?? ''} onChange={(value) => setInputValues((prev) => ({ ...prev, [field.id]: value }))} />
                  ))
                ) : (
                  <EmptyState title="추가 입력 항목이 없습니다." desc="분석 결과만으로 기본 초안을 생성할 수 있습니다." />
                )}
              </div>

              {requiredStats.missing.length > 0 ? (
                <div className="mt-5">
                  <NoticeBanner tone="warning" title="남은 필수 입력">
                    {requiredStats.missing.map((field) => field.label).join(', ')}
                  </NoticeBanner>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={handleSaveInputs} disabled={busy}>입력 저장</Button>
                <Button type="button" onClick={handleGenerateDraft} disabled={busy}>{busy ? '처리 중...' : '섹션별 초안 생성'}</Button>
              </div>
            </SectionCard>
          ) : null}

          {currentStep === 3 ? (
            <SectionCard title="섹션별 초안" eyebrow="Draft" desc="각 섹션을 검토하고 바로 최종 문서를 생성할 수 있습니다." action={<Button type="button" variant="secondary" onClick={handleGenerateDraft} disabled={busy}>초안 다시 생성</Button>}>
              <motion.div variants={stagger} initial={false} animate="show" className="space-y-4">
                {workflow.draft_sections.length ? (
                  workflow.draft_sections.map((draft) => (
                    <DraftSectionCard
                      key={draft.id}
                      draft={draft}
                      feedback={feedbackValues[draft.section_id] ?? ''}
                      onFeedbackChange={(value) => setFeedbackValues((prev) => ({ ...prev, [draft.section_id]: value }))}
                      onSaveFeedback={() => handleSaveFeedback(draft.section_id)}
                      onRevise={() => handleRevise(draft.section_id)}
                      busy={busy}
                    />
                  ))
                ) : (
                  <EmptyState title="아직 생성된 초안 섹션이 없습니다." desc="필수 입력을 저장한 뒤 섹션별 초안을 생성하세요." action={<Button type="button" onClick={handleGenerateDraft} disabled={busy}>초안 생성</Button>} />
                )}
              </motion.div>

              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={handleFinalize} disabled={busy || !canFinalize}>확인 후 최종 문서 생성</Button>
              </div>
            </SectionCard>
          ) : null}

          {currentStep === 4 ? (
            <SectionCard title="최종 문서와 export" eyebrow="Final" desc="제출 전 검토용 preview를 확인하고 HTML, HWPX, 템플릿 HWPX export를 실행합니다.">
              {!workflow.final_document ? (
                <EmptyState
                  title="최종 문서가 아직 없습니다."
                  desc="섹션별 초안을 검토한 뒤 최종 문서를 생성하세요."
                  action={<Button type="button" onClick={handleFinalize} disabled={busy || !canFinalize}>최종 문서 생성</Button>}
                />
              ) : (
                <ExportPanel
                  finalTitle={workflow.final_document.title}
                  finalContent={workflow.final_document.content_markdown}
                  templateFile={templateFile}
                  templateMap={templateMap}
                  onTemplateFile={setTemplateFile}
                  onTemplateMap={setTemplateMap}
                  onExportHtml={handleExportHtml}
                  onExportHwpx={handleExportHwpx}
                  onExportPdf={handleExportPdf}
                  onExportTemplate={handleExportTemplate}
                  onCreatePlaceholderMap={handleCreatePlaceholderMap}
                  onCopyMarkdown={handleCopyMarkdown}
                  exportHistory={exportHistory}
                  onDownloadStoredExport={handleDownloadStoredExport}
                  onRefreshExports={() => workflow ? refreshExports(workflow.id) : undefined}
                  placeholderMapPreview={placeholderMapPreview}
                  placeholderWarnings={placeholderWarnings}
                  hwpxStatus={hwpxStatus}
                  busy={busy}
                />
              )}
            </SectionCard>
          ) : null}
        </motion.div>
      </div>

      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </main>
  );
}
