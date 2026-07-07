'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { DocumentCanvas } from './DocumentCanvas';
import { ExportBar } from './ExportBar';
import { WorkspaceNextAction, type WorkspaceAction } from './WorkspaceNextAction';
import { WorkspaceContextPanel } from './WorkspacePanels';
import { WorkspaceUploader } from './WorkspaceUploader';

const STEPS: { key: WorkspaceStatus[]; label: string }[] = [
  { key: ['empty', 'files_added'], label: '① 자료 모으기' },
  { key: ['analyzed'], label: '② 공고 분석' },
  { key: ['blueprint_ready'], label: '③ 구조 설계' },
  { key: ['generated'], label: '④ 문서 완성' },
];
const EXCEL_SYNC_POLL_MS = 5000;

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

function workspaceStageCopy(workspace: DocumentWorkspace, hasAnalyzableFile: boolean) {
  if (!workspace.files.length) {
    return {
      title: '자료를 먼저 모아 주세요',
      description: '공고문, HWPX/PDF, 예산표, 참고 문서를 추가하면 다음 단계가 열립니다.',
    };
  }
  if (!workspace.analysis && hasAnalyzableFile) {
    return {
      title: '공고에서 핵심 조건을 추출하세요',
      description: '마감일, 지원 대상, 제출 서류, 평가 기준을 먼저 정리합니다.',
    };
  }
  if (!workspace.blueprint) {
    return {
      title: '문서 구조를 잡으세요',
      description: '업로드한 표와 공고 근거를 어떤 섹션에 배치할지 설계합니다.',
    };
  }
  if (!workspace.document) {
    return {
      title: '초안 문서를 생성하세요',
      description: '근거가 있는 내용만 넣고, 부족한 섹션은 입력 필요 상태로 남깁니다.',
    };
  }
  return {
    title: '문서를 검토하고 내보내세요',
    description: '필요한 블록을 다듬은 뒤 HWPX, PDF, DOCX로 받을 수 있습니다.',
  };
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

  const pollingExcelArtifact = workspace?.artifacts?.find(
    (artifact) =>
      artifact.kind === 'excel' &&
      Boolean(artifact.sync_state.last_opened_at) &&
      ['opened', 'synced'].includes(artifact.sync_state.status),
  );

  useEffect(() => {
    if (!workspace?.id || !pollingExcelArtifact) return undefined;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const res = await syncWorkspaceArtifact(workspace.id, pollingExcelArtifact.id);
        if (cancelled) return;
        setWorkspace((current) => (current ? replaceArtifact(current, res.data) : current));
        if (res.data.sync_state.last_synced_at !== pollingExcelArtifact.sync_state.last_synced_at) {
          pushLog(`Excel auto sync: ${res.data.filename}`);
        }
      } catch (e) {
        if (!cancelled) {
          pushLog(`Excel sync warning: ${e instanceof Error ? e.message : 'sync failed'}`);
        }
      }
    }, EXCEL_SYNC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    pollingExcelArtifact?.id,
    pollingExcelArtifact?.sync_state.last_opened_at,
    pollingExcelArtifact?.sync_state.last_synced_at,
    pollingExcelArtifact?.sync_state.status,
    pushLog,
    workspace?.id,
  ]);

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
  const stageCopy = workspaceStageCopy(workspace, hasAnalyzableFile);
  const workflowActions: WorkspaceAction[] = [
    {
      id: 'analyze',
      label: workspace.analysis ? '공고 다시 분석' : '공고 분석 시작',
      description: '마감, 자격, 제출 서류를 정리합니다.',
      disabled: busy || !hasAnalyzableFile,
      testId: 'action-analyze',
      onClick: handleAnalyze,
    },
    {
      id: 'blueprint',
      label: workspace.blueprint ? '문서 구조 다시 설계' : '문서 구조 설계',
      description: '섹션과 표·그래프 배치를 만듭니다.',
      disabled: busy || !workspace.files.length,
      testId: 'action-blueprint',
      onClick: handleBlueprint,
    },
    {
      id: 'generate',
      label: busy ? '작업 중…' : workspace.document ? '문서 다시 생성' : '문서 생성',
      description: '근거 기반 초안 문서를 만듭니다.',
      disabled: busy || !workspace.blueprint,
      testId: 'action-generate',
      onClick: handleGenerate,
    },
    {
      id: 'excel',
      label: artifacts.some((item) => item.kind === 'excel') ? 'Excel 대시보드 다시 만들기' : 'Excel 대시보드 생성',
      description: '분석 요약과 표 자료를 XLSX로 정리합니다.',
      disabled: busy || !workspace.files.length,
      testId: 'action-excel-generate',
      onClick: handleGenerateExcel,
    },
  ];
  const primaryActionId: WorkspaceAction['id'] | null =
    !workspace.files.length
      ? null
      : !workspace.analysis && hasAnalyzableFile
        ? 'analyze'
        : !workspace.blueprint
          ? 'blueprint'
          : !workspace.document
            ? 'generate'
            : 'excel';
  const visibleActions = workflowActions.filter((action) => {
    if (!workspace.files.length) return false;
    if (action.id === 'analyze') return hasAnalyzableFile;
    if (action.id === 'generate') return Boolean(workspace.blueprint);
    return true;
  });
  const primaryAction = visibleActions.find((action) => action.id === primaryActionId) ?? null;
  const secondaryActions = visibleActions.filter((action) => action.id !== primaryActionId);

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
        <aside className="w-[320px] shrink-0 space-y-4 overflow-y-auto border-r border-[#DDE7E2] bg-white px-4 py-4">
          <section>
            <h2 className="mb-2 text-xs font-extrabold text-[#24312D]">프로젝트 자료</h2>
            <WorkspaceUploader files={workspace.files} busy={busy} onUpload={handleUpload} />
          </section>
          <WorkspaceNextAction
            title={stageCopy.title}
            description={stageCopy.description}
            primaryAction={primaryAction}
            secondaryActions={secondaryActions}
          />
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
            <div className="max-w-sm rounded-lg border border-[#DDE7E2] bg-white px-5 py-5 shadow-sm">
              <p className="font-bold text-[#40504B]">{stageCopy.title}</p>
              <p className="mt-2 text-xs leading-5">{stageCopy.description}</p>
              {primaryAction ? (
                <p className="mt-3 text-[11px] font-bold text-[#245D50]">
                  왼쪽의 “{primaryAction.label}” 버튼으로 이어서 진행하세요.
                </p>
              ) : null}
            </div>
          </div>
        )}

        <WorkspaceContextPanel
          workspace={workspace}
          artifacts={artifacts}
          logs={logs}
          busy={busy}
          onOpenArtifact={handleOpenArtifact}
          onSyncArtifact={handleSyncArtifact}
        />
      </div>
    </div>
  );
}
