'use client';

import { useMemo, useRef, useState, type RefObject } from 'react';
import {
  addHwpxComponent,
  createHwpxFormSession,
  draftHwpxRegion,
  exportHwpxFormSession,
  updateHwpxRegion,
} from '@/lib/api';
import type { ExportResponse, HwpxEditableRegion, HwpxFormSession, HwpxTemplateBlock, HwpxTemplateCell } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type WorkflowStep = 'upload' | 'edit' | 'review';
type ComponentKind = 'text' | 'textarea' | 'signature' | 'table';

const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
  { id: 'upload', label: '1. 파일 업로드', description: 'HWP/HWPX 원본 선택' },
  { id: 'edit', label: '2. 문서 편집', description: '문단과 표 셀을 직접 수정' },
  { id: 'review', label: '3. 다운로드', description: '원본 구조 그대로 HWPX 생성' },
];

const componentOptions: Array<{ kind: ComponentKind; label: string }> = [
  { kind: 'table', label: '표' },
  { kind: 'signature', label: '서명' },
  { kind: 'text', label: '문구' },
  { kind: 'textarea', label: '긴 글' },
];

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

function writingRegions(regions: HwpxEditableRegion[]): HwpxEditableRegion[] {
  return regions.filter(
    (region) =>
      region.kind === 'textarea' ||
      /소개|동기|계획|내용|목표|방법|사유|자기|활동|지원|서술|작성/.test(region.label),
  );
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

function localDraftText(session: HwpxFormSession, region: HwpxEditableRegion, baseInput: string, promptText: string): string {
  const facts = [baseInput, region.value].filter(Boolean).join('\n').trim();
  if (region.kind === 'text' || region.kind === 'checkbox' || region.kind === 'signature') {
    return facts || promptText || `${region.label} 입력값`;
  }
  return [
    `${session.analysis.title || session.source_filename}의 ${region.label} 항목 초안입니다.`,
    facts || '제공된 기본 정보를 바탕으로 목적, 필요성, 실행 내용을 구체적으로 정리했습니다.',
    promptText ? `요청사항: ${promptText}` : '제출용 문체로 간결하고 명확하게 작성했습니다.',
  ].join('\n');
}

export function HwpxFormEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [session, setSession] = useState<HwpxFormSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [baseInput, setBaseInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [globalBaseInput, setGlobalBaseInput] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedRegions = useMemo(() => sortRegions(session?.regions ?? []), [session]);
  const selected = useMemo(
    () => orderedRegions.find((region) => region.id === selectedId) ?? orderedRegions[0] ?? null,
    [orderedRegions, selectedId],
  );
  const stepIndex = workflowSteps.findIndex((item) => item.id === step);
  const completedCount = orderedRegions.filter((region) => region.value.trim()).length;

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
      setBaseInput('');
      setPrompt('');
      setGlobalBaseInput('');
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
    setBaseInput('');
    setPrompt('');
    setGlobalBaseInput('');
    setGlobalPrompt('');
    setError(null);
    setStep('upload');
  }

  function selectRegion(region: HwpxEditableRegion) {
    setSelectedId(region.id);
    setBaseInput(region.value);
    setPrompt(region.prompt);
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
  }

  async function persistRegion(region: HwpxEditableRegion, value = region.value, nextPrompt = region.prompt) {
    if (!session) return session;
    const response = await updateHwpxRegion(session.id, region.id, { value, prompt: nextPrompt });
    setSession(response.data);
    return response.data;
  }

  async function persistAllRegions(current = session) {
    if (!current) return current;
    let latest = current;
    for (const region of current.regions) {
      const response = await updateHwpxRegion(current.id, region.id, {
        value: region.value,
        prompt: region.prompt,
      });
      latest = response.data;
    }
    setSession(latest);
    return latest;
  }

  async function go(nextStep: WorkflowStep) {
    setError(null);
    if (session && nextStep === 'review') {
      setBusy('save');
      try {
        await persistAllRegions();
      } catch (err) {
        setError(err instanceof Error ? err.message : '입력값 저장에 실패했습니다.');
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    setStep(nextStep);
  }

  async function generateSelectedDraft() {
    if (!session || !selected) return;
    setBusy('draft');
    setError(null);
    try {
      const nextPrompt = prompt || selected.prompt || `${selected.label} 항목을 제출용 문장으로 작성해줘.`;
      const nextBaseInput = [baseInput, selected.value].filter(Boolean).join('\n\n');
      await persistRegion(selected, selected.value, nextPrompt);
      const response = await draftHwpxRegion(session.id, selected.id, {
        baseInput: nextBaseInput,
        prompt: nextPrompt,
      });
      const updated = response.data.regions.find((region) => region.id === selected.id);
      setSession(response.data);
      setSelectedId(selected.id);
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

  async function generateCompleteDraft() {
    if (!session) return;
    setBusy('complete');
    setError(null);
    try {
      let latest = await persistAllRegions();
      if (!latest) return;
      const ordered = sortRegions(latest.regions);
      const targets = ordered.filter((region) => region.kind === 'textarea' || !region.value.trim());
      const regionsToDraft = targets.length ? targets : ordered;
      for (const region of regionsToDraft) {
        const baseForRegion = [globalBaseInput, region.value].filter(Boolean).join('\n\n');
        const promptForRegion = globalPrompt || region.prompt || `${region.label} 항목을 공고문 문체에 맞게 구체적으로 작성해줘.`;
        try {
          const response = await draftHwpxRegion(latest.id, region.id, {
            baseInput: baseForRegion,
            prompt: promptForRegion,
          });
          latest = response.data;
        } catch {
          const fallback = localDraftText(latest, region, baseForRegion, promptForRegion);
          latest = {
            ...latest,
            status: 'editing',
            regions: latest.regions.map((item) =>
              item.id === region.id ? { ...item, value: fallback, prompt: promptForRegion, draft_status: 'drafted' } : item,
            ),
          };
        }
        setSession(latest);
      }
      setSelectedId(sortRegions(latest.regions)[0]?.id ?? null);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 완성본 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function addComponent(kind: ComponentKind) {
    if (!session) return;
    setBusy('component');
    setError(null);
    try {
      const label = componentOptions.find((item) => item.kind === kind)?.label ?? '추가 영역';
      const response = await addHwpxComponent(session.id, { kind, label: `추가 ${label}` });
      const nextRegions = sortRegions(response.data.regions);
      const created = nextRegions[nextRegions.length - 1] ?? null;
      setSession(response.data);
      if (created) selectRegion(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : '구성요소 추가에 실패했습니다.');
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

      {session && step === 'edit' ? (
        <EditStep
          session={session}
          regions={orderedRegions}
          selected={selected}
          busy={busy}
          baseInput={baseInput}
          prompt={prompt}
          onSelect={selectRegion}
          onBaseInput={setBaseInput}
          onPrompt={setPrompt}
          onLocalChange={setRegionLocal}
          onSaveSelected={async () => {
            if (!selected) return;
            setBusy('save');
            try {
              await persistRegion(selected);
            } catch (err) {
              setError(err instanceof Error ? err.message : '입력값 저장에 실패했습니다.');
            } finally {
              setBusy(null);
            }
          }}
          onGenerateSelected={generateSelectedDraft}
          onAddComponent={addComponent}
          onBack={reset}
          onNext={() => go('review')}
        />
      ) : null}

      {session && step === 'review' ? (
        <ReviewStep
          session={session}
          regions={orderedRegions}
          selected={selected}
          busy={busy}
          onSelect={selectRegion}
          onBack={() => go('edit')}
          onDownload={exportFile}
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
          <p className="text-sm font-bold text-[#3A7A68]">HWPX 양식 편집</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">
            원본 문서 구조를 보면서 필요한 항목만 채워 넣습니다.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
            문단, 표 셀, 서명란까지 클릭해서 수정하고 다운로드할 때는 원본 HWPX 패키지를 복제한 뒤 입력값만 반영합니다.
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
        disabled={busy === 'upload'}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFile(event.dataTransfer.files?.[0]);
        }}
        className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#BFD1C9] bg-[#F8FBFA] px-6 text-center transition hover:border-[#6A9C89] hover:bg-[#F2F8F5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-base font-bold text-[#245D50]">
          {busy === 'upload' ? '문서 구조를 불러오는 중...' : 'HWP/HWPX 파일 업로드'}
        </span>
        <span className="mt-2 text-sm text-[#65736E]">파일을 여기에 놓거나 클릭해서 선택하세요.</span>
      </button>
    </section>
  );
}

function AnalysisStep({
  session,
  regions,
  completedCount,
  onBack,
  onNext,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  completedCount: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const stats = session.analysis.stats as Record<string, number> | undefined;
  const title = compactText(session.analysis.title, session.source_filename) || session.source_filename;
  const organization = compactText(session.analysis.organization, '기관 미확인') || '기관 미확인';
  const conciseSummary = truncate(
    compactText(session.analysis.summary, '업로드한 HWPX의 표 구조, 문단, 입력 영역을 분석했습니다.'),
    220,
  );
  const fields = Array.isArray(session.analysis.fields) ? session.analysis.fields : [];
  const sections = Array.isArray(session.analysis.sections) ? session.analysis.sections : [];
  const longRegions = writingRegions(regions);
  const keyItems = [
    `${regions.length}개 입력 영역을 원본 순서대로 정리했습니다.`,
    `${longRegions.length}개 영역은 AI 초안 작성 대상으로 분류했습니다.`,
    `${stats?.tables ?? 0}개 표와 ${stats?.sections ?? 0}개 섹션을 구조 보존 대상으로 감지했습니다.`,
  ];

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#3A7A68]">AI 분석 결과</p>
          <h2 className="mt-2 text-2xl font-bold text-[#24312D]">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-[#65736E]">{conciseSummary}</p>
        </div>
        <div className="rounded-2xl border border-[#DDE7E2] bg-[#F8FBFA] px-4 py-3 text-sm">
          <p className="font-bold text-[#24312D]">{organization}</p>
          <p className="mt-1 text-[#65736E]">{session.source_filename}</p>
        </div>
      </div>

      {session.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
          {session.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="입력 영역" value={`${regions.length}개`} />
        <Metric label="긴 글 작성" value={`${longRegions.length}개`} />
        <Metric label="작성 완료" value={`${completedCount}개`} />
        <Metric label="표/섹션" value={`${stats?.tables ?? 0} / ${stats?.sections ?? 0}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
          <p className="text-sm font-bold text-[#24312D]">핵심 요약</p>
          <div className="mt-3 space-y-2">
            {keyItems.map((item) => (
              <p key={item} className="rounded-xl bg-white px-3 py-2 text-sm leading-6 text-[#40504B]">
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
          <p className="text-sm font-bold text-[#24312D]">원본에서 찾은 주요 섹션</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {(sections.length ? sections : fields).slice(0, 8).map((item, index) => {
              const label = 'heading' in item ? item.heading : item.label;
              const body = 'body' in item ? item.body : item.value;
              return (
                <div key={`${label}-${index}`} className="rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm">
                  <p className="font-bold text-[#24312D]">{truncate(label || `섹션 ${index + 1}`, 34)}</p>
                  {body ? <p className="mt-1 truncate text-xs text-[#65736E]">{body}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
        <p className="text-sm font-bold text-[#24312D]">추출된 입력 영역</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {regions.slice(0, 28).map((region, index) => (
              <div key={region.id} className="rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E7F1ED] text-xs font-bold text-[#245D50]">
                  {regionNumber(region, index)}
                </span>
                <span className="font-semibold text-[#24312D]">{region.label}</span>
              </div>
            ))}
          </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>다시 업로드</Button>
        <Button onClick={onNext}>섹션별 입력 시작</Button>
      </div>
    </section>
  );
}

function EditStep(props: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  busy: string | null;
  baseInput: string;
  prompt: string;
  onSelect: (region: HwpxEditableRegion) => void;
  onBaseInput: (value: string) => void;
  onPrompt: (value: string) => void;
  onLocalChange: (region: HwpxEditableRegion, value: string, prompt?: string) => void;
  onSaveSelected: () => void;
  onGenerateSelected: () => void;
  onAddComponent: (kind: ComponentKind) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const filled = props.regions.filter((region) => region.value.trim()).length;
  const tableCells = props.regions.filter((region) => sourceRefText(region, 'type') === 'table_cell').length;
  const paragraphs = props.regions.filter((region) => sourceRefText(region, 'type') === 'paragraph').length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm xl:col-span-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold text-[#3A7A68]">{props.session.source_filename}</p>
            <h2 className="mt-1 text-2xl font-bold text-[#24312D]">클릭해서 바로 수정하세요.</h2>
            <p className="mt-2 text-sm leading-6 text-[#65736E]">
              원본에서 추출한 문단과 표 셀을 모두 편집 목록으로 만들었습니다. 서명란도 표 안에 있으면 표 구조 안에서 그대로 수정됩니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-5 text-right text-sm">
            <div>
              <p className="text-xs font-bold text-[#65736E]">전체 항목</p>
              <p className="mt-1 text-lg font-extrabold text-[#24312D]">{props.regions.length}개</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#65736E]">문단/표 셀</p>
              <p className="mt-1 text-lg font-extrabold text-[#24312D]">{paragraphs}/{tableCells}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#65736E]">값 있음</p>
              <p className="mt-1 text-lg font-extrabold text-[#24312D]">{filled}개</p>
            </div>
          </div>
        </div>
      </section>
      <DocumentPreview session={props.session} regions={props.regions} selected={props.selected} onSelect={props.onSelect} />
      <aside className="space-y-4">
        <RegionEditor {...props} />
        <RegionProgress regions={props.regions} selected={props.selected} onSelect={props.onSelect} />
      </aside>
      <div className="flex justify-end gap-2 xl:col-span-2">
        <Button variant="secondary" onClick={props.onBack}>새 파일 업로드</Button>
        <Button onClick={props.onNext} disabled={Boolean(props.busy)}>
          {props.busy === 'save' ? '저장 중...' : '검토 후 다운로드'}
        </Button>
      </div>
    </div>
  );
}

function GenerateStep({
  session,
  regions,
  globalBaseInput,
  globalPrompt,
  busy,
  onGlobalBaseInput,
  onGlobalPrompt,
  onGenerate,
  onBack,
  onSkip,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  globalBaseInput: string;
  globalPrompt: string;
  busy: string | null;
  onGlobalBaseInput: (value: string) => void;
  onGlobalPrompt: (value: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const targets = writingRegions(regions);
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">AI 완성본 자동 생성</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">요청사항을 바탕으로 문서 전체 초안을 채웁니다.</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="전체 입력 영역" value={`${session.regions.length}개`} />
        <Metric label="우선 작성 영역" value={`${targets.length}개`} />
        <Metric label="현재 상태" value={busy === 'complete' ? '작성 중' : '대기'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold text-[#24312D]">전체 기본 입력사항</span>
          <textarea
            value={globalBaseInput}
            onChange={(event) => onGlobalBaseInput(event.target.value)}
            className="mt-2 min-h-[220px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
            placeholder="AI가 전체 문서 작성에 참고할 사실, 활동 경험, 팀 정보, 지원 동기 등을 적어주세요."
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[#24312D]">전체 AI 요청 프롬프트</span>
          <textarea
            value={globalPrompt}
            onChange={(event) => onGlobalPrompt(event.target.value)}
            className="mt-2 min-h-[220px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
            placeholder="예: 공고문 문체에 맞게 구체적으로, 과장 없이, 제출용 문장으로 작성해줘."
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>섹션 입력으로</Button>
        <Button variant="secondary" onClick={onSkip}>건너뛰고 검토</Button>
        <Button onClick={onGenerate} disabled={busy === 'complete'}>
          {busy === 'complete' ? 'AI 완성본 생성 중...' : 'AI 완성본 자동 생성'}
        </Button>
      </div>
    </section>
  );
}

function ReviewStep({
  session,
  regions,
  selected,
  busy,
  onSelect,
  onBack,
  onDownload,
}: {
  session: HwpxFormSession;
  regions: HwpxEditableRegion[];
  selected: HwpxEditableRegion | null;
  busy: string | null;
  onSelect: (region: HwpxEditableRegion) => void;
  onBack: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">다운로드 전 확인</p>
        <h2 className="mt-1 text-2xl font-bold text-[#24312D]">입력한 내용으로 원본 HWPX를 다시 생성합니다.</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {regions.map((region, index) => (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelect(region)}
              className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-3 py-2 text-left text-sm hover:bg-[#F0F7F3]"
            >
              <p className="font-bold text-[#24312D]">
                {regionNumber(region, index)}. {region.label}
              </p>
              <p className="mt-1 truncate text-xs text-[#65736E]">{region.value || '빈 값'}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onBack}>다시 수정</Button>
          <Button onClick={onDownload} disabled={Boolean(busy)}>
            {busy === 'export' ? 'HWPX 생성 중...' : 'HWPX 다운로드'}
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
          return (
            <HtmlTableBlock
              key={block.id || `table-${blockIndex}`}
              block={block}
              tableIndex={tableIndex}
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
      <button type="button" onClick={() => onSelect(paragraphRegion)} className={className}>
        {content}
      </button>
    ) : (
      <h3 className={className}>{content}</h3>
    );
  }

  const className = [
    'my-1 w-full rounded-md px-2 py-1 text-[12px] leading-6',
    alignClass,
    paragraphRegion ? 'cursor-pointer hover:bg-[#F2F7F4]' : '',
    active ? 'bg-[#E7F1ED] ring-2 ring-[#245D50]' : '',
  ].join(' ');
  return paragraphRegion ? (
    <button type="button" onClick={() => onSelect(paragraphRegion)} className={className}>
      {content}
    </button>
  ) : (
    <p className={className}>{content}</p>
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
              const displayValue = region?.value || cell.text;
              const width = cell.width ? `${Math.max(5, Math.min(100, cell.width))}%` : undefined;
              return (
                <td
                  key={cell.id ?? `${rowIndex}-${cellIndex}`}
                  rowSpan={cell.row_span}
                  colSpan={cell.col_span}
                  className={[
                    'border border-[#1F2933] p-0 align-middle',
                    cell.background ? '' : rowIndex === 0 || cellIndex === 0 ? 'bg-[#F1F4F2]' : 'bg-white',
                  ].join(' ')}
                  style={{ width, backgroundColor: cell.background }}
                >
                  {region ? (
                    <button
                      type="button"
                      onClick={() => onSelect(region)}
                      className={[
                        'group relative flex min-h-[32px] w-full items-center gap-1 px-2 py-1 text-left transition',
                        active ? 'bg-[#E7F1ED] ring-2 ring-inset ring-[#245D50]' : 'hover:bg-[#F5FAF7]',
                        filled ? 'text-[#111827]' : 'text-[#93A19B]',
                        cell.align === 'center' ? 'justify-center text-center' : cell.align === 'right' ? 'justify-end text-right' : '',
                      ].join(' ')}
                    >
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#245D50] shadow-sm">
                        {regionNumber(region, regions.findIndex((item) => item.id === region.id))}
                      </span>
                      <span className="min-w-0 whitespace-pre-wrap break-words">
                        {displayValue || '입력 필요'}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={[
                        'min-h-[32px] whitespace-pre-wrap break-words px-2 py-1',
                        cell.align === 'center' ? 'text-center' : cell.align === 'right' ? 'text-right' : 'text-left',
                      ].join(' ')}
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
  onAddComponent,
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
  onAddComponent: (kind: ComponentKind) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">선택한 항목</p>
      {selected ? (
        <div className="mt-3 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-[#24312D]">{selected.label}</span>
            <textarea
              value={selected.value}
              onChange={(event) => onLocalChange(selected, event.target.value, prompt)}
              className="mt-2 min-h-[170px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
              placeholder="이 영역에 들어갈 내용을 입력하세요."
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onSaveSelected} disabled={busy === 'save'}>
              {busy === 'save' ? '저장 중...' : '저장'}
            </Button>
            <Button onClick={onGenerateSelected} disabled={busy === 'draft'}>
              {busy === 'draft' ? '작성 중...' : '초안 도움'}
            </Button>
          </div>
          <details className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-3 py-2">
            <summary className="cursor-pointer text-sm font-bold text-[#24312D]">초안 도움 옵션</summary>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-[#65736E]">참고 정보</span>
                <textarea
                  value={baseInput}
                  onChange={(event) => onBaseInput(event.target.value)}
                  className="mt-1 min-h-[90px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#6A9C89]"
                  placeholder="활동 경험, 팀 정보, 꼭 들어가야 할 사실을 적어주세요."
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#65736E]">요청 문장</span>
                <textarea
                  value={prompt}
                  onChange={(event) => {
                    onPrompt(event.target.value);
                    onLocalChange(selected, selected.value, event.target.value);
                  }}
                  className="mt-1 min-h-[90px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#6A9C89]"
                  placeholder="예: 제출용 문체로 짧고 구체적으로 정리"
                />
              </label>
            </div>
          </details>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#65736E]">왼쪽 HWPX 화면에서 수정할 항목을 선택하세요.</p>
      )}

      <details className="mt-5 border-t border-[#E4EBE7] pt-4">
        <summary className="cursor-pointer text-sm font-bold text-[#24312D]">원본에 없는 항목 추가</summary>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {componentOptions.map((item) => (
            <button
              key={item.kind}
              type="button"
              disabled={busy === 'component'}
              onClick={() => onAddComponent(item.kind)}
              className="rounded-xl border border-[#DDE7E2] bg-[#F8FBFA] px-2 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </details>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
      <p className="text-xs font-bold text-[#65736E]">{label}</p>
      <p className="mt-2 truncate text-lg font-extrabold text-[#24312D]">{value}</p>
    </div>
  );
}
