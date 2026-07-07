'use client';

import { useCallback, useState } from 'react';
import {
  analyzeWorkspace,
  buildWorkspaceBlueprint,
  createDemoWorkspace,
  createWorkspace,
  exportWorkspace,
  generateWorkspaceExcelArtifact,
  generateWorkspaceDocument,
  openWorkspaceArtifact,
  syncWorkspaceArtifact,
  transformWorkspaceBlock,
  uploadWorkspaceFile,
  type WorkspaceExportFormat,
} from '@/lib/api';
import type { DocumentWorkspace, InlineTransformCommand, WorkspaceArtifact, WorkspaceStatus } from '@/lib/types';
import { BlueprintPanel } from './BlueprintPanel';
import { DocumentCanvas } from './DocumentCanvas';
import { ExportBar } from './ExportBar';
import { WorkspaceUploader } from './WorkspaceUploader';

const STEPS: { key: WorkspaceStatus[]; label: string }[] = [
  { key: ['empty', 'files_added'], label: '① 자료 모으기' },
  { key: ['analyzed'], label: '② 공고 분석' },
  { key: ['blueprint_ready'], label: '③ 구조 설계' },
  { key: ['generated'], label: '④ 문서 완성' },
];

function stepIndex(status: WorkspaceStatus): number {
  return STEPS.findIndex((step) => step.key.includes(status));
}

function downloadContent(filename: string, content: string, contentType: string, encoding: string) {
  let blob: Blob;
  if (encoding === 'base64') {
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: contentType });
  } else {
    blob = new Blob([content], { type: contentType });
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function replaceArtifact(workspace: DocumentWorkspace, artifact: WorkspaceArtifact): DocumentWorkspace {
  const artifacts = (workspace.artifacts ?? []).filter((item) => item.id !== artifact.id && item.kind !== artifact.kind);
  return { ...workspace, artifacts: [...artifacts, artifact] };
}

function ArtifactPanel({
  artifacts,
  busy,
  onOpen,
  onSync,
}: {
  artifacts: WorkspaceArtifact[];
  busy: boolean;
  onOpen: (artifactId: string) => void;
  onSync: (artifactId: string) => void;
}) {
  const excelArtifact = artifacts.find((artifact) => artifact.kind === 'excel');
  if (!excelArtifact) return null;
  const confirmation = excelArtifact.plan?.confirmation_required ?? [];
  return (
    <section data-testid="artifact-card-excel" className="rounded-xl border border-[#DDE7E2] bg-[#F8FBFA] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-extrabold text-[#24312D]">Excel artifact</h2>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#40504B]">{excelArtifact.filename}</p>
          <p className="mt-1 text-[11px] text-[#65736E]">status: {excelArtifact.sync_state.status}</p>
        </div>
        <span className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">XLSX</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={`artifact-open-${excelArtifact.id}`}
          disabled={busy}
          onClick={() => onOpen(excelArtifact.id)}
          className="rounded-full bg-[#245D50] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
        >
          Excel 열기
        </button>
        <button
          type="button"
          data-testid={`artifact-sync-${excelArtifact.id}`}
          disabled={busy}
          onClick={() => onSync(excelArtifact.id)}
          className="rounded-full border border-[#245D50] px-3 py-1.5 text-[11px] font-bold text-[#245D50] disabled:opacity-50"
        >
          저장 동기화
        </button>
      </div>
      {confirmation.length ? (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-4 text-amber-800">
          {confirmation.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceLog({ logs }: { logs: string[] }) {
  return (
    <section data-testid="workspace-log" className="rounded-xl border border-[#DDE7E2] bg-white px-3 py-3">
      <h2 className="mb-2 text-xs font-extrabold text-[#24312D]">작업 로그</h2>
      {logs.length ? (
        <ol className="space-y-1 text-[11px] leading-4 text-[#40504B]">
          {logs.map((log, index) => (
            <li key={`${index}-${log}`}>{log}</li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] leading-4 text-[#65736E]">파일과 산출물 작업이 여기에 기록됩니다.</p>
      )}
    </section>
  );
}

export function ProjectWorkspace() {
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [transformBusy, setTransformBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const pushLog = useCallback((message: string) => {
    setLogs((current) => [message, ...current].slice(0, 8));
  }, []);

  const run = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, []);

  const startDemo = () =>
    run(async () => {
      const res = await createDemoWorkspace();
      setWorkspace(res.data);
      setLogs(['데모 프로젝트를 열었습니다.']);
    });

  const startEmpty = () =>
    run(async () => {
      const res = await createWorkspace('새 문서 프로젝트');
      setWorkspace(res.data);
      setLogs(['새 프로젝트를 만들었습니다.']);
    });

  const handleUpload = (files: File[]) =>
    run(async () => {
      if (!workspace) return;
      let latest = workspace;
      for (const file of files) {
        const res = await uploadWorkspaceFile(workspace.id, file);
        latest = res.data;
      }
      setWorkspace(latest);
    });

  const handleAnalyze = () =>
    run(async () => {
      if (!workspace) return;
      const res = await analyzeWorkspace(workspace.id);
      setWorkspace(res.data);
    });

  const handleBlueprint = () =>
    run(async () => {
      if (!workspace) return;
      const res = await buildWorkspaceBlueprint(workspace.id);
      setWorkspace(res.data);
    });

  const handleGenerate = () =>
    run(async () => {
      if (!workspace) return;
      const res = await generateWorkspaceDocument(workspace.id);
      setWorkspace({ ...workspace, document: res.data, status: 'generated' });
      setSelectedBlockId(null);
    });

  const handleGenerateExcel = () =>
    run(async () => {
      if (!workspace) return;
      const res = await generateWorkspaceExcelArtifact(workspace.id);
      setWorkspace(replaceArtifact(workspace, res.data));
      pushLog(`Excel artifact generated: ${res.data.filename}`);
    });

  const handleOpenArtifact = (artifactId: string) =>
    run(async () => {
      if (!workspace) return;
      const res = await openWorkspaceArtifact(workspace.id, artifactId);
      setWorkspace(replaceArtifact(workspace, res.data));
      pushLog(`Excel artifact opened: ${res.data.filename}`);
    });

  const handleSyncArtifact = (artifactId: string) =>
    run(async () => {
      if (!workspace) return;
      const res = await syncWorkspaceArtifact(workspace.id, artifactId);
      setWorkspace(replaceArtifact(workspace, res.data));
      pushLog(`Excel 동기화 완료: ${res.data.filename}`);
    });

  const handleCommand = async (blockId: string, command: InlineTransformCommand) => {
    if (!workspace?.document) return;
    setTransformBusy(true);
    setError('');
    try {
      const res = await transformWorkspaceBlock(workspace.id, blockId, command);
      setWorkspace({
        ...workspace,
        document: {
          ...workspace.document,
          blocks: workspace.document.blocks.map((block) => (block.id === blockId ? res.data : block)),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '블록 변환에 실패했습니다.');
    } finally {
      setTransformBusy(false);
    }
  };

  const handleExport = (format: WorkspaceExportFormat) =>
    run(async () => {
      if (!workspace) return;
      const res = await exportWorkspace(workspace.id, format);
      downloadContent(res.filename, res.content, res.content_type, res.encoding ?? 'text');
    });

  if (!workspace) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-[#24312D]">문서 프로젝트</h1>
        <p className="mt-3 text-sm leading-6 text-[#65736E]">
          공고문·엑셀·기존 문서를 한 프로젝트로 묶으면, 요구사항을 추출하고 표·그래프가 포함된 완성 문서 초안을
          만들어 드립니다.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            data-testid="start-demo"
            disabled={busy}
            onClick={startDemo}
            className="rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
          >
            데모로 시작
          </button>
          <button
            type="button"
            data-testid="start-empty"
            disabled={busy}
            onClick={startEmpty}
            className="rounded-full border border-[#245D50] px-6 py-3 text-sm font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
          >
            빈 프로젝트 만들기
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600" data-testid="workspace-error">{error}</p> : null}
      </div>
    );
  }

  const currentStep = stepIndex(workspace.status);
  const hasAnalyzableFile = workspace.files.some((file) => file.text);
  const artifacts = workspace.artifacts ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#DDE7E2] bg-white px-4 py-3">
        <h1 className="text-sm font-extrabold text-[#24312D]">{workspace.title || '문서 프로젝트'}</h1>
        <ol className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {STEPS.map((step, index) => (
            <li
              key={step.label}
              className={[
                'rounded-full px-2.5 py-1 font-bold',
                index <= currentStep ? 'bg-[#EDF7F2] text-[#245D50]' : 'text-[#65736E]',
              ].join(' ')}
            >
              {step.label}
            </li>
          ))}
        </ol>
        <div className="ml-auto">
          {workspace.document ? <ExportBar busy={busy} onExport={handleExport} /> : null}
        </div>
      </header>

      {error ? (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700" data-testid="workspace-error">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[300px] shrink-0 space-y-4 overflow-y-auto border-r border-[#DDE7E2] bg-white px-4 py-4">
          <section>
            <h2 className="mb-2 text-xs font-extrabold text-[#24312D]">프로젝트 자료</h2>
            <WorkspaceUploader files={workspace.files} busy={busy} onUpload={handleUpload} />
          </section>
          <section className="space-y-2">
            <button
              type="button"
              data-testid="action-analyze"
              disabled={busy || !hasAnalyzableFile}
              onClick={handleAnalyze}
              className="w-full rounded-xl border border-[#DDE7E2] px-3 py-2 text-left text-xs font-bold text-[#24312D] transition hover:border-[#6A9C89] disabled:opacity-50"
            >
              공고 분석 {workspace.analysis ? '✓' : ''}
            </button>
            <button
              type="button"
              data-testid="action-blueprint"
              disabled={busy || !workspace.files.length}
              onClick={handleBlueprint}
              className="w-full rounded-xl border border-[#DDE7E2] px-3 py-2 text-left text-xs font-bold text-[#24312D] transition hover:border-[#6A9C89] disabled:opacity-50"
            >
              문서 구조 설계 {workspace.blueprint ? '✓' : ''}
            </button>
            <button
              type="button"
              data-testid="action-generate"
              disabled={busy || !workspace.blueprint}
              onClick={handleGenerate}
              className="w-full rounded-xl bg-[#245D50] px-3 py-2 text-left text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
            >
              {busy ? '작업 중…' : '문서 생성'}
            </button>
            <button
              type="button"
              data-testid="action-excel-generate"
              disabled={busy || !workspace.files.length}
              onClick={handleGenerateExcel}
              className="w-full rounded-xl border border-[#245D50] bg-white px-3 py-2 text-left text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
            >
              Excel 대시보드 생성
            </button>
          </section>
        </aside>

        {workspace.document ? (
          <DocumentCanvas
            document={workspace.document}
            selectedBlockId={selectedBlockId}
            transformBusy={transformBusy}
            onSelectBlock={setSelectedBlockId}
            onCommand={handleCommand}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#F0F4F2] px-6 text-center text-sm text-[#65736E]">
            <div>
              <p className="font-bold text-[#40504B]">아직 생성된 문서가 없습니다.</p>
              <p className="mt-1 text-xs leading-5">
                왼쪽에서 자료를 추가하고 ①분석 → ②구조 설계 → ③문서 생성 순서로 진행해 주세요.
              </p>
            </div>
          </div>
        )}

        <aside className="w-[280px] shrink-0 space-y-4 overflow-y-auto border-l border-[#DDE7E2] bg-white px-4 py-4">
          <ArtifactPanel artifacts={artifacts} busy={busy} onOpen={handleOpenArtifact} onSync={handleSyncArtifact} />
          <WorkspaceLog logs={logs} />
          {workspace.analysis ? (
            <section data-testid="analysis-summary">
              <h2 className="mb-2 text-xs font-extrabold text-[#24312D]">공고 핵심 정보</h2>
              <div className="rounded-xl border border-[#DDE7E2] bg-[#F8FBFA] px-3 py-2 text-[11px] leading-5 text-[#40504B]">
                <p className="font-bold text-[#24312D]">{workspace.analysis.title}</p>
                <p>{workspace.analysis.organization}</p>
                {workspace.analysis.timeline
                  .filter((item) => item.is_deadline)
                  .slice(0, 1)
                  .map((item) => (
                    <p key={item.id} className="mt-1 font-bold text-[#245D50]">
                      마감: {item.date} (D-{item.d_day})
                    </p>
                  ))}
                {workspace.analysis.eligibility.slice(0, 3).map((item) => (
                  <p key={item}>· {item}</p>
                ))}
              </div>
            </section>
          ) : null}
          {workspace.blueprint ? (
            <section>
              <h2 className="mb-2 text-xs font-extrabold text-[#24312D]">문서 구조 설계</h2>
              <BlueprintPanel blueprint={workspace.blueprint} />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
