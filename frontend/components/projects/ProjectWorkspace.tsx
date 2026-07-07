'use client';

import { useCallback, useState } from 'react';
import {
  analyzeWorkspace,
  buildWorkspaceBlueprint,
  createDemoWorkspace,
  createWorkspace,
  exportWorkspace,
  generateWorkspaceDocument,
  transformWorkspaceBlock,
  uploadWorkspaceFile,
} from '@/lib/api';
import type { DocumentWorkspace, InlineTransformCommand, WorkspaceStatus } from '@/lib/types';
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

function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProjectWorkspace() {
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [transformBusy, setTransformBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

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
    });

  const startEmpty = () =>
    run(async () => {
      const res = await createWorkspace('새 문서 프로젝트');
      setWorkspace(res.data);
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

  const handleExport = (format: 'markdown' | 'html') =>
    run(async () => {
      if (!workspace) return;
      const res = await exportWorkspace(workspace.id, format);
      downloadText(res.filename, res.content, res.content_type);
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
