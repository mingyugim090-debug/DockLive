'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  createHwpxFormSession,
  draftAllHwpxRegions,
  exportHwpxFormSession,
  getHwpxFormSession,
  previewHwpxRegionDraft,
  updateHwpxRegion,
} from '@/lib/api';
import type { ExportResponse, HwpxEditableRegion, HwpxFormSession, HwpxTemplateBlock, HwpxTemplateCell } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type WorkflowStep = 'upload' | 'edit' | 'export';
type ReviewFilter = 'all' | 'drafted' | 'revised' | 'empty';
type InlineAiAction = 'write' | 'shorten' | 'expand' | 'formal' | 'rewrite';
type AgentStageStatus = 'idle' | 'running' | 'done';

type DraftProposal = {
  regionId: string;
  content: string;
  prompt: string;
  action: InlineAiAction;
  actionLabel: string;
};

type AgentStage = {
  id: string;
  label: string;
  status: AgentStageStatus;
};

type QualityFinding = {
  id: string;
  regionId: string;
  label: string;
  message: string;
  actionPrompt: string;
};

const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
  { id: 'upload', label: '1. 양식 업로드', description: '자동화할 HWP/HWPX 원본 선택' },
  { id: 'edit', label: '2. 섹션별 지시', description: '가운데 문서에서 칸을 클릭하고 직접 입력 또는 AI 요청' },
  { id: 'export', label: '3. HWPX 생성', description: '원본 HWPX 구조에 입력값만 주입해 다운로드' },
];

const HWPX_SESSION_STORAGE_KEY = 'livedock_hwpx_form_session_id';
const agentStageLabels = ['문서 구조 분석', '전체 스토리라인 생성', '섹션 작성', '분량/톤 검수', '완료'];

const inlineActionLabels: Record<InlineAiAction, string> = {
  write: 'AI 작성',
  shorten: '짧게',
  expand: '구체화',
  formal: '제출용 문체',
  rewrite: '다시쓰기',
};

function downloadExport(exported: ExportResponse) {
  const bytes = Uint8Array.from(atob(exported.content), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: exported.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sortRegions(regions: HwpxEditableRegion[]): HwpxEditableRegion[] {
  return [...regions].sort((a, b) => {
    const orderA = Number.isFinite(a.display_order) && a.display_order > 0 ? a.display_order : 9999;
    const orderB = Number.isFinite(b.display_order) && b.display_order > 0 ? b.display_order : 9999;
    return orderA - orderB || a.label.localeCompare(b.label, 'ko');
  });
}

function regionNumber(region: HwpxEditableRegion, index: number): number {
  return Number.isFinite(region.display_order) && region.display_order > 0 ? region.display_order : index + 1;
}

function compactText(value: unknown, fallback = ''): string {
  const text = typeof value === 'string' ? value : fallback;
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function getAnalysisBlocks(session: HwpxFormSession): HwpxTemplateBlock[] {
  return Array.isArray(session.analysis.blocks) ? session.analysis.blocks : [];
}

function toNumber(value: unknown, fallback = -1): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function sourceRefNumber(region: HwpxEditableRegion, key: string): number {
  return toNumber(region.source_ref?.[key]);
}

function sourceRefText(region: HwpxEditableRegion, key: string): string {
  const value = region.source_ref?.[key];
  return typeof value === 'string' ? value : '';
}

function blockSourceRefNumber(block: HwpxTemplateBlock, key: string): number {
  return toNumber(block.source_ref?.[key]);
}

function blockSourceRefText(block: HwpxTemplateBlock, key: string): string {
  const value = block.source_ref?.[key];
  return typeof value === 'string' ? value : '';
}

function isTableRegion(region: HwpxEditableRegion, tableIndex: number, row: number, col: number): boolean {
  return (
    sourceRefText(region, 'type') === 'table_cell' &&
    sourceRefNumber(region, 'table_index') === tableIndex &&
    sourceRefNumber(region, 'row') === row &&
    sourceRefNumber(region, 'col') === col
  );
}

function cellAddress(cell: HwpxTemplateCell, rowIndex: number, cellIndex: number): { row: number; col: number } {
  const match = String(cell.id ?? '').match(/cell-(\d+)-(\d+)/);
  return {
    row: match ? Number(match[1]) : rowIndex,
    col: match ? Number(match[2]) : cellIndex,
  };
}

function reviewStatus(region: HwpxEditableRegion): Exclude<ReviewFilter, 'all'> {
  if (!region.value.trim()) return 'empty';
  return region.draft_status === 'drafted' ? 'drafted' : 'revised';
}

function reviewStatusLabel(region: HwpxEditableRegion): string {
  const status = reviewStatus(region);
  if (status === 'drafted') return 'AI 작성';
  if (status === 'revised') return '직접 수정';
  return '빈칸';
}

function filterRegionsByReview(regions: HwpxEditableRegion[], filter: ReviewFilter): HwpxEditableRegion[] {
  if (filter === 'all') return regions;
  return regions.filter((region) => reviewStatus(region) === filter);
}

function reviewStats(regions: HwpxEditableRegion[]) {
  return regions.reduce(
    (acc, region) => {
      acc[reviewStatus(region)] += 1;
      return acc;
    },
    { drafted: 0, revised: 0, empty: 0 } as Record<Exclude<ReviewFilter, 'all'>, number>,
  );
}

function isAiDrafted(region: HwpxEditableRegion | undefined | null): boolean {
  return Boolean(region?.value.trim() && region.draft_status === 'drafted');
}

function isDirectlyFilled(region: HwpxEditableRegion | undefined | null): boolean {
  return Boolean(region?.value.trim() && region.draft_status !== 'drafted');
}

function newAgentStages(status: AgentStageStatus = 'idle'): AgentStage[] {
  return agentStageLabels.map((label, index) => ({
    id: `stage-${index}`,
    label,
    status,
  }));
}

function runningAgentStages(index: number): AgentStage[] {
  return agentStageLabels.map((label, itemIndex) => ({
    id: `stage-${itemIndex}`,
    label,
    status: itemIndex < index ? 'done' : itemIndex === index ? 'running' : 'idle',
  }));
}

function completedAgentStages(): AgentStage[] {
  return newAgentStages('done');
}

function promptForInlineAction(action: InlineAiAction, region: HwpxEditableRegion, detailPrompt = ''): string {
  const base = detailPrompt.trim();
  if (action === 'write') return base || `${region.label} 항목을 제출용 문장으로 작성해줘.`;
  if (action === 'shorten') return `${region.label} 내용을 핵심만 남겨 더 짧고 명확하게 줄여줘.`;
  if (action === 'expand') return `${region.label} 내용을 근거와 맥락이 드러나도록 더 구체화해줘.`;
  if (action === 'formal') return `${region.label} 내용을 공모전 제출용 문체로 자연스럽고 전문적으로 다듬어줘.`;
  return `${region.label} 내용을 중복 없이 다시 작성해줘.`;
}

function targetCharCount(region: HwpxEditableRegion): number | null {
  const text = `${region.label} ${region.placeholder_hint} ${region.prompt}`;
  const matches: number[] = [];
  const pattern = /(\d{2,5})\s*자/g;
  let match = pattern.exec(text);
  while (match) {
    const count = Number(match[1]);
    if (count) matches.push(count);
    match = pattern.exec(text);
  }
  if (!matches.length) return null;
  return Math.max(...matches);
}

function hasGuideRemnant(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  if (compact.includes('작성안내') || compact.includes('삭제후제출')) return true;
  return /(^|\n)\s*[※*]\s*\d{2,5}\s*자\s*(이내|내외|미만|까지)?\s*작성/.test(value);
}

function looksIncompleteSentence(value: string): boolean {
  const text = compactText(value);
  if (text.length < 40) return false;
  if (/[.!?。！？]$/.test(text)) return false;
  if (/(습니다|합니다|됩니다|입니다|했습니다|하겠습니다|된다|한다|이다|다|요|함|임|됨|음)$/.test(text)) {
    return false;
  }
  return /(정확성과|효율성과|안정성과|가능성과|필요성과|그리고|또는|및|으로|로|하며|하고|통해|기반으로|중심으로)$/.test(text);
}

function scanQualityFindings(regions: HwpxEditableRegion[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const seen = new Map<string, HwpxEditableRegion>();

  for (const region of regions) {
    const value = compactText(region.value);
    const hint = compactText(region.placeholder_hint);
    if (!value) {
      findings.push({
        id: `${region.id}-empty`,
        regionId: region.id,
        label: region.label,
        message: '아직 작성되지 않은 항목입니다.',
        actionPrompt: `${region.label} 항목을 원본 작성 지침에 맞춰 작성해줘.`,
      });
      continue;
    }
    if (hint && value === hint) {
      findings.push({
        id: `${region.id}-placeholder`,
        regionId: region.id,
        label: region.label,
        message: '원본 작성 안내 문구가 그대로 남아 있습니다.',
        actionPrompt: `${region.label} 항목의 안내 문구를 제거하고 제출용 본문으로 작성해줘.`,
      });
    }
    if (hasGuideRemnant(region.value)) {
      findings.push({
        id: `${region.id}-guide`,
        regionId: region.id,
        label: region.label,
        message: '작성 안내나 placeholder 문구가 남아 있습니다.',
        actionPrompt: `${region.label} 항목에서 작성 안내와 placeholder를 제거하고 제출용 본문만 남겨줘.`,
      });
    }
    if (looksIncompleteSentence(region.value)) {
      findings.push({
        id: `${region.id}-incomplete`,
        regionId: region.id,
        label: region.label,
        message: '문장이 중간에 끊긴 것 같습니다.',
        actionPrompt: `${region.label} 항목의 마지막 문장을 완결하고, 사용자의 요청사항을 빠짐없이 반영해 다시 작성해줘.`,
      });
    }
    const targetChars = targetCharCount(region);
    if (region.kind === 'textarea' && targetChars && value.length < Math.min(targetChars * 0.45, 180)) {
      findings.push({
        id: `${region.id}-target-short`,
        regionId: region.id,
        label: region.label,
        message: '요청한 분량보다 내용이 부족합니다.',
        actionPrompt: `${region.label} 항목을 요청한 분량에 맞게 더 구체적으로 확장하되 문장을 완결해줘.`,
      });
    }
    if (region.kind === 'textarea' && value.length < 45) {
      findings.push({
        id: `${region.id}-short`,
        regionId: region.id,
        label: region.label,
        message: '서술형 항목치고 분량이 짧습니다.',
        actionPrompt: `${region.label} 내용을 제출용으로 조금 더 구체화해줘.`,
      });
    }
    if (value.length > 40) {
      const key = value.replace(/\s+/g, '').slice(0, 80);
      const previous = seen.get(key);
      if (previous) {
        findings.push({
          id: `${region.id}-duplicate`,
          regionId: region.id,
          label: region.label,
          message: `${previous.label} 항목과 내용이 비슷합니다.`,
          actionPrompt: `${region.label} 내용을 이전 항목과 겹치지 않도록 다시 작성해줘.`,
        });
      } else {
        seen.set(key, region);
      }
    }
  }

  return findings.slice(0, 8);
}


export function HwpxFormEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [session, setSession] = useState<HwpxFormSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [proposal, setProposal] = useState<DraftProposal | null>(null);
  const [agentStages, setAgentStages] = useState<AgentStage[]>(() => newAgentStages());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedRegions = useMemo(() => sortRegions(session?.regions ?? []), [session]);
  const selected = useMemo(
    () => orderedRegions.find((region) => region.id === selectedId) ?? orderedRegions[0] ?? null,
    [orderedRegions, selectedId],
  );
  const selectedProposal = proposal && selected?.id === proposal.regionId ? proposal : null;
  const qualityFindings = useMemo(() => scanQualityFindings(orderedRegions), [orderedRegions]);
  const stepIndex = workflowSteps.findIndex((item) => item.id === step);

  useEffect(() => {
    const savedSessionId = localStorage.getItem(HWPX_SESSION_STORAGE_KEY);
    if (!savedSessionId) return;
    setBusy('restore');
    getHwpxFormSession(savedSessionId)
      .then((response) => {
        const firstRegion = sortRegions(response.data.regions)[0] ?? null;
        setSession(response.data);
        setSelectedId(firstRegion?.id ?? null);
        setPrompt(firstRegion?.prompt ?? '');
        setStep(response.data.status === 'exported' ? 'export' : 'edit');
      })
      .catch(() => {
        localStorage.removeItem(HWPX_SESSION_STORAGE_KEY);
      })
      .finally(() => setBusy(null));
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    localStorage.setItem(HWPX_SESSION_STORAGE_KEY, session.id);
  }, [session?.id]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(hwp|hwpx)$/i.test(file.name)) {
      setError('HWP 또는 HWPX 파일만 업로드할 수 있습니다.');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const response = await createHwpxFormSession(file);
      const firstRegion = sortRegions(response.data.regions)[0] ?? null;
      setSession(response.data);
      setSelectedId(firstRegion?.id ?? null);
      setPrompt(firstRegion?.prompt ?? '');
      setGlobalPrompt('');
      setReviewFilter('all');
      setProposal(null);
      setAgentStages(newAgentStages());
      setStep('edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 문서를 불러오지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setSession(null);
    setSelectedId(null);
    setPrompt('');
    setGlobalPrompt('');
    setReviewFilter('all');
    setProposal(null);
    setAgentStages(newAgentStages());
    setError(null);
    setStep('upload');
    localStorage.removeItem(HWPX_SESSION_STORAGE_KEY);
  }

  function selectRegion(region: HwpxEditableRegion) {
    setSelectedId(region.id);
    setPrompt(region.prompt);
  }

  function setRegionLocal(region: HwpxEditableRegion, value: string) {
    if (!session) return;
    if (proposal?.regionId === region.id) setProposal(null);
    setSession({
      ...session,
      status: 'editing',
      regions: session.regions.map((item) =>
        item.id === region.id
          ? { ...item, value, draft_status: value.trim() ? 'revised' : 'empty' }
          : item,
      ),
    });
  }

  async function persistRegion(region: HwpxEditableRegion, value = region.value, nextPrompt = region.prompt, draftStatus?: 'empty' | 'drafted' | 'revised') {
    if (!session) return;
    const response = await updateHwpxRegion(session.id, region.id, { value, prompt: nextPrompt, draftStatus });
    setSession(response.data);
  }

  async function persistAllRegions() {
    if (!session) return;
    let latest = session;
    for (const region of session.regions) {
      const response = await updateHwpxRegion(session.id, region.id, {
        value: region.value,
        prompt: region.prompt,
      });
      latest = response.data;
    }
    setSession(latest);
    return latest;
  }

  async function generateSelectedDraft() {
    await previewSelectedDraft('write');
  }

  async function previewSelectedDraft(action: InlineAiAction, overridePrompt?: string) {
    if (!session || !selected) return;
    await previewRegionDraft(selected, action, overridePrompt);
  }

  async function previewRegionDraft(region: HwpxEditableRegion, action: InlineAiAction, overridePrompt?: string) {
    if (!session) return;
    setBusy(`draft-${action}`);
    setError(null);
    try {
      const nextPrompt = overridePrompt || promptForInlineAction(action, region, action === 'write' && region.id === selected?.id ? prompt : '');
      const response = await previewHwpxRegionDraft(session.id, region.id, {
        baseInput: region.value,
        prompt: nextPrompt,
      });
      setProposal({
        regionId: region.id,
        content: response.content,
        prompt: response.prompt || nextPrompt,
        action,
        actionLabel: inlineActionLabels[action],
      });
      setSelectedId(region.id);
      setPrompt(response.prompt || nextPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 제안 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function applyProposal() {
    if (!session || !proposal) return;
    const target = session.regions.find((region) => region.id === proposal.regionId);
    if (!target) return;
    setBusy('apply-proposal');
    setError(null);
    try {
      await persistRegion(target, proposal.content, proposal.prompt, 'drafted');
      setSelectedId(target.id);
      setPrompt(proposal.prompt);
      setProposal(null);
      setReviewFilter('drafted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 제안 적용에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function cancelProposal() {
    setProposal(null);
  }

  async function generateAllDrafts() {
    if (!session) return;
    setBusy('draft-all');
    setError(null);
    setProposal(null);
    try {
      setAgentStages(runningAgentStages(0));
      await persistAllRegions();
      setAgentStages(runningAgentStages(1));
      window.setTimeout(() => setAgentStages(runningAgentStages(2)), 80);
      const response = await draftAllHwpxRegions(session.id, {
        baseInput: globalPrompt,
        globalPrompt,
        overwriteExisting: false,
      });
      setAgentStages(runningAgentStages(3));
      const nextRegions = sortRegions(response.data.regions);
      const nextSelected = selectedId
        ? nextRegions.find((region) => region.id === selectedId) ?? nextRegions[0] ?? null
        : nextRegions[0] ?? null;
      setSession(response.data);
      setSelectedId(nextSelected?.id ?? null);
      setPrompt(nextSelected?.prompt ?? '');
      setReviewFilter('drafted');
      setAgentStages(completedAgentStages());
    } catch (err) {
      setError(err instanceof Error ? err.message : '전체 문서 자동완성에 실패했습니다.');
      setAgentStages(newAgentStages());
    } finally {
      setBusy(null);
    }
  }

  async function exportFile() {
    if (!session) return;
    setBusy('export');
    setError(null);
    try {
      await persistAllRegions();
      const exported = await exportHwpxFormSession(session.id);
      downloadExport(exported);
      setSession((current) => (current ? { ...current, status: 'exported' } : current));
      setStep('export');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 다운로드 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <WorkflowHeader step={step} stepIndex={stepIndex} onReset={reset} hasSession={Boolean(session)} busy={Boolean(busy)} />

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      {step === 'upload' ? <UploadStep inputRef={inputRef} busy={busy} onFile={handleFile} /> : null}

      {session && step !== 'upload' ? (
        <EditStep
          session={session}
          regions={orderedRegions}
          selected={selected}
          exported={step === 'export' || session.status === 'exported'}
          busy={busy}
          prompt={prompt}
          globalPrompt={globalPrompt}
          reviewFilter={reviewFilter}
          proposal={selectedProposal}
          agentStages={agentStages}
          qualityFindings={qualityFindings}
          onSelect={selectRegion}
          onPrompt={setPrompt}
          onGlobalPrompt={setGlobalPrompt}
          onReviewFilter={setReviewFilter}
          onLocalChange={setRegionLocal}
          onInlineAction={previewSelectedDraft}
          onFixQuality={(region, fixPrompt) => previewRegionDraft(region, 'rewrite', fixPrompt)}
          onApplyProposal={applyProposal}
          onCancelProposal={cancelProposal}
          onRegenerateProposal={() => proposal && previewSelectedDraft(proposal.action, proposal.prompt)}
          onSaveSelected={async () => {
            if (!selected) return;
            setBusy('save');
            try {
              await persistRegion(selected, selected.value, prompt);
              if (proposal?.regionId === selected.id) setProposal(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : '입력값 저장에 실패했습니다.');
            } finally {
              setBusy(null);
            }
          }}
          onGenerateSelected={generateSelectedDraft}
          onGenerateAll={generateAllDrafts}
          onBack={reset}
          onExport={exportFile}
        />
      ) : null}
    </div>
  );
}

function WorkflowHeader({
  step,
  stepIndex,
  onReset,
  hasSession,
  busy,
}: {
  step: WorkflowStep;
  stepIndex: number;
  onReset: () => void;
  hasSession: boolean;
  busy: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#3A7A68]">HWPX 양식 자동완성</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">
            원본 양식을 HTML처럼 클릭하고, 완성본은 HWPX로 받습니다.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
            중앙에는 업로드한 문서 구조를 재구성해 보여주고, 오른쪽 패널에서는 선택한 표 셀이나 문단에 직접 입력하거나 AI에게 작성 지시를 남깁니다.
          </p>
        </div>
        {hasSession ? (
          <Button variant="secondary" onClick={onReset} disabled={busy}>새 파일로 시작</Button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-2 md:grid-cols-3">
        {workflowSteps.map((item, index) => {
          const active = item.id === step;
          const complete = index < stepIndex;
          return (
            <div
              key={item.id}
              className={[
                'min-h-[92px] rounded-xl border px-4 py-3 transition',
                active ? 'border-[#245D50] bg-[#EDF7F2]' : complete ? 'border-[#C8DBD2] bg-[#F7FBF9]' : 'border-[#E4EBE7] bg-white',
              ].join(' ')}
            >
              <p className={['text-sm font-extrabold', active ? 'text-[#245D50]' : 'text-[#24312D]'].join(' ')}>{item.label}</p>
              <p className="mt-2 text-xs leading-5 text-[#65736E]">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UploadStep({
  inputRef,
  busy,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement>;
  busy: string | null;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-8 shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept=".hwp,.hwpx"
        data-testid="hwpx-file-input"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFile(event.dataTransfer.files?.[0]);
        }}
        className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#BFD1C9] bg-[#F8FBFA] px-6 text-center transition hover:border-[#6A9C89] hover:bg-[#F2F8F5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-base font-bold text-[#245D50]">
          {busy === 'restore' ? '이전 HWPX 세션 불러오는 중...' : busy === 'upload' ? 'HWPX파일 업로드 중...' : '자동화할 HWPX 양식 업로드'}
        </span>
        <span className="mt-3 max-w-xl text-sm leading-6 text-[#65736E]">
          HWPX를 권장하며, HWP 파일은 서버에서 HWPX로 변환한 뒤 같은 방식으로 편집합니다.
          업로드 후 문서 가운데 영역에서 각 섹션과 표 셀을 클릭할 수 있습니다.
        </span>
      </button>
    </section>
  );
}

function EditStep(props: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  exported: boolean;
  busy: string | null;
  prompt: string;
  globalPrompt: string;
  reviewFilter: ReviewFilter;
  proposal: DraftProposal | null;
  agentStages: AgentStage[];
  qualityFindings: QualityFinding[];
  onSelect: (region: HwpxEditableRegion) => void;
  onPrompt: (value: string) => void;
  onGlobalPrompt: (value: string) => void;
  onReviewFilter: (filter: ReviewFilter) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string) => void;
  onInlineAction: (action: InlineAiAction, overridePrompt?: string) => void;
  onFixQuality: (region: HwpxEditableRegion, fixPrompt: string) => void;
  onApplyProposal: () => void;
  onCancelProposal: () => void;
  onRegenerateProposal: () => void;
  onSaveSelected: () => void;
  onGenerateSelected: () => void;
  onGenerateAll: () => void;
  onBack: () => void;
  onExport: () => void;
}) {
  const filled = props.regions.filter((region) => region.value.trim()).length;
  const total = props.regions.length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm xl:col-span-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold text-[#3A7A68]">{props.session.source_filename}</p>
            <h2 className="mt-1 text-xl font-bold text-[#24312D]">문서의 섹션과 표 셀을 클릭해 채울 내용을 지정하세요.</h2>
            <p className="mt-2 text-sm leading-6 text-[#65736E]">
              개인정보처럼 짧은 칸은 직접 수정하고, 긴 서술형 칸은 AI 요청 내용을 적은 뒤 초안을 생성하면 됩니다.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-xs font-bold text-[#65736E]">전체 항목</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#24312D]">{total}개</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-[#65736E]">채워짐</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#3A7A68]">{filled}개</p>
            </div>
          </div>
        </div>
        {props.exported ? (
          <div className="mt-4 rounded-xl border border-[#BFD8CC] bg-[#F0F8F4] px-4 py-3 text-sm font-semibold text-[#245D50]">
            최종 HWPX가 생성되었습니다. 내용을 더 고치면 다시 생성할 수 있습니다.
          </div>
        ) : null}
      </section>

      <DocumentPreview
        session={props.session}
        regions={props.regions}
        selected={props.selected}
        busy={props.busy}
        proposal={props.proposal}
        qualityFindings={props.qualityFindings}
        onSelect={props.onSelect}
        onInlineAction={props.onInlineAction}
        onApplyProposal={props.onApplyProposal}
        onCancelProposal={props.onCancelProposal}
        onRegenerateProposal={props.onRegenerateProposal}
      />

      <aside className="space-y-4 xl:sticky xl:top-[92px] xl:max-h-[calc(100vh-112px)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-2 [scrollbar-gutter:stable]">
        <BatchDraftPanel
          regions={props.regions}
          busy={props.busy}
          globalPrompt={props.globalPrompt}
          agentStages={props.agentStages}
          onGlobalPrompt={props.onGlobalPrompt}
          onGenerateAll={props.onGenerateAll}
        />
        <QualityPanel findings={props.qualityFindings} regions={props.regions} onSelect={props.onSelect} onFix={props.onFixQuality} />
        <ReviewSummary
          regions={props.regions}
          filter={props.reviewFilter}
          onFilter={props.onReviewFilter}
          onSelect={props.onSelect}
        />
        <RegionEditor
          selected={props.selected}
          busy={props.busy}
          prompt={props.prompt}
          proposal={props.proposal}
          onPrompt={props.onPrompt}
          onLocalChange={props.onLocalChange}
          onApplyProposal={props.onApplyProposal}
          onCancelProposal={props.onCancelProposal}
          onRegenerateProposal={props.onRegenerateProposal}
          onSaveSelected={props.onSaveSelected}
          onGenerateSelected={props.onGenerateSelected}
        />
        <RegionProgress
          regions={props.regions}
          selected={props.selected}
          filter={props.reviewFilter}
          onFilter={props.onReviewFilter}
          onSelect={props.onSelect}
        />
        <ExportDock
          busy={props.busy}
          exported={props.exported}
          filled={filled}
          total={total}
          onExport={props.onExport}
        />
      </aside>

      <div className="flex items-center justify-between xl:col-span-2">
        <Button variant="secondary" onClick={props.onBack}>새 파일 업로드</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#65736E]">진행: {filled}/{total} 항목 완료</span>
          <Button data-testid="hwpx-export-secondary-button" onClick={props.onExport} disabled={Boolean(props.busy)}>
            {props.busy === 'export' ? 'HWPX 생성 중...' : props.exported ? '수정본 HWPX 다시 생성' : '최종 HWPX 생성'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExportDock({
  busy,
  exported,
  filled,
  total,
  onExport,
}: {
  busy: string | null;
  exported: boolean;
  filled: number;
  total: number;
  onExport: () => void;
}) {
  return (
    <section className="sticky bottom-0 z-30 -mx-2 rounded-t-2xl border border-[#DDE7E2] bg-white/95 p-4 shadow-[0_-16px_36px_rgba(36,49,45,0.10)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#3A7A68]">HWPX 최종 다운로드</p>
          <p className="mt-1 text-xs text-[#65736E]">{filled}/{total} 항목 반영됨</p>
        </div>
        {exported ? (
          <span className="rounded-full bg-[#EDF7F2] px-2.5 py-1 text-xs font-extrabold text-[#245D50]">생성 완료</span>
        ) : null}
      </div>
      <Button data-testid="hwpx-export-button" className="w-full" onClick={onExport} disabled={Boolean(busy)}>
        {busy === 'export' ? 'HWPX 생성 중...' : exported ? '수정본 HWPX 다시 다운로드' : '최종 HWPX 다운로드'}
      </Button>
    </section>
  );
}

function BatchDraftPanel({
  regions,
  busy,
  globalPrompt,
  agentStages,
  onGlobalPrompt,
  onGenerateAll,
}: {
  regions: HwpxEditableRegion[];
  busy: string | null;
  globalPrompt: string;
  agentStages: AgentStage[];
  onGlobalPrompt: (value: string) => void;
  onGenerateAll: () => void;
}) {
  const aiTargets = regions.filter((region) => {
    if (region.prompt.trim()) return true;
    if (region.value.trim()) return false;
    return region.kind === 'textarea' || Boolean(region.placeholder_hint.trim());
  }).length;

  return (
    <section className="rounded-2xl border border-[#BFD8CC] bg-[#F4FAF7] p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">전체 문서 AI 자동완성</p>
      <p className="mt-2 text-sm leading-6 text-[#24312D]">
        아래 요구사항을 기준으로 비어 있는 작성 영역을 한 번에 채웁니다. 직접 입력한 값은 유지됩니다.
      </p>
      <label className="mt-4 block">
        <span className="text-xs font-bold text-[#65736E]">전체 요구사항</span>
        <textarea
          value={globalPrompt}
          onChange={(event) => onGlobalPrompt(event.target.value)}
          className="mt-1 min-h-[110px] w-full resize-y rounded-xl border border-[#CFE0D8] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
          placeholder="예: DockLive 서비스의 HWPX 자동완성 워크플로우를 KAIST OverEdge 창업 아이디어 기술서 문체에 맞춰 작성해줘."
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#65736E]">AI 작성 대상 {aiTargets}개</span>
        <Button data-testid="hwpx-draft-all-button" onClick={onGenerateAll} disabled={Boolean(busy) || aiTargets === 0}>
          {busy === 'draft-all' ? '전체 작성 중...' : '전체 자동완성'}
        </Button>
      </div>
      {agentStages.some((stage) => stage.status !== 'idle') ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[#DDE7E2] bg-white/80 p-3">
          {agentStages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-2 text-xs">
              <span
                className={[
                  'h-2.5 w-2.5 rounded-full',
                  stage.status === 'done' ? 'bg-[#3A7A68]' : stage.status === 'running' ? 'bg-[#7A5CF0]' : 'bg-[#D7E2DD]',
                ].join(' ')}
              />
              <span className={stage.status === 'running' ? 'font-extrabold text-[#24312D]' : 'font-semibold text-[#65736E]'}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function QualityPanel({
  findings,
  regions,
  onSelect,
  onFix,
}: {
  findings: QualityFinding[];
  regions: HwpxEditableRegion[];
  onSelect: (region: HwpxEditableRegion) => void;
  onFix: (region: HwpxEditableRegion, fixPrompt: string) => void;
}) {
  if (!findings.length) {
    return (
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold text-[#3A7A68]">최종 품질 검수</p>
        <p className="mt-2 text-sm leading-6 text-[#65736E]">다운로드 전 즉시 보정이 필요한 항목이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#F0D9A6] bg-[#FFFBF0] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[#8A5A00]">최종 품질 검수</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-[#8A5A00]">{findings.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {findings.slice(0, 4).map((finding) => {
          const region = regions.find((item) => item.id === finding.regionId);
          return (
            <div key={finding.id} className="rounded-xl border border-[#F0D9A6] bg-white px-3 py-2">
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => region && onSelect(region)}
              >
                <span className="block truncate text-xs font-extrabold text-[#24312D]">{finding.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[#7A6240]">{finding.message}</span>
              </button>
              <button
                type="button"
                className="mt-2 rounded-full border border-[#E4C47D] px-3 py-1 text-xs font-bold text-[#8A5A00] transition hover:bg-[#FFF4D7]"
                onClick={() => {
                  if (!region) return;
                  onSelect(region);
                  onFix(region, finding.actionPrompt);
                }}
              >
                AI로 보정
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReviewSummary({
  regions,
  filter,
  onFilter,
  onSelect,
}: {
  regions: HwpxEditableRegion[];
  filter: ReviewFilter;
  onFilter: (filter: ReviewFilter) => void;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  const stats = reviewStats(regions);
  const firstDrafted = regions.find((region) => reviewStatus(region) === 'drafted');
  const firstEmpty = regions.find((region) => reviewStatus(region) === 'empty');
  const options: Array<{ id: ReviewFilter; label: string; count: number }> = [
    { id: 'all', label: '전체', count: regions.length },
    { id: 'drafted', label: 'AI 작성', count: stats.drafted },
    { id: 'revised', label: '직접 수정', count: stats.revised },
    { id: 'empty', label: '빈칸', count: stats.empty },
  ];

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#3A7A68]">자동완성 결과 검토</p>
          <p className="mt-2 text-sm leading-6 text-[#65736E]">
            AI가 채운 칸은 보라색으로 표시됩니다. 필요한 항목만 골라 빠르게 다시 열어볼 수 있습니다.
          </p>
        </div>
        <span className="rounded-full bg-[#F2EDFF] px-3 py-1 text-xs font-extrabold text-[#6D4BEF]">
          AI {stats.drafted}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`review-filter-${option.id}`}
              onClick={() => onFilter(option.id)}
              className={[
                'rounded-xl border px-3 py-2 text-left transition',
                active ? 'border-[#245D50] bg-[#EDF7F2]' : 'border-[#E4EBE7] bg-[#FBFCFB] hover:bg-[#F6FAF8]',
              ].join(' ')}
            >
              <span className="block text-xs font-bold text-[#65736E]">{option.label}</span>
              <span className={['mt-1 block text-lg font-extrabold', active ? 'text-[#245D50]' : 'text-[#24312D]'].join(' ')}>
                {option.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!firstDrafted}
          onClick={() => firstDrafted && onSelect(firstDrafted)}
        >
          AI 작성 첫 항목
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!firstEmpty}
          onClick={() => firstEmpty && onSelect(firstEmpty)}
        >
          빈칸 찾기
        </Button>
      </div>
    </section>
  );
}

function DocumentPreview({
  session,
  regions,
  selected,
  busy,
  proposal,
  qualityFindings,
  onSelect,
  onInlineAction,
  onApplyProposal,
  onCancelProposal,
  onRegenerateProposal,
  compact = false,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  busy: string | null;
  proposal: DraftProposal | null;
  qualityFindings: QualityFinding[];
  onSelect: (region: HwpxEditableRegion) => void;
  onInlineAction: (action: InlineAiAction, overridePrompt?: string) => void;
  onApplyProposal: () => void;
  onCancelProposal: () => void;
  onRegenerateProposal: () => void;
  compact?: boolean;
}) {
  const blocks = getAnalysisBlocks(session);
  const selectedFindings = selected ? qualityFindings.filter((finding) => finding.regionId === selected.id) : [];
  if (blocks.length) {
    return (
      <section className={[compact ? 'max-h-[720px]' : 'h-[calc(100vh-260px)] min-h-[720px]', 'overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#DDE5E1] p-6'].join(' ')}>
        <InlineAiDock
          selected={selected}
          proposal={proposal}
          busy={busy}
          findings={selectedFindings}
          onAction={onInlineAction}
          onApply={onApplyProposal}
          onCancel={onCancelProposal}
          onRegenerate={onRegenerateProposal}
        />
        <HtmlHwpxDocument
          session={session}
          blocks={blocks}
          regions={regions}
          selected={selected}
          onSelect={onSelect}
        />
      </section>
    );
  }

  return (
    <section className={[compact ? 'max-h-[720px]' : 'h-[calc(100vh-260px)] min-h-[720px]', 'overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#E2E8E5] p-5'].join(' ')}>
      <InlineAiDock
        selected={selected}
        proposal={proposal}
        busy={busy}
        findings={selectedFindings}
        onAction={onInlineAction}
        onApply={onApplyProposal}
        onCancel={onCancelProposal}
        onRegenerate={onRegenerateProposal}
      />
      <div className="mx-auto flex max-w-[920px] flex-col gap-8">
        {session.pages.map((page) => {
          const pageRegions = regions.filter((region) => region.page_index === page.page_index);
          return (
            <div key={page.page_index} className="relative mx-auto overflow-hidden bg-white shadow-[0_18px_48px_rgba(36,49,45,0.16)]">
              <img src={page.image_base64} alt={`HWPX page ${page.page_index + 1}`} className="block h-auto w-full max-w-[900px]" />
              {pageRegions.map((region, index) => {
                const active = selected?.id === region.id;
                const filled = Boolean(region.value.trim());
                const drafted = isAiDrafted(region);
                const revised = isDirectlyFilled(region);
                const number = regionNumber(region, regions.findIndex((item) => item.id === region.id));
                const height = Math.max(region.bbox.height ?? 3.4, active ? 5.2 : 3.4);
                return (
                  <button
                    key={region.id}
                    type="button"
                    title={`${number}. ${region.label}`}
                    onClick={() => onSelect(region)}
                    className={[
                      'absolute rounded-md text-left transition',
                      active
                        ? 'bg-[#0F5B4D]/10 ring-2 ring-[#0F5B4D]'
                        : drafted
                          ? 'bg-[#F2EDFF]/70 ring-2 ring-[#7A5CF0]/80 hover:bg-[#F2EDFF]'
                          : revised
                          ? 'bg-[#F5F0E6]/55 ring-1 ring-[#B58D4D]/70 hover:bg-[#F5F0E6]/75'
                          : 'bg-transparent hover:bg-[#0F5B4D]/5 hover:ring-1 hover:ring-[#0F5B4D]/50',
                    ].join(' ')}
                    style={{
                      left: `${Math.max(0, Math.min(98, region.bbox.x))}%`,
                      top: `${Math.max(0, Math.min(95, region.bbox.y))}%`,
                      width: `${Math.max(16, Math.min(99, region.bbox.width))}%`,
                      height: `${height}%`,
                    }}
                  >
                    <span
                      className={[
                        'absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border text-[11px] font-extrabold shadow-sm',
                        active
                          ? 'border-[#0F5B4D] bg-[#0F5B4D] text-white'
                          : drafted
                            ? 'border-[#7A5CF0] bg-white/95 text-[#6D4BEF]'
                            : 'border-[#245D50] bg-white/95 text-[#245D50]',
                      ].join(' ')}
                    >
                      {number}
                    </span>
                    {(active || filled) && region.value ? (
                      <span className="absolute left-12 top-1/2 max-w-[72%] -translate-y-1/2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold leading-4 text-[#24312D] shadow-sm">
                        {truncate(compactText(region.value), 70)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InlineAiDock({
  selected,
  proposal,
  busy,
  findings,
  onAction,
  onApply,
  onCancel,
  onRegenerate,
}: {
  selected: HwpxEditableRegion | null;
  proposal: DraftProposal | null;
  busy: string | null;
  findings: QualityFinding[];
  onAction: (action: InlineAiAction, overridePrompt?: string) => void;
  onApply: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
}) {
  if (!selected) return null;
  const actions: InlineAiAction[] = ['write', 'shorten', 'expand', 'formal', 'rewrite'];
  return (
    <div className="sticky top-0 z-20 mx-auto mb-4 max-w-[760px] rounded-2xl border border-[#DDE7E2] bg-white/95 p-3 shadow-[0_16px_42px_rgba(36,49,45,0.14)] backdrop-blur">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-[#245D50]">
            {selected.label}
          </span>
          {findings.length ? (
            <span className="rounded-full bg-[#FFF4D7] px-2.5 py-1 text-[11px] font-extrabold text-[#8A5A00]">
              검수 {findings.length}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2" data-testid="inline-ai-toolbar">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              data-testid={`inline-ai-${action}`}
              disabled={Boolean(busy)}
              onClick={() => onAction(action)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
                action === 'write'
                  ? 'border-[#7A5CF0] bg-[#7A5CF0] text-white hover:bg-[#684CE0]'
                  : 'border-[#DDE7E2] bg-white text-[#3F4F49] hover:bg-[#F6FAF8]',
              ].join(' ')}
            >
              {busy === `draft-${action}` ? '작성 중...' : inlineActionLabels[action]}
            </button>
          ))}
        </div>
        {proposal ? (
          <div className="rounded-xl border border-[#CDBEFF] bg-[#F7F3FF] p-3" data-testid="inline-ai-proposal">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-[#6D4BEF]">AI 제안 · {proposal.actionLabel}</p>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#6D4BEF]" onClick={onApply} disabled={Boolean(busy)}>
                  적용
                </button>
                <button type="button" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#65736E]" onClick={onRegenerate} disabled={Boolean(busy)}>
                  다시 생성
                </button>
                <button type="button" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#65736E]" onClick={onCancel} disabled={Boolean(busy)}>
                  취소
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#24312D]">{proposal.content}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HtmlHwpxDocument({
  session,
  blocks,
  regions,
  selected,
  onSelect,
}: {
  session: HwpxFormSession;
  blocks: HwpxTemplateBlock[];
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  let tableIndex = -1;
  return (
    <article className="mx-auto min-h-[1100px] w-full max-w-[760px] bg-white px-9 py-10 text-[#111827] shadow-[0_24px_70px_rgba(36,49,45,0.18)]">
      <div className="mb-4 flex items-center justify-between border-b border-[#D8E2DC] pb-3 text-[11px] text-[#65736E]">
        <span>HWPX 구조 기반 편집</span>
        <span>{session.source_filename}</span>
      </div>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'table') {
          tableIndex += 1;
          const sourceTableIndex = blockSourceRefNumber(block, 'table_index');
          return (
            <HtmlTableBlock
              key={block.id || `table-${blockIndex}`}
              block={block}
              tableIndex={sourceTableIndex >= 0 ? sourceTableIndex : tableIndex}
              regions={regions}
              selected={selected}
              onSelect={onSelect}
            />
          );
        }
        return <HtmlTextBlock key={block.id || `block-${blockIndex}`} block={block} regions={regions} selected={selected} onSelect={onSelect} />;
      })}
    </article>
  );
}

function HtmlTextBlock({
  block,
  regions,
  selected,
  onSelect,
}: {
  block: HwpxTemplateBlock;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  const text = compactText(block.text);
  if (!text) return null;
  const blockParagraphIndex = blockSourceRefNumber(block, 'paragraph_index');
  const blockSectionPath = blockSourceRefText(block, 'section_path');
  const paragraphRegion = regions.find((region) => {
    if (sourceRefText(region, 'type') !== 'paragraph') return false;
    if (blockParagraphIndex >= 0) {
      return (
        sourceRefNumber(region, 'paragraph_index') === blockParagraphIndex &&
        (!blockSectionPath || sourceRefText(region, 'section_path') === blockSectionPath)
      );
    }
    return compactText(region.label) === text || compactText(region.value) === text;
  });
  const displayText = paragraphRegion?.value || text;
  const active = selected?.id === paragraphRegion?.id;
  const drafted = isAiDrafted(paragraphRegion);
  const revised = isDirectlyFilled(paragraphRegion);
  const alignClass = block.style?.align === 'center' ? 'text-center' : block.style?.align === 'right' ? 'text-right' : 'text-left';
  const textStyle = {
    fontSize: block.style?.fontSize ? `${block.style.fontSize}px` : undefined,
    lineHeight: block.style?.lineHeight ? String(block.style.lineHeight) : undefined,
    color: typeof block.style?.color === 'string' ? block.style.color : undefined,
    fontWeight: block.style?.bold ? 700 : undefined,
  };
  const content = (
    <span className="whitespace-pre-wrap">
      {paragraphRegion ? (
        <span
          className={[
            'mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
            drafted ? 'bg-[#F2EDFF] text-[#6D4BEF]' : 'bg-[#E7F1ED] text-[#245D50]',
          ].join(' ')}
        >
          {regionNumber(paragraphRegion, regions.findIndex((item) => item.id === paragraphRegion.id))}
        </span>
      ) : null}
      {displayText}
    </span>
  );

  if (block.role === 'title' || block.type === 'heading') {
    const className = [
      'my-3 w-full rounded-md px-2 py-1 font-extrabold tracking-normal',
      block.role === 'title' ? 'text-[24px] leading-9' : 'text-[15px] leading-7',
      alignClass,
      paragraphRegion ? 'cursor-pointer hover:bg-[#F2F7F4]' : '',
      active ? 'bg-[#E7F1ED] ring-2 ring-[#245D50]' : '',
      !active && drafted ? 'bg-[#F2EDFF] ring-1 ring-[#8B6CF6]' : '',
      !active && revised ? 'bg-[#F0F8F4] ring-1 ring-[#9BCAB6]' : '',
    ].join(' ');
    return paragraphRegion ? (
      <button type="button" onClick={() => onSelect(paragraphRegion)} className={className} style={textStyle}>
        {content}
      </button>
    ) : (
      <h3 className={className} style={textStyle}>{content}</h3>
    );
  }

  const className = [
    'my-1 w-full rounded-md px-2 py-1 text-[12px] leading-6',
    alignClass,
    paragraphRegion ? 'cursor-pointer hover:bg-[#F2F7F4]' : '',
    active ? 'bg-[#E7F1ED] ring-2 ring-[#245D50]' : '',
    !active && drafted ? 'bg-[#F2EDFF] ring-1 ring-[#8B6CF6]' : '',
    !active && revised ? 'bg-[#F0F8F4] ring-1 ring-[#9BCAB6]' : '',
  ].join(' ');
  return paragraphRegion ? (
    <button type="button" onClick={() => onSelect(paragraphRegion)} className={className} style={textStyle}>
      {content}
    </button>
  ) : (
    <p className={className} style={textStyle}>{content}</p>
  );
}

function HtmlTableBlock({
  block,
  tableIndex,
  regions,
  selected,
  onSelect,
}: {
  block: HwpxTemplateBlock;
  tableIndex: number;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  return (
    <table className="my-3 w-full table-fixed border-collapse text-[12px] leading-5">
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={`${block.id}-row-${rowIndex}`}>
            {row.map((cell, cellIndex) => {
              const address = cellAddress(cell, rowIndex, cellIndex);
              const region = regions.find((item) => isTableRegion(item, tableIndex, address.row, address.col));
              const active = selected?.id === region?.id;
              const filled = Boolean(region?.value.trim());
              const drafted = isAiDrafted(region);
              const revised = isDirectlyFilled(region);
              const width = cell.width ? `${Math.max(5, Math.min(100, cell.width))}%` : undefined;
              const contentStyle = cellContentStyle(cell);
              return (
                <td
                  key={cell.id ?? `${rowIndex}-${cellIndex}`}
                  rowSpan={cell.row_span}
                  colSpan={cell.col_span}
                  className={[
                    'border border-[#1F2933] p-0 align-middle',
                    cell.background ? '' : rowIndex === 0 || cellIndex === 0 ? 'bg-[#F1F4F2]' : 'bg-white',
                  ].join(' ')}
                  style={{ width, backgroundColor: cell.background, verticalAlign: verticalAlignCss(cell.vertical_align) }}
                >
                  {region ? (
                    <button
                      type="button"
                      onClick={() => onSelect(region)}
                      className={[
                        'group relative flex w-full items-start gap-1 text-left transition',
                        active ? 'bg-[#E7F1ED] ring-2 ring-inset ring-[#245D50]' : 'hover:bg-[#F5FAF7]',
                        !active && drafted ? 'bg-[#F2EDFF] ring-2 ring-inset ring-[#8B6CF6]/80 hover:bg-[#F2EDFF]' : '',
                        !active && revised ? 'bg-[#F0F8F4] ring-1 ring-inset ring-[#9BCAB6] hover:bg-[#F0F8F4]' : '',
                        cell.align === 'center' ? 'justify-center text-center' : cell.align === 'right' ? 'justify-end text-right' : '',
                      ].join(' ')}
                      style={contentStyle}
                    >
                      <span
                        className={[
                          'mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold shadow-sm',
                          drafted ? 'text-[#6D4BEF]' : 'text-[#245D50]',
                        ].join(' ')}
                      >
                        {regionNumber(region, regions.findIndex((item) => item.id === region.id))}
                      </span>
                      <span className={['min-w-0 whitespace-pre-wrap break-words text-[12px]', filled ? 'text-[#111827]' : 'text-[#93A19B] italic'].join(' ')}>
                        {filled ? region.value : (region.placeholder_hint || '입력 필요')}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={[
                        'whitespace-pre-wrap break-words',
                        cell.align === 'center' ? 'text-center' : cell.align === 'right' ? 'text-right' : 'text-left',
                      ].join(' ')}
                      style={contentStyle}
                    >
                      {cell.text}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cellContentStyle(cell: HwpxTemplateCell) {
  const padding = cell.style?.padding ?? {};
  return {
    minHeight: cell.style?.minHeight ? `${cell.style.minHeight}px` : '32px',
    paddingLeft: `${padding.left ?? 8}px`,
    paddingRight: `${padding.right ?? 8}px`,
    paddingTop: `${padding.top ?? 6}px`,
    paddingBottom: `${padding.bottom ?? 6}px`,
    fontSize: cell.style?.fontSize ? `${cell.style.fontSize}px` : undefined,
    lineHeight: cell.style?.lineHeight ? String(cell.style.lineHeight) : undefined,
    color: cell.style?.color,
    fontWeight: cell.style?.bold ? 700 : undefined,
  };
}

function verticalAlignCss(value: HwpxTemplateCell['vertical_align']) {
  if (value === 'top') return 'top';
  if (value === 'bottom') return 'bottom';
  return 'middle';
}

function RegionEditor({
  selected,
  busy,
  prompt,
  proposal,
  onPrompt,
  onLocalChange,
  onApplyProposal,
  onCancelProposal,
  onRegenerateProposal,
  onSaveSelected,
  onGenerateSelected,
}: {
  selected: HwpxEditableRegion | null;
  busy: string | null;
  prompt: string;
  proposal: DraftProposal | null;
  onPrompt: (value: string) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string) => void;
  onApplyProposal: () => void;
  onCancelProposal: () => void;
  onRegenerateProposal: () => void;
  onSaveSelected: () => void;
  onGenerateSelected: () => void;
}) {
  const isLong = selected?.kind === 'textarea';

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">선택한 항목</p>
      {selected ? (
        <div className="mt-3 space-y-4">
          <div>
            {selected.section_heading ? (
              <p className="mb-1 text-xs font-bold text-[#8A9A94]">{selected.section_heading}</p>
            ) : null}
            <p className="text-sm font-bold text-[#24312D]">{selected.label}</p>
            {selected.placeholder_hint ? (
              <p className="mt-1 text-xs leading-5 text-[#65736E]">{selected.placeholder_hint}</p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-xs font-bold text-[#65736E]">직접 입력</span>
            <textarea
              value={selected.value}
              onChange={(event) => onLocalChange(selected, event.target.value)}
              className={[
                'mt-1 w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]',
                isLong ? 'min-h-[140px]' : 'min-h-[56px]',
              ].join(' ')}
              placeholder={selected.placeholder_hint || '내용을 입력하세요.'}
            />
          </label>

          <Button variant="secondary" className="w-full" onClick={onSaveSelected} disabled={busy === 'save'}>
            {busy === 'save' ? '저장 중...' : '직접 입력 저장'}
          </Button>

          <div className="flex items-center gap-2 text-xs text-[#B0BDB8]">
            <span className="flex-1 border-t border-[#E4EBE7]" />
            <span>또는 AI에게 작성 지시</span>
            <span className="flex-1 border-t border-[#E4EBE7]" />
          </div>
          <label className="block">
            <span className="text-xs font-bold text-[#65736E]">AI 요청 내용</span>
            <textarea
              value={prompt}
              onChange={(event) => onPrompt(event.target.value)}
              className="mt-1 min-h-[96px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-3 py-2 text-sm leading-6 outline-none focus:border-[#6A9C89]"
              placeholder={
                isLong
                  ? `예: ${selected.label}을 200자 이내 제출용 문체로 작성해줘`
                  : `예: ${selected.label}에 들어갈 값을 사용자가 준 정보 기준으로 정리해줘`
              }
            />
          </label>
          <Button onClick={onGenerateSelected} disabled={Boolean(busy)} className="w-full">
            {busy?.startsWith('draft') ? 'AI 제안 생성 중...' : 'AI 제안 만들기'}
          </Button>
          {proposal ? (
            <div className="rounded-xl border border-[#CDBEFF] bg-[#F7F3FF] p-3">
              <p className="text-xs font-extrabold text-[#6D4BEF]">AI 제안</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#24312D]">{proposal.content}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button className="px-3 py-2 text-xs" onClick={onApplyProposal} disabled={Boolean(busy)}>적용</Button>
                <Button variant="secondary" className="px-3 py-2 text-xs" onClick={onRegenerateProposal} disabled={Boolean(busy)}>다시 생성</Button>
                <Button variant="secondary" className="px-3 py-2 text-xs" onClick={onCancelProposal} disabled={Boolean(busy)}>취소</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#65736E]">왼쪽 문서에서 수정할 항목을 클릭하세요.</p>
      )}
    </section>
  );
}

function RegionProgress({
  regions,
  selected,
  filter,
  onFilter,
  onSelect,
}: {
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  filter: ReviewFilter;
  onFilter: (filter: ReviewFilter) => void;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  const stats = reviewStats(regions);
  const filteredRegions = filterRegionsByReview(regions, filter);
  const groups = groupRegionsBySection(filteredRegions);
  const options: Array<{ id: ReviewFilter; label: string; count: number }> = [
    { id: 'all', label: '전체', count: regions.length },
    { id: 'drafted', label: 'AI', count: stats.drafted },
    { id: 'revised', label: '직접', count: stats.revised },
    { id: 'empty', label: '빈칸', count: stats.empty },
  ];

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">입력 진행 상황</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onFilter(option.id)}
            className={[
              'rounded-full border px-3 py-1 text-xs font-bold transition',
              filter === option.id
                ? 'border-[#245D50] bg-[#245D50] text-white'
                : 'border-[#DDE7E2] bg-white text-[#65736E] hover:bg-[#F6FAF8]',
            ].join(' ')}
          >
            {option.label} {option.count}
          </button>
        ))}
      </div>
      <div className="mt-3 max-h-[420px] space-y-4 overflow-auto pr-1">
        {groups.length ? groups.map((group) => (
          <div key={group.heading} className="space-y-2">
            <p className="truncate px-1 text-[11px] font-extrabold text-[#8A9A94]">{group.heading}</p>
            {group.regions.map((region) => {
              const index = regions.findIndex((item) => item.id === region.id);
              const status = reviewStatus(region);
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => onSelect(region)}
                  className={[
                    'grid w-full grid-cols-[28px_1fr_auto] gap-2 rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-[#F8FBFA]',
                    selected?.id === region.id ? 'border-[#245D50] bg-[#F0F7F3] text-[#24312D]' : 'border-[#E4EBE7] text-[#65736E]',
                  ].join(' ')}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-[#245D50]">
                    {regionNumber(region, index)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{region.label}</span>
                    <span className="mt-1 block truncate text-xs">{region.value || region.placeholder_hint || '빈 값'}</span>
                  </span>
                  <span
                    className={[
                      'mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                      status === 'drafted'
                        ? 'bg-[#F2EDFF] text-[#6D4BEF]'
                        : status === 'revised'
                          ? 'bg-[#E7F1ED] text-[#245D50]'
                          : 'bg-[#F2F5F3] text-[#8A9A94]',
                    ].join(' ')}
                  >
                    {reviewStatusLabel(region)}
                  </span>
                </button>
              );
            })}
          </div>
        )) : (
          <p className="rounded-xl bg-[#F8FBFA] px-3 py-4 text-sm text-[#65736E]">선택한 검토 조건에 해당하는 항목이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function groupRegionsBySection(regions: HwpxEditableRegion[]) {
  const groups: Array<{ heading: string; regions: HwpxEditableRegion[] }> = [];
  for (const region of regions) {
    const heading = compactText(region.section_heading) || '기본 입력 항목';
    const current = groups[groups.length - 1];
    if (current?.heading === heading) {
      current.regions.push(region);
    } else {
      groups.push({ heading, regions: [region] });
    }
  }
  return groups;
}

