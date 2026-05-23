'use client';

import { useMemo, useRef, useState, type RefObject } from 'react';
import {
  createHwpxFormSession,
  draftHwpxRegion,
  draftHwpxSession,
  exportHwpxFormSession,
  updateHwpxRegion,
} from '@/lib/api';
import type { ExportResponse, HwpxEditableRegion, HwpxFormSession, HwpxSessionDraftRequest } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type WorkflowStep = 'upload' | 'request' | 'edit' | 'download';
type RegionUiStatus = 'position' | 'drafted' | 'revised' | 'filled' | 'empty';

const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
  { id: 'upload', label: '양식 업로드', description: 'HWP/HWPX 원본 선택' },
  { id: 'request', label: 'AI 요청 입력', description: '공고 목적과 핵심 정보 입력' },
  { id: 'edit', label: '원본 화면 검토', description: '클릭해서 세부 수정' },
  { id: 'download', label: 'HWPX 다운로드', description: '구조 검증 후 저장' },
];

const emptyRequest: HwpxSessionDraftRequest = {
  brief: '',
  facts: '',
  tone: '공공기관 공고문 문체로 간결하고 정확하게 작성',
  constraints: '제공된 사실만 사용하고 날짜, 금액, 서명, 연락처는 임의로 만들지 않기',
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
    return orderA - orderB || a.page_index - b.page_index || a.label.localeCompare(b.label, 'ko');
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
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 1))}...` : value;
}

function sourceRefText(region: HwpxEditableRegion, key: string): string {
  const value = region.source_ref?.[key];
  return typeof value === 'string' ? value : '';
}

function bboxStatus(region: HwpxEditableRegion): string {
  return sourceRefText(region, 'bbox_status') || 'unknown';
}

function statusOf(region: HwpxEditableRegion): RegionUiStatus {
  const status = bboxStatus(region);
  if (status === 'unmatched' || status === 'fallback') return 'position';
  if (region.draft_status === 'drafted') return 'drafted';
  if (region.draft_status === 'revised') return 'revised';
  if (region.value.trim()) return 'filled';
  return 'empty';
}

function statusLabel(region: HwpxEditableRegion): string {
  switch (statusOf(region)) {
    case 'position':
      return '위치 확인';
    case 'drafted':
      return 'AI 작성';
    case 'revised':
      return '직접 수정';
    case 'filled':
      return '원본 값';
    default:
      return '빈칸';
  }
}

function statusClass(region: HwpxEditableRegion, active = false): string {
  if (active) return 'border-[#0F5B4D] bg-[#0F5B4D]/12 ring-2 ring-[#0F5B4D]';
  switch (statusOf(region)) {
    case 'position':
      return 'border-dashed border-[#DC2626] bg-[#FEF2F2]/45 hover:bg-[#FEE2E2]/70';
    case 'drafted':
      return 'border-[#2563EB] bg-[#DBEAFE]/45 hover:bg-[#DBEAFE]/70';
    case 'revised':
      return 'border-[#B45309] bg-[#FEF3C7]/55 hover:bg-[#FEF3C7]/80';
    case 'filled':
      return 'border-[#6A9C89] bg-[#ECFDF5]/40 hover:bg-[#ECFDF5]/70';
    default:
      return 'border-[#245D50] bg-transparent hover:bg-[#0F5B4D]/8';
  }
}

function safePct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function localDraftText(session: HwpxFormSession, region: HwpxEditableRegion, baseInput: string, promptText: string): string {
  const facts = [baseInput, region.value].filter(Boolean).join('\n').trim();
  if (region.kind === 'text' || region.kind === 'checkbox' || region.kind === 'signature') {
    return facts || promptText || `${region.label} 입력값`;
  }
  return [
    `${session.analysis.title || session.source_filename}의 ${region.label} 항목 초안입니다.`,
    facts || '제공된 요청사항을 바탕으로 목적, 대상, 일정, 제출 방법을 공공문서 문체로 정리합니다.',
    promptText ? `요청사항: ${promptText}` : '확인되지 않은 사실은 임의로 추가하지 않습니다.',
  ].join('\n');
}

export function HwpxFormEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [session, setSession] = useState<HwpxFormSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [request, setRequest] = useState<HwpxSessionDraftRequest>(emptyRequest);
  const [baseInput, setBaseInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState<string[]>([]);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [dirtyRegionIds, setDirtyRegionIds] = useState<Set<string>>(new Set());

  const orderedRegions = useMemo(() => sortRegions(session?.regions ?? []), [session]);
  const selected = useMemo(
    () => orderedRegions.find((region) => region.id === selectedId) ?? orderedRegions[0] ?? null,
    [orderedRegions, selectedId],
  );
  const stepIndex = Math.max(0, workflowSteps.findIndex((item) => item.id === step));
  const filledCount = orderedRegions.filter((region) => region.value.trim()).length;
  const draftedCount = orderedRegions.filter((region) => region.draft_status === 'drafted').length;
  const positionReviewRegions = orderedRegions.filter((region) => statusOf(region) === 'position');

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(hwp|hwpx)$/i.test(file.name)) {
      setError('HWP 또는 HWPX 파일만 업로드할 수 있습니다.');
      return;
    }
    setBusy('upload');
    setError(null);
    setAiSummary('');
    setConfirmationRequired([]);
    setDownloadMessage('');
    try {
      const response = await createHwpxFormSession(file);
      const firstRegion = sortRegions(response.data.regions)[0] ?? null;
      setSession(response.data);
      setSelectedId(firstRegion?.id ?? null);
      setRequest(emptyRequest);
      setBaseInput(firstRegion?.value ?? '');
      setPrompt(firstRegion?.prompt ?? '');
      setDirtyRegionIds(new Set());
      setStep('request');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 문서를 불러오지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setSession(null);
    setSelectedId(null);
    setRequest(emptyRequest);
    setBaseInput('');
    setPrompt('');
    setError(null);
    setAiSummary('');
    setConfirmationRequired([]);
    setDownloadMessage('');
    setDirtyRegionIds(new Set());
    setStep('upload');
  }

  function selectRegion(region: HwpxEditableRegion) {
    setSelectedId(region.id);
    setBaseInput(region.value);
    setPrompt(region.prompt);
  }

  function updateRequest(id: keyof HwpxSessionDraftRequest, value: string) {
    setRequest((current) => ({ ...current, [id]: value }));
  }

  function setRegionLocal(region: HwpxEditableRegion, value: string, nextPrompt = prompt) {
    if (!session) return;
    setSession({
      ...session,
      status: 'editing',
      regions: session.regions.map((item) =>
        item.id === region.id
          ? { ...item, value, prompt: nextPrompt, draft_status: value.trim() ? 'revised' : 'empty' }
          : item,
      ),
    });
    setDirtyRegionIds((current) => new Set(current).add(region.id));
    if (region.id === selectedId) {
      setBaseInput(value);
      setPrompt(nextPrompt);
    }
  }

  async function persistRegion(region: HwpxEditableRegion, value = region.value, nextPrompt = region.prompt) {
    if (!session) return session;
    const response = await updateHwpxRegion(session.id, region.id, { value, prompt: nextPrompt });
    setSession(response.data);
    setDirtyRegionIds((current) => {
      const next = new Set(current);
      next.delete(region.id);
      return next;
    });
    return response.data;
  }

  async function persistDirtyRegions(current = session) {
    if (!current || dirtyRegionIds.size === 0) return current;
    let latest = current;
    for (const regionId of Array.from(dirtyRegionIds)) {
      const region = latest.regions.find((item) => item.id === regionId);
      if (!region) continue;
      const response = await updateHwpxRegion(latest.id, region.id, {
        value: region.value,
        prompt: region.prompt,
      });
      latest = response.data;
    }
    setSession(latest);
    setDirtyRegionIds(new Set());
    return latest;
  }

  async function generateCompleteDraft() {
    if (!session) return;
    setBusy('complete');
    setError(null);
    try {
      const latest = await persistDirtyRegions();
      if (!latest) return;
      const response = await draftHwpxSession(latest.id, request);
      const sorted = sortRegions(response.data.regions);
      setSession(response.data);
      setAiSummary(response.ai_summary);
      setConfirmationRequired(response.confirmation_required);
      setSelectedId(sorted.find((region) => region.draft_status === 'drafted')?.id ?? sorted[0]?.id ?? null);
      setDirtyRegionIds(new Set());
      setStep('edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 전체 작성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function generateSelectedDraft() {
    if (!session || !selected) return;
    setBusy('draft');
    setError(null);
    try {
      const nextPrompt = prompt || selected.prompt || `${selected.label} 항목을 공고문 문체에 맞게 작성해줘.`;
      const nextBaseInput = [baseInput, selected.value, request.brief, request.facts].filter(Boolean).join('\n\n');
      await persistRegion(selected, selected.value, nextPrompt);
      const response = await draftHwpxRegion(session.id, selected.id, {
        baseInput: nextBaseInput,
        prompt: nextPrompt,
      });
      const updated = response.data.regions.find((region) => region.id === selected.id);
      setSession(response.data);
      setSelectedId(selected.id);
      setBaseInput(updated?.value ?? baseInput);
      setPrompt(updated?.prompt ?? nextPrompt);
    } catch (err) {
      const fallback = localDraftText(session, selected, baseInput, prompt);
      setRegionLocal(selected, fallback, prompt);
      setError(
        err instanceof Error
          ? `${err.message} 로컬 초안으로 먼저 반영했습니다.`
          : 'AI 초안 생성 응답이 지연되어 로컬 초안으로 먼저 반영했습니다.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setBusy('save');
    setError(null);
    try {
      const updated = await persistRegion(selected, selected.value, prompt);
      const current = updated?.regions.find((region) => region.id === selected.id);
      setBaseInput(current?.value ?? selected.value);
      setPrompt(current?.prompt ?? prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : '선택한 입력칸을 저장하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function exportFile() {
    if (!session) return;
    setBusy('export');
    setError(null);
    setDownloadMessage('');
    try {
      const latest = await persistDirtyRegions();
      if (!latest) return;
      const exported = await exportHwpxFormSession(latest.id);
      downloadExport(exported);
      setSession({ ...latest, status: 'exported' });
      setDownloadMessage('구조 검증을 통과한 HWPX 파일을 생성했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 다운로드 파일을 생성하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF3F1] text-[#172033]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-5 py-5 lg:px-8">
        <WorkflowHeader stepIndex={stepIndex} />

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {step === 'upload' ? (
          <UploadStep inputRef={inputRef} busy={busy} onFile={handleFile} />
        ) : null}

        {session && step === 'request' ? (
          <RequestStep
            session={session}
            request={request}
            busy={busy}
            filledCount={filledCount}
            draftedCount={draftedCount}
            positionReviewCount={positionReviewRegions.length}
            onChange={updateRequest}
            onReset={reset}
            onSkip={() => setStep('edit')}
            onGenerate={generateCompleteDraft}
          />
        ) : null}

        {session && step === 'edit' ? (
          <EditStep
            session={session}
            regions={orderedRegions}
            selected={selected}
            busy={busy}
            baseInput={baseInput}
            prompt={prompt}
            aiSummary={aiSummary}
            confirmationRequired={confirmationRequired}
            positionReviewRegions={positionReviewRegions}
            filledCount={filledCount}
            draftedCount={draftedCount}
            onSelect={selectRegion}
            onBaseInput={setBaseInput}
            onPrompt={setPrompt}
            onLocalChange={setRegionLocal}
            onSaveSelected={saveSelected}
            onGenerateSelected={generateSelectedDraft}
            onBack={() => setStep('request')}
            onDownloadStep={() => setStep('download')}
          />
        ) : null}

        {session && step === 'download' ? (
          <DownloadStep
            session={session}
            regions={orderedRegions}
            selected={selected}
            busy={busy}
            confirmationRequired={confirmationRequired}
            downloadMessage={downloadMessage}
            onSelect={selectRegion}
            onBack={() => setStep('edit')}
            onDownload={exportFile}
          />
        ) : null}
      </div>
    </main>
  );
}

function WorkflowHeader({ stepIndex }: { stepIndex: number }) {
  return (
    <header className="rounded-lg border border-[#DDE4EA] bg-white px-5 py-4 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#2563EB]">업로드 기반 HWPX 공고문 작성</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-normal text-[#172033]">
            원본 양식 위에서 채우고, 같은 구조의 HWPX로 다운로드합니다.
          </h1>
        </div>
        <div className="grid gap-2 md:grid-cols-4 lg:min-w-[720px]">
          {workflowSteps.map((item, index) => {
            const active = index === stepIndex;
            const done = index < stepIndex;
            return (
              <div
                key={item.id}
                className={[
                  'rounded-md border px-3 py-2',
                  active
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#172033]'
                    : done
                      ? 'border-[#B7E4D1] bg-[#ECFDF5] text-[#0F5B4D]'
                      : 'border-[#E3E8EF] bg-[#F8FAFC] text-[#64748B]',
                ].join(' ')}
              >
                <p className="text-xs font-extrabold">{item.label}</p>
                <p className="mt-1 text-[11px] font-semibold leading-4">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </header>
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
    <section className="grid min-h-[620px] gap-5 lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col justify-center rounded-lg border border-[#DDE4EA] bg-white p-8 shadow-panel">
        <p className="text-sm font-bold text-[#2563EB]">양식 업로드</p>
        <h2 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight tracking-normal text-[#172033]">
          사용하던 HWPX/HWP 양식을 올리면 원본 화면 그대로 편집을 시작합니다.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#475569]">
          표, 병합 셀, 마지막 서명란은 원본 렌더링 이미지를 기준으로 보여주고 입력 가능한 영역만 위에 얹습니다.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".hwp,.hwpx"
            className="hidden"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={busy === 'upload'}>
            {busy === 'upload' ? '원본 불러오는 중...' : 'HWPX/HWP 파일 선택'}
          </Button>
          <p className="text-sm font-semibold text-[#64748B]">업로드 후 입력칸과 원본 미리보기 상태만 보여줍니다.</p>
        </div>
      </div>
      <div className="rounded-lg border border-[#DDE4EA] bg-[#F8FAFC] p-5 shadow-panel">
        <h3 className="text-lg font-extrabold text-[#172033]">MVP 워크플로우</h3>
        <div className="mt-4 space-y-3">
          {workflowSteps.map((item, index) => (
            <div key={item.id} className="grid grid-cols-[34px_1fr] gap-3 rounded-md bg-white p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#172033] text-sm font-extrabold text-white">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-extrabold text-[#172033]">{item.label}</span>
                <span className="mt-1 block text-sm leading-5 text-[#64748B]">{item.description}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RequestStep({
  session,
  request,
  busy,
  filledCount,
  draftedCount,
  positionReviewCount,
  onChange,
  onReset,
  onSkip,
  onGenerate,
}: {
  session: HwpxFormSession;
  request: HwpxSessionDraftRequest;
  busy: string | null;
  filledCount: number;
  draftedCount: number;
  positionReviewCount: number;
  onChange: (id: keyof HwpxSessionDraftRequest, value: string) => void;
  onReset: () => void;
  onSkip: () => void;
  onGenerate: () => void;
}) {
  const disabled = busy === 'complete' || (!request.brief.trim() && !request.facts.trim());
  return (
    <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <SessionSnapshot
        session={session}
        filledCount={filledCount}
        draftedCount={draftedCount}
        positionReviewCount={positionReviewCount}
      />
      <div className="rounded-lg border border-[#DDE4EA] bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-2 border-b border-[#E3E8EF] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold text-[#2563EB]">AI 요청 입력</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-normal text-[#172033]">
              공고문에 반드시 들어갈 내용을 한 번에 입력하세요.
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onReset}>다시 업로드</Button>
            <Button variant="secondary" onClick={onSkip}>직접 검토</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <FieldTextarea
            label="공고 목적"
            value={request.brief}
            onChange={(value) => onChange('brief', value)}
            placeholder="예: 지역 청년 창업팀을 모집하고 시제품 제작비와 멘토링을 지원하는 공고문"
            rows={4}
          />
          <FieldTextarea
            label="핵심 정보"
            value={request.facts}
            onChange={(value) => onChange('facts', value)}
            placeholder={'기관명, 사업명, 신청 기간, 지원 대상, 지원 내용, 제출 방법, 문의처를 줄 단위로 적어주세요.'}
            rows={8}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FieldTextarea
              label="작성 톤"
              value={request.tone}
              onChange={(value) => onChange('tone', value)}
              placeholder="공공기관 공고문 문체, 간결하고 명확하게"
              rows={4}
            />
            <FieldTextarea
              label="주의사항"
              value={request.constraints}
              onChange={(value) => onChange('constraints', value)}
              placeholder="제공되지 않은 날짜, 금액, 연락처, 서명자는 임의 생성하지 않기"
              rows={4}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={onGenerate} disabled={disabled}>
            {busy === 'complete' ? '전체 양식 작성 중...' : 'AI로 전체 채우기'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function EditStep({
  session,
  regions,
  selected,
  busy,
  baseInput,
  prompt,
  aiSummary,
  confirmationRequired,
  positionReviewRegions,
  filledCount,
  draftedCount,
  onSelect,
  onBaseInput,
  onPrompt,
  onLocalChange,
  onSaveSelected,
  onGenerateSelected,
  onBack,
  onDownloadStep,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  busy: string | null;
  baseInput: string;
  prompt: string;
  aiSummary: string;
  confirmationRequired: string[];
  positionReviewRegions: HwpxEditableRegion[];
  filledCount: number;
  draftedCount: number;
  onSelect: (region: HwpxEditableRegion) => void;
  onBaseInput: (value: string) => void;
  onPrompt: (value: string) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string, prompt?: string) => void;
  onSaveSelected: () => void;
  onGenerateSelected: () => void;
  onBack: () => void;
  onDownloadStep: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <DocumentPreview session={session} regions={regions} selected={selected} onSelect={onSelect} />
      <aside className="space-y-4">
        <SessionSnapshot
          session={session}
          filledCount={filledCount}
          draftedCount={draftedCount}
          positionReviewCount={positionReviewRegions.length}
        />
        {aiSummary ? <InfoPanel title="AI 작성 요약" lines={[aiSummary]} /> : null}
        {confirmationRequired.length ? <InfoPanel title="직접 확인 필요" lines={confirmationRequired} tone="warning" /> : null}
        <RegionEditor
          selected={selected}
          busy={busy}
          baseInput={baseInput}
          prompt={prompt}
          onBaseInput={onBaseInput}
          onPrompt={onPrompt}
          onLocalChange={onLocalChange}
          onSaveSelected={onSaveSelected}
          onGenerateSelected={onGenerateSelected}
        />
        <RegionProgress regions={regions} selected={selected} onSelect={onSelect} />
        {positionReviewRegions.length ? <PositionReviewList regions={positionReviewRegions} onSelect={onSelect} /> : null}
        <div className="flex justify-between gap-2 rounded-lg border border-[#DDE4EA] bg-white p-3 shadow-panel">
          <Button variant="secondary" onClick={onBack}>요청 수정</Button>
          <Button onClick={onDownloadStep}>다운로드 단계</Button>
        </div>
      </aside>
    </div>
  );
}

function DownloadStep({
  session,
  regions,
  selected,
  busy,
  confirmationRequired,
  downloadMessage,
  onSelect,
  onBack,
  onDownload,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  busy: string | null;
  confirmationRequired: string[];
  downloadMessage: string;
  onSelect: (region: HwpxEditableRegion) => void;
  onBack: () => void;
  onDownload: () => void;
}) {
  const filled = regions.filter((region) => region.value.trim()).length;
  const drafted = regions.filter((region) => region.draft_status === 'drafted').length;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#DDE4EA] bg-white p-5 shadow-panel">
        <p className="text-xs font-bold text-[#2563EB]">다운로드 전 확인</p>
        <h2 className="mt-1 text-2xl font-extrabold text-[#172033]">
          원본 HWPX 구조를 보존한 완성 파일을 생성합니다.
        </h2>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <Metric label="전체 입력칸" value={`${regions.length}개`} />
          <Metric label="작성 완료" value={`${filled}개`} />
          <Metric label="AI 작성" value={`${drafted}개`} />
          <Metric label="구조 검증" value="다운로드 시 실행" />
        </div>
        {confirmationRequired.length ? (
          <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {confirmationRequired.map((item) => <p key={item}>{item}</p>)}
          </div>
        ) : null}
        {downloadMessage ? <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{downloadMessage}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onBack}>다시 수정</Button>
          <Button onClick={onDownload} disabled={Boolean(busy)}>
            {busy === 'export' ? 'HWPX 검증 및 생성 중...' : 'HWPX 다운로드'}
          </Button>
        </div>
      </section>
      <DocumentPreview session={session} regions={regions} selected={selected} onSelect={onSelect} compact />
    </div>
  );
}

function DocumentPreview({
  session,
  regions,
  selected,
  onSelect,
  compact = false,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
  compact?: boolean;
}) {
  if (!session.pages.length) {
    return (
      <section className="flex min-h-[520px] items-center justify-center rounded-lg border border-[#DDE4EA] bg-white p-6 text-center shadow-panel">
        <div>
          <p className="text-lg font-extrabold text-[#172033]">원본 미리보기를 만들지 못했습니다.</p>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">오른쪽 입력 영역 목록에서 값을 검토하고 저장할 수 있습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={[compact ? 'max-h-[760px]' : 'h-[calc(100vh-230px)] min-h-[720px]', 'overflow-auto rounded-lg border border-[#DDE4EA] bg-[#E2E8F0] p-5 shadow-panel'].join(' ')}>
      <div className="mx-auto flex max-w-[980px] flex-col gap-8">
        {session.pages.map((page) => {
          const pageRegions = regions.filter((region) => region.page_index === page.page_index);
          return (
            <div
              key={page.page_index}
              className="relative mx-auto overflow-hidden bg-white shadow-[0_18px_48px_rgba(36,49,45,0.16)]"
            >
              <img src={page.image_base64} alt={`HWPX page ${page.page_index + 1}`} className="block h-auto w-full max-w-[920px]" />
              {pageRegions.map((region) => {
                const active = selected?.id === region.id;
                const globalIndex = regions.findIndex((item) => item.id === region.id);
                const number = regionNumber(region, globalIndex);
                return (
                  <button
                    key={region.id}
                    type="button"
                    title={`${number}. ${region.label} - ${statusLabel(region)}`}
                    onClick={() => onSelect(region)}
                    className={[
                      'absolute border text-left transition',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]',
                      statusClass(region, active),
                    ].join(' ')}
                    style={{
                      left: `${safePct(region.bbox.x, 0, 98)}%`,
                      top: `${safePct(region.bbox.y, 0, 98)}%`,
                      width: `${safePct(region.bbox.width, 1.8, 100)}%`,
                      height: `${safePct(region.bbox.height, 1.6, 100)}%`,
                    }}
                  >
                    <span className="absolute left-0 top-0 flex h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-[#172033] px-1 text-[10px] font-extrabold text-white shadow-sm">
                      {number}
                    </span>
                    {active ? (
                      <span className="absolute left-2 top-full z-20 mt-1 max-w-[260px] rounded-md bg-[#172033] px-2 py-1 text-[11px] font-semibold leading-4 text-white shadow-lg">
                        {truncate(region.label, 42)}
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

function SessionSnapshot({
  session,
  filledCount,
  draftedCount,
  positionReviewCount,
}: {
  session: HwpxFormSession;
  filledCount: number;
  draftedCount: number;
  positionReviewCount: number;
}) {
  const title = compactText(session.analysis.title, session.source_filename);
  const previewState = session.pages.length ? `${session.pages.length}쪽 생성됨` : '미리보기 없음';
  return (
    <section className="rounded-lg border border-[#DDE4EA] bg-white p-4 shadow-panel">
      <p className="text-xs font-bold text-[#2563EB]">문서 상태</p>
      <h2 className="mt-1 text-lg font-extrabold leading-6 text-[#172033]">{truncate(title, 52)}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="파일명" value={truncate(session.source_filename, 28)} />
        <Metric label="입력칸" value={`${session.regions.length}개`} />
        <Metric label="작성 완료" value={`${filledCount}개`} />
        <Metric label="AI 작성" value={`${draftedCount}개`} />
        <Metric label="원본 미리보기" value={previewState} />
        <Metric label="확인 필요 위치" value={`${positionReviewCount}개`} />
      </div>
      {session.warnings.length ? (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
          {session.warnings.slice(0, 2).map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
    </section>
  );
}

function InfoPanel({ title, lines, tone = 'info' }: { title: string; lines: string[]; tone?: 'info' | 'warning' }) {
  const warning = tone === 'warning';
  return (
    <section className={[
      'rounded-lg border p-4 shadow-panel',
      warning ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-[#DDE4EA] bg-white text-[#172033]',
    ].join(' ')}>
      <p className={warning ? 'text-xs font-bold text-amber-800' : 'text-xs font-bold text-[#2563EB]'}>{title}</p>
      <div className="mt-2 space-y-1 text-sm font-semibold leading-6">
        {lines.map((line) => <p key={line}>{line}</p>)}
      </div>
    </section>
  );
}

function RegionEditor({
  selected,
  busy,
  baseInput,
  prompt,
  onBaseInput,
  onPrompt,
  onLocalChange,
  onSaveSelected,
  onGenerateSelected,
}: {
  selected: HwpxEditableRegion | null;
  busy: string | null;
  baseInput: string;
  prompt: string;
  onBaseInput: (value: string) => void;
  onPrompt: (value: string) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string, prompt?: string) => void;
  onSaveSelected: () => void;
  onGenerateSelected: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#DDE4EA] bg-white p-4 shadow-panel">
      <p className="text-xs font-bold text-[#64748B]">선택한 입력 영역</p>
      {selected ? (
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-sm font-extrabold text-[#172033]">{selected.label}</p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">{statusLabel(selected)}</p>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-[#64748B]">입력 내용</span>
            <textarea
              value={selected.value}
              onChange={(event) => onLocalChange(selected, event.target.value, prompt)}
              className="mt-1 min-h-[150px] w-full resize-y rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm leading-6 text-[#172033] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#DBEAFE]"
              placeholder="이 영역에 들어갈 내용을 입력하세요."
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onSaveSelected} disabled={busy === 'save'}>
              {busy === 'save' ? '저장 중...' : '저장'}
            </Button>
            <Button onClick={onGenerateSelected} disabled={busy === 'draft'}>
              {busy === 'draft' ? '작성 중...' : '선택 칸 AI 도움'}
            </Button>
          </div>
          <details className="rounded-md border border-[#E3E8EF] bg-[#F8FAFC] px-3 py-2">
            <summary className="cursor-pointer text-sm font-bold text-[#172033]">선택 칸 보정 옵션</summary>
            <div className="mt-3 space-y-3">
              <FieldTextarea label="참고 정보" value={baseInput} onChange={onBaseInput} placeholder="이 칸에만 반영할 사실을 적어주세요." rows={3} />
              <FieldTextarea
                label="요청 문장"
                value={prompt}
                onChange={(value) => {
                  onPrompt(value);
                  onLocalChange(selected, selected.value, value);
                }}
                placeholder="예: 제출 안내 문체로 짧고 구체적으로 정리"
                rows={3}
              />
            </div>
          </details>
          {sourceRefText(selected, 'xml_path') || sourceRefText(selected, 'cell_addr') ? (
            <div className="rounded-md bg-[#F8FAFC] px-3 py-2 text-xs leading-5 text-[#64748B]">
              {sourceRefText(selected, 'xml_path') ? <p>XML: {sourceRefText(selected, 'xml_path')}</p> : null}
              {sourceRefText(selected, 'cell_addr') ? <p>셀: {sourceRefText(selected, 'cell_addr')}</p> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#64748B]">왼쪽 원본 화면에서 수정할 영역을 선택하세요.</p>
      )}
    </section>
  );
}

function RegionProgress({
  regions,
  selected,
  onSelect,
}: {
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  return (
    <section className="rounded-lg border border-[#DDE4EA] bg-white p-4 shadow-panel">
      <p className="text-xs font-bold text-[#64748B]">입력 영역 목록</p>
      <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
        {regions.map((region, index) => (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region)}
            className={[
              'grid w-full grid-cols-[28px_1fr_auto] gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-[#F8FAFC]',
              selected?.id === region.id ? 'border-[#2563EB] bg-[#EFF6FF] text-[#172033]' : 'border-[#E3E8EF] text-[#64748B]',
            ].join(' ')}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-[#2563EB]">
              {regionNumber(region, index)}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{region.label}</span>
              <span className="mt-1 block truncate text-xs">{region.value || '빈 값'}</span>
            </span>
            <span className="mt-0.5 rounded-full bg-[#F1F5F9] px-2 py-1 text-[10px] font-bold text-[#475569]">{statusLabel(region)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PositionReviewList({ regions, onSelect }: { regions: HwpxEditableRegion[]; onSelect: (region: HwpxEditableRegion) => void }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-panel">
      <p className="text-xs font-bold text-amber-800">위치 확인 필요</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
        원본 좌표 매칭이 약한 영역입니다. 선택해서 실제 위치와 입력값을 확인하세요.
      </p>
      <div className="mt-3 max-h-[180px] space-y-2 overflow-auto pr-1">
        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region)}
            className="w-full rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-left text-xs font-semibold leading-5 text-amber-900 hover:bg-white"
          >
            {region.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#475569]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full resize-y rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm leading-6 text-[#172033] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#DBEAFE]"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E3E8EF] bg-[#F8FAFC] p-3">
      <p className="text-[11px] font-bold text-[#64748B]">{label}</p>
      <p className="mt-1 truncate text-base font-extrabold text-[#172033]">{value}</p>
    </div>
  );
}
