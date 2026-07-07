'use client';

import type { ReactNode } from 'react';
import type { DocumentWorkspace, WorkspaceArtifact } from '@/lib/types';
import { BlueprintPanel } from './BlueprintPanel';
import { LocalAgentPanel } from './LocalAgentPanel';

const STATUS_LABELS: Record<string, string> = {
  empty: '자료 대기',
  files_added: '자료 추가됨',
  analyzed: '분석 완료',
  blueprint_ready: '구조 설계 완료',
  generated: '문서 생성 완료',
};

const ARTIFACT_STATUS_LABELS: Record<string, string> = {
  not_opened: '열기 전',
  opened: 'Excel에서 편집 중',
  synced: '저장 동기화됨',
  error: '확인 필요',
};

function simplifyConfirmation(text: string): string {
  const lowered = text.toLowerCase();
  if (lowered.includes('review exported cells')) return '최종 제출 전 Excel 셀 값을 확인해 주세요.';
  if (lowered.includes('notice analysis')) return '최종 사용 전 공고 분석을 먼저 실행해 주세요.';
  if (lowered.includes('spreadsheet') || lowered.includes('chart data')) {
    return '그래프를 만들 표 또는 스프레드시트 자료가 필요합니다.';
  }
  if (lowered.includes('numeric source table')) return '숫자 열이 있는 표가 없어 그래프는 만들지 않았습니다.';
  return text;
}

export function ArtifactPanel({
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

  const confirmation = Array.from(
    new Set((excelArtifact.plan?.confirmation_required ?? []).map(simplifyConfirmation)),
  );
  const statusLabel = ARTIFACT_STATUS_LABELS[excelArtifact.sync_state.status] ?? excelArtifact.sync_state.status;

  return (
    <section data-testid="artifact-card-excel" className="rounded-lg border border-[#DDE7E2] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-extrabold text-[#24312D]">Excel 산출물</h2>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#40504B]">{excelArtifact.filename}</p>
          <p className="mt-1 text-[11px] text-[#65736E]">{statusLabel}</p>
        </div>
        <span className="rounded-md bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">XLSX</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid={`artifact-open-${excelArtifact.id}`}
          disabled={busy}
          onClick={() => onOpen(excelArtifact.id)}
          className="rounded-lg bg-[#245D50] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
        >
          Excel 열기
        </button>
        <button
          type="button"
          data-testid={`artifact-sync-${excelArtifact.id}`}
          disabled={busy}
          onClick={() => onSync(excelArtifact.id)}
          className="rounded-lg border border-[#245D50] px-3 py-2 text-[11px] font-bold text-[#245D50] disabled:opacity-50"
        >
          저장 동기화
        </button>
      </div>

      {confirmation.length ? (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-4 text-amber-800">
          {confirmation.slice(0, 2).map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function WorkspaceLog({ logs }: { logs: string[] }) {
  return (
    <section data-testid="workspace-log" className="rounded-lg border border-[#DDE7E2] bg-white p-3">
      <h2 className="mb-2 text-xs font-extrabold text-[#24312D]">작업 로그</h2>
      {logs.length ? (
        <ol className="space-y-1 text-[11px] leading-4 text-[#40504B]">
          {logs.map((log, index) => (
            <li key={`${index}-${log}`}>{log}</li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] leading-4 text-[#65736E]">작업 기록이 여기에 남습니다.</p>
      )}
    </section>
  );
}

function AnalysisSummary({ workspace }: { workspace: DocumentWorkspace }) {
  const analysis = workspace.analysis;
  if (!analysis) {
    return (
      <section className="rounded-lg border border-[#DDE7E2] bg-white p-3">
        <h2 className="text-xs font-extrabold text-[#24312D]">프로젝트 요약</h2>
        <p className="mt-1 text-[11px] leading-4 text-[#65736E]">자료를 추가하면 공고 핵심 정보가 여기에 정리됩니다.</p>
      </section>
    );
  }

  const deadline = analysis.timeline.find((item) => item.is_deadline);

  return (
    <section data-testid="analysis-summary" className="rounded-lg border border-[#DDE7E2] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-extrabold text-[#24312D]">공고 핵심 정보</h2>
        <span className="rounded-md bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">
          {STATUS_LABELS[workspace.status] ?? workspace.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-[#24312D]">{analysis.title}</p>
      {analysis.organization ? <p className="mt-1 text-[11px] text-[#65736E]">{analysis.organization}</p> : null}
      {deadline ? (
        <p className="mt-2 text-[11px] font-bold text-[#245D50]">
          마감: {deadline.date} (D-{deadline.d_day})
        </p>
      ) : null}
      {analysis.eligibility.length ? (
        <div className="mt-2 space-y-1 text-[11px] leading-4 text-[#40504B]">
          {analysis.eligibility.slice(0, 2).map((item) => (
            <p key={item}>· {item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CollapsiblePanel({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="rounded-lg border border-[#DDE7E2] bg-white p-3">
      <summary className="cursor-pointer text-xs font-extrabold text-[#24312D]">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function WorkspaceContextPanel({
  workspace,
  artifacts,
  logs,
  busy,
  onOpenArtifact,
  onSyncArtifact,
}: {
  workspace: DocumentWorkspace;
  artifacts: WorkspaceArtifact[];
  logs: string[];
  busy: boolean;
  onOpenArtifact: (artifactId: string) => void;
  onSyncArtifact: (artifactId: string) => void;
}) {
  return (
    <aside className="w-[300px] shrink-0 space-y-3 overflow-y-auto border-l border-[#DDE7E2] bg-[#F8FAF9] px-4 py-4">
      <AnalysisSummary workspace={workspace} />
      <ArtifactPanel artifacts={artifacts} busy={busy} onOpen={onOpenArtifact} onSync={onSyncArtifact} />
      {workspace.blueprint ? (
        <CollapsiblePanel title="문서 구조">
          <BlueprintPanel blueprint={workspace.blueprint} />
        </CollapsiblePanel>
      ) : null}
      <CollapsiblePanel title="내 PC 자동화">
        <LocalAgentPanel />
      </CollapsiblePanel>
      <CollapsiblePanel title={`작업 로그${logs.length ? ` ${logs.length}` : ''}`} open={logs.length > 0}>
        <WorkspaceLog logs={logs} />
      </CollapsiblePanel>
    </aside>
  );
}
