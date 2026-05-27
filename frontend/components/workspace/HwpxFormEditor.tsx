'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  createHwpxFormSession,
  draftAllHwpxRegions,
  draftHwpxRegion,
  exportHwpxFormSession,
  getHwpxFormSession,
  updateHwpxRegion,
} from '@/lib/api';
import type { ExportResponse, HwpxEditableRegion, HwpxFormSession, HwpxTemplateBlock, HwpxTemplateCell } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type WorkflowStep = 'upload' | 'edit' | 'export';

const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
  { id: 'upload', label: '1. 양식 업로드', description: '자동화할 HWP/HWPX 원본 선택' },
  { id: 'edit', label: '2. 섹션별 지시', description: '가운데 문서에서 칸을 클릭하고 직접 입력 또는 AI 요청' },
  { id: 'export', label: '3. HWPX 생성', description: '원본 HWPX 구조에 입력값만 주입해 다운로드' },
];

const HWPX_SESSION_STORAGE_KEY = 'livedock_hwpx_form_session_id';

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


export function HwpxFormEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [session, setSession] = useState<HwpxFormSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedRegions = useMemo(() => sortRegions(session?.regions ?? []), [session]);
  const selected = useMemo(
    () => orderedRegions.find((region) => region.id === selectedId) ?? orderedRegions[0] ?? null,
    [orderedRegions, selectedId],
  );
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

  async function persistRegion(region: HwpxEditableRegion, value = region.value, nextPrompt = region.prompt) {
    if (!session) return;
    const response = await updateHwpxRegion(session.id, region.id, { value, prompt: nextPrompt });
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
    if (!session || !selected) return;
    setBusy('draft');
    setError(null);
    try {
      const nextPrompt = prompt || `${selected.label} 항목을 제출용 문장으로 작성해줘.`;
      await persistRegion(selected, selected.value, nextPrompt);
      const response = await draftHwpxRegion(session.id, selected.id, {
        baseInput: selected.value,
        prompt: nextPrompt,
      });
      const updated = response.data.regions.find((region) => region.id === selected.id);
      setSession(response.data);
      setSelectedId(selected.id);
      setPrompt(updated?.prompt ?? nextPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 초안 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function generateAllDrafts() {
    if (!session) return;
    setBusy('draft-all');
    setError(null);
    try {
      await persistAllRegions();
      const response = await draftAllHwpxRegions(session.id, {
        baseInput: globalPrompt,
        globalPrompt,
        overwriteExisting: false,
      });
      const nextRegions = sortRegions(response.data.regions);
      const nextSelected = selectedId
        ? nextRegions.find((region) => region.id === selectedId) ?? nextRegions[0] ?? null
        : nextRegions[0] ?? null;
      setSession(response.data);
      setSelectedId(nextSelected?.id ?? null);
      setPrompt(nextSelected?.prompt ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '전체 문서 자동완성에 실패했습니다.');
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
          onSelect={selectRegion}
          onPrompt={setPrompt}
          onGlobalPrompt={setGlobalPrompt}
          onLocalChange={setRegionLocal}
          onSaveSelected={async () => {
            if (!selected) return;
            setBusy('save');
            try {
              await persistRegion(selected, selected.value, prompt);
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
  onSelect: (region: HwpxEditableRegion) => void;
  onPrompt: (value: string) => void;
  onGlobalPrompt: (value: string) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string) => void;
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

      <DocumentPreview session={props.session} regions={props.regions} selected={props.selected} onSelect={props.onSelect} />

      <aside className="space-y-4">
        <BatchDraftPanel
          regions={props.regions}
          busy={props.busy}
          globalPrompt={props.globalPrompt}
          onGlobalPrompt={props.onGlobalPrompt}
          onGenerateAll={props.onGenerateAll}
        />
        <RegionEditor
          selected={props.selected}
          busy={props.busy}
          prompt={props.prompt}
          onPrompt={props.onPrompt}
          onLocalChange={props.onLocalChange}
          onSaveSelected={props.onSaveSelected}
          onGenerateSelected={props.onGenerateSelected}
        />
        <RegionProgress regions={props.regions} selected={props.selected} onSelect={props.onSelect} />
      </aside>

      <div className="flex items-center justify-between xl:col-span-2">
        <Button variant="secondary" onClick={props.onBack}>새 파일 업로드</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#65736E]">진행: {filled}/{total} 항목 완료</span>
          <Button onClick={props.onExport} disabled={Boolean(props.busy)}>
            {props.busy === 'export' ? 'HWPX 생성 중...' : props.exported ? '수정본 HWPX 다시 생성' : '최종 HWPX 생성'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BatchDraftPanel({
  regions,
  busy,
  globalPrompt,
  onGlobalPrompt,
  onGenerateAll,
}: {
  regions: HwpxEditableRegion[];
  busy: string | null;
  globalPrompt: string;
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
        <Button onClick={onGenerateAll} disabled={Boolean(busy) || aiTargets === 0}>
          {busy === 'draft-all' ? '전체 작성 중...' : '전체 자동완성'}
        </Button>
      </div>
    </section>
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
  const blocks = getAnalysisBlocks(session);
  if (blocks.length) {
    return (
      <section className={[compact ? 'max-h-[720px]' : 'h-[calc(100vh-260px)] min-h-[720px]', 'overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#DDE5E1] p-6'].join(' ')}>
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
      <div className="mx-auto flex max-w-[920px] flex-col gap-8">
        {session.pages.map((page) => {
          const pageRegions = regions.filter((region) => region.page_index === page.page_index);
          return (
            <div key={page.page_index} className="relative mx-auto overflow-hidden bg-white shadow-[0_18px_48px_rgba(36,49,45,0.16)]">
              <img src={page.image_base64} alt={`HWPX page ${page.page_index + 1}`} className="block h-auto w-full max-w-[900px]" />
              {pageRegions.map((region, index) => {
                const active = selected?.id === region.id;
                const filled = Boolean(region.value.trim());
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
                        : filled
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
                        active ? 'border-[#0F5B4D] bg-[#0F5B4D] text-white' : 'border-[#245D50] bg-white/95 text-[#245D50]',
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
        <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E7F1ED] px-1 text-[10px] font-bold text-[#245D50]">
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
                        cell.align === 'center' ? 'justify-center text-center' : cell.align === 'right' ? 'justify-end text-right' : '',
                      ].join(' ')}
                      style={contentStyle}
                    >
                      <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#245D50] shadow-sm">
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
  onPrompt,
  onLocalChange,
  onSaveSelected,
  onGenerateSelected,
}: {
  selected: HwpxEditableRegion | null;
  busy: string | null;
  prompt: string;
  onPrompt: (value: string) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string) => void;
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
          <Button onClick={onGenerateSelected} disabled={busy === 'draft'} className="w-full">
            {busy === 'draft' ? 'AI 작성 중...' : 'AI로 선택 항목 채우기'}
          </Button>
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
  onSelect,
}: {
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">입력 진행 상황</p>
      <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
        {regions.map((region, index) => (
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
              <span className="mt-1 block truncate text-xs">{region.value || '빈 값'}</span>
            </span>
            <span className={['mt-0.5 h-2 w-2 rounded-full', region.value.trim() ? 'bg-[#3A7A68]' : 'bg-[#D7E2DD]'].join(' ')} />
          </button>
        ))}
      </div>
    </section>
  );
}

