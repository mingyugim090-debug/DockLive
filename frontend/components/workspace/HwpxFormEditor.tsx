'use client';

import { useMemo, useRef, useState } from 'react';
import {
  createHwpxFormSession,
  draftHwpxRegion,
  exportHwpxFormSession,
  updateHwpxRegion,
} from '@/lib/api';
import type { ExportResponse, HwpxEditableRegion, HwpxFormSession } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type WorkflowStep = 'upload' | 'analysis' | 'edit' | 'generate' | 'review';

const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
  { id: 'upload', label: '1. HWPX 업로드', description: 'HWP/HWPX 신청서만 업로드' },
  { id: 'analysis', label: '2. AI 분석', description: '핵심 정보와 입력 영역 추출' },
  { id: 'edit', label: '3. 섹션 입력', description: '원본 화면을 보며 영역별 수정' },
  { id: 'generate', label: '4. AI 완성본', description: '요청사항 기반 자동 작성' },
  { id: 'review', label: '5. 최종 검토', description: '확인 후 HWPX 다운로드' },
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

  const selected = useMemo(
    () => session?.regions.find((region) => region.id === selectedId) ?? session?.regions[0] ?? null,
    [session, selectedId],
  );
  const stepIndex = workflowSteps.findIndex((item) => item.id === step);
  const completedCount = session?.regions.filter((region) => region.value.trim()).length ?? 0;

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
      setSession(response.data);
      setSelectedId(response.data.regions[0]?.id ?? null);
      setBaseInput('');
      setPrompt('');
      setGlobalBaseInput('');
      setGlobalPrompt('');
      setStep('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 분석에 실패했습니다.');
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
    if (session && ['generate', 'review'].includes(nextStep)) {
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
      await persistRegion(selected, selected.value, prompt);
      const response = await draftHwpxRegion(session.id, selected.id, { baseInput, prompt });
      setSession(response.data);
      setSelectedId(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 초안 생성에 실패했습니다.');
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
      const targets = latest.regions.filter((region) => region.kind === 'textarea' || !region.value.trim());
      const regionsToDraft = targets.length ? targets : latest.regions;
      for (const region of regionsToDraft) {
        const response = await draftHwpxRegion(latest.id, region.id, {
          baseInput: [globalBaseInput, region.value].filter(Boolean).join('\n\n'),
          prompt: globalPrompt || `${region.label} 항목을 공고문 문체에 맞게 구체적으로 작성해줘.`,
        });
        latest = response.data;
        setSession(latest);
      }
      setSelectedId(latest.regions[0]?.id ?? null);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 완성본 생성에 실패했습니다.');
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
      setSession((current) => current ? { ...current, status: 'exported' } : current);
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

      {step === 'upload' ? (
        <UploadStep inputRef={inputRef} busy={busy} error={error} onFile={handleFile} />
      ) : null}

      {session && step === 'analysis' ? (
        <AnalysisStep
          session={session}
          completedCount={completedCount}
          onBack={() => go('upload')}
          onNext={() => go('edit')}
        />
      ) : null}

      {session && step === 'edit' ? (
        <EditStep
          session={session}
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
          onBack={() => go('analysis')}
          onNext={() => go('generate')}
        />
      ) : null}

      {session && step === 'generate' ? (
        <GenerateStep
          session={session}
          globalBaseInput={globalBaseInput}
          globalPrompt={globalPrompt}
          busy={busy}
          onGlobalBaseInput={setGlobalBaseInput}
          onGlobalPrompt={setGlobalPrompt}
          onGenerate={generateCompleteDraft}
          onBack={() => go('edit')}
          onSkip={() => go('review')}
        />
      ) : null}

      {session && step === 'review' ? (
        <ReviewStep
          session={session}
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
          <p className="text-sm font-bold text-[#3A7A68]">HWPX AI 자동작성</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">
            HWP/HWPX 신청서를 업로드하면 원본 구조 그대로 완성합니다.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
            업로드, AI 분석, 섹션별 입력, AI 완성본 생성, 최종 검토와 HWPX 다운로드 순서로 진행됩니다.
          </p>
        </div>
        {hasSession ? (
          <Button variant="secondary" onClick={onReset} disabled={busy}>새 파일로 시작</Button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-2 md:grid-cols-5">
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
  inputRef: React.RefObject<HTMLInputElement>;
  busy: string | null;
  error: string | null;
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
          {busy === 'upload' ? 'HWPX 분석 중...' : 'HWP/HWPX 파일 업로드'}
        </span>
        <span className="mt-2 text-sm text-[#65736E]">파일을 여기에 끌어오거나 클릭해서 선택하세요.</span>
      </button>
    </section>
  );
}

function AnalysisStep({
  session,
  completedCount,
  onBack,
  onNext,
}: {
  session: HwpxFormSession;
  completedCount: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const stats = session.analysis.stats as Record<string, number> | undefined;
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">AI 분석 결과</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">{session.analysis.title || session.source_filename}</h2>
      <p className="mt-2 text-sm leading-7 text-[#65736E]">{session.analysis.summary || '업로드한 HWPX의 구조와 입력 영역을 분석했습니다.'}</p>

      {session.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
          {session.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="파일명" value={session.source_filename} />
        <Metric label="입력 영역" value={`${session.regions.length}개`} />
        <Metric label="작성 완료" value={`${completedCount}개`} />
        <Metric label="표/섹션" value={`${stats?.tables ?? 0} / ${stats?.sections ?? 0}`} />
      </div>

      <div className="mt-6 rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
        <p className="text-sm font-bold text-[#24312D]">추출된 입력 영역</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {session.regions.slice(0, 18).map((region, index) => (
            <div key={region.id} className="rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E7F1ED] text-xs font-bold text-[#245D50]">{index + 1}</span>
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
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <DocumentPreview session={props.session} selected={props.selected} onSelect={props.onSelect} />
      <aside className="space-y-4">
        <RegionEditor {...props} />
        <RegionList session={props.session} selected={props.selected} onSelect={props.onSelect} />
      </aside>
      <div className="xl:col-span-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={props.onBack}>AI 분석으로</Button>
        <Button onClick={props.onNext} disabled={Boolean(props.busy)}>
          {props.busy === 'save' ? '저장 중...' : 'AI 완성본 생성으로'}
        </Button>
      </div>
    </div>
  );
}

function GenerateStep({
  session,
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
  globalBaseInput: string;
  globalPrompt: string;
  busy: string | null;
  onGlobalBaseInput: (value: string) => void;
  onGlobalPrompt: (value: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">AI 완성본 자동 생성</p>
      <h2 className="mt-2 text-2xl font-bold text-[#24312D]">요청사항을 바탕으로 비어 있거나 긴 글 영역을 자동 작성합니다.</h2>
      <p className="mt-2 text-sm leading-7 text-[#65736E]">
        현재 입력 영역 {session.regions.length}개를 기준으로 자기소개, 지원동기, 활동계획처럼 긴 글이 필요한 부분을 우선 작성합니다.
      </p>

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
  selected,
  busy,
  onSelect,
  onBack,
  onDownload,
}: {
  session: HwpxFormSession;
  selected: HwpxEditableRegion | null;
  busy: string | null;
  onSelect: (region: HwpxEditableRegion) => void;
  onBack: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">최종 검토</p>
        <h2 className="mt-1 text-2xl font-bold text-[#24312D]">입력값을 확인한 뒤 HWPX로 다운로드하세요.</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {session.regions.map((region) => (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelect(region)}
              className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-3 py-2 text-left text-sm hover:bg-[#F0F7F3]"
            >
              <p className="font-bold text-[#24312D]">{region.label}</p>
              <p className="mt-1 truncate text-xs text-[#65736E]">{region.value || '미입력'}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onBack}>다시 수정</Button>
          <Button onClick={onDownload} disabled={Boolean(busy)}>
            {busy === 'export' ? '검증 중...' : 'HWPX 다운로드'}
          </Button>
        </div>
      </section>
      <DocumentPreview session={session} selected={selected} onSelect={onSelect} compact />
    </div>
  );
}

function DocumentPreview({
  session,
  selected,
  onSelect,
  compact = false,
}: {
  session: HwpxFormSession;
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
  compact?: boolean;
}) {
  return (
    <section className={[compact ? 'max-h-[720px]' : 'h-[calc(100vh-260px)] min-h-[720px]', 'overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#E2E8E5] p-5'].join(' ')}>
      <div className="mx-auto flex max-w-[920px] flex-col gap-8">
        {session.pages.map((page) => (
          <div key={page.page_index} className="relative mx-auto overflow-hidden bg-white shadow-[0_18px_48px_rgba(36,49,45,0.16)]">
            <img src={page.image_base64} alt={`HWPX page ${page.page_index + 1}`} className="block h-auto w-full max-w-[900px]" />
            {session.regions
              .filter((region) => region.page_index === page.page_index)
              .map((region, index) => {
                const active = selected?.id === region.id;
                return (
                  <button
                    key={region.id}
                    type="button"
                    title={region.label}
                    onClick={() => onSelect(region)}
                    className={[
                      'absolute flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-extrabold shadow-sm transition',
                      active
                        ? 'border-[#0F5B4D] bg-[#0F5B4D] text-white ring-4 ring-[#0F5B4D]/20'
                        : 'border-[#245D50] bg-white/90 text-[#245D50] hover:bg-[#E7F1ED]',
                    ].join(' ')}
                    style={{
                      left: `${Math.max(1, Math.min(94, region.bbox.x))}%`,
                      top: `${Math.max(1, Math.min(94, region.bbox.y))}%`,
                    }}
                  >
                    {index + 1}
                  </button>
                );
              })}
          </div>
        ))}
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
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">선택 영역</p>
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
          <label className="block">
            <span className="text-sm font-bold text-[#24312D]">기본 입력사항</span>
            <textarea
              value={baseInput}
              onChange={(event) => onBaseInput(event.target.value)}
              className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
              placeholder="AI가 참고할 사실, 활동 경험, 팀 정보 등을 적어주세요."
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#24312D]">AI 요청 프롬프트</span>
            <textarea
              value={prompt}
              onChange={(event) => {
                onPrompt(event.target.value);
                onLocalChange(selected, selected.value, event.target.value);
              }}
              className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
              placeholder="예: 공고문 문체에 맞게 3문장으로 구체화해줘."
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onSaveSelected} disabled={busy === 'save'}>
              {busy === 'save' ? '저장 중...' : '저장'}
            </Button>
            <Button onClick={onGenerateSelected} disabled={busy === 'draft'}>
              {busy === 'draft' ? '작성 중...' : 'AI 초안'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#65736E]">왼쪽 문서의 번호 마커나 아래 목록에서 입력 영역을 선택하세요.</p>
      )}
    </section>
  );
}

function RegionList({
  session,
  selected,
  onSelect,
}: {
  session: HwpxFormSession;
  selected: HwpxEditableRegion | null;
  onSelect: (region: HwpxEditableRegion) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold text-[#3A7A68]">입력 영역 목록</p>
      <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
        {session.regions.map((region, index) => (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region)}
            className={[
              'grid w-full grid-cols-[28px_1fr] gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
              selected?.id === region.id ? 'border-[#245D50] bg-[#F0F7F3] text-[#24312D]' : 'border-[#E4EBE7] text-[#65736E] hover:bg-[#F8FBFA]',
            ].join(' ')}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-[#245D50]">{index + 1}</span>
            <span className="min-w-0">
              <span className="block font-bold">{region.label}</span>
              <span className="mt-1 block truncate text-xs">{region.value || '미입력'}</span>
            </span>
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
