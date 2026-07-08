'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  confirmWorkflow,
  exportWorkflowHtml,
  exportWorkflowHwpx,
  exportWorkflowPdf,
  finalizeWorkflow,
  getProjectIntegrity,
  type IntegrityReport,
} from '@/lib/api';
import type { ExportResponse, WorkflowSession } from '@/lib/types';

const FALLBACK_CHECKS: Array<[string, string]> = [
  ['C1', '모든 필수 칸이 채워졌는지'],
  ['C2', '숫자·금액이 공고 및 입력과 일치하는지'],
  ['C3', '글자수 제한을 지켰는지'],
  ['C4', '제출 서류 목록이 충족됐는지'],
  ['C5', '문서 구조가 양식 원본과 일치하는지'],
];

function withUnverifiedSuffix(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return `${filename}_검증전`;
  return `${filename.slice(0, dot)}_검증전${filename.slice(dot)}`;
}

function downloadExport(exported: ExportResponse, rename?: (name: string) => string) {
  const bytes =
    exported.encoding === 'base64'
      ? Uint8Array.from(atob(exported.content), (ch) => ch.charCodeAt(0))
      : new TextEncoder().encode(exported.content);
  const blob = new Blob([bytes], { type: exported.content_type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = rename ? rename(exported.filename) : exported.filename;
  a.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

type ExportFormat = 'hwpx' | 'pdf' | 'html';

export function ExportStage({
  workflow,
  projectId,
  onWorkflow,
  onVerified,
  onExported,
}: {
  workflow: WorkflowSession;
  projectId: string;
  onWorkflow: (workflow: WorkflowSession) => void;
  onVerified: () => void;
  onExported: () => void;
}) {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getProjectIntegrity(projectId);
      if (cancelled) return;
      setReport(result);
      setReportLoaded(true);
      if (result?.passed) onVerifiedRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // 확인 필요 항목(사용자 확인 전 스킵 금지)
  const requiredConfirmations = Array.from(
    new Set(workflow.draft_sections.flatMap((section) => section.confirmation_required)),
  );
  const confirmed = new Set(workflow.confirmed_items ?? []);
  const pendingConfirmations = requiredConfirmations.filter((item) => !confirmed.has(item));

  const confirmItems = async () => {
    setBusy('confirm');
    setError('');
    try {
      const res = await confirmWorkflow(workflow.id, [...(workflow.confirmed_items ?? []), ...checkedItems]);
      onWorkflow(res.data);
      setCheckedItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  };

  const runExport = async (format: ExportFormat, bypass = false) => {
    setBusy(format + (bypass ? '-bypass' : ''));
    setError('');
    try {
      let current = workflow;
      if (!current.final_document) {
        const finalized = await finalizeWorkflow(current.id);
        current = finalized.data;
        onWorkflow(current);
      }
      let exported: ExportResponse;
      if (format === 'hwpx') exported = await exportWorkflowHwpx(current.id);
      else if (format === 'pdf') exported = await exportWorkflowPdf(current.id);
      else exported = await exportWorkflowHtml(current.id);
      downloadExport(exported, bypass ? withUnverifiedSuffix : undefined);
      onExported();
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  };

  const gatedByIntegrity = report !== null && !report.passed;
  const gatedByConfirmation = pendingConfirmations.length > 0;
  const canDownload = !gatedByIntegrity && !gatedByConfirmation;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5" data-testid="integrity-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#24312D]">무결성 검사</h2>
          {report ? (
            <span
              className={[
                'rounded-full px-2.5 py-1 text-[11px] font-bold',
                report.passed ? 'bg-[#EDF7F2] text-[#245D50]' : 'bg-red-50 text-red-600',
              ].join(' ')}
            >
              {report.passed ? '전체 통과' : '보완 필요'}
            </span>
          ) : reportLoaded ? (
            <span className="rounded-full bg-[#F3F7F5] px-2.5 py-1 text-[11px] font-bold text-[#65736E]">
              검사 준비 중
            </span>
          ) : null}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {report
            ? report.checks.map((check) => (
                <li key={check.code} className="flex items-center gap-3">
                  <span className="rounded-full bg-[#F3F7F5] px-2 py-0.5 text-[11px] font-bold text-[#65736E]">
                    {check.code}
                  </span>
                  <span className="flex-1 text-[#40504B]">
                    {check.label}
                    {check.detail ? <span className="ml-2 text-[11px] text-[#65736E]">{check.detail}</span> : null}
                  </span>
                  {check.passed ? (
                    <span className="text-[11px] font-bold text-[#245D50]">통과</span>
                  ) : check.section_id ? (
                    <Link
                      href={`/app/p/${projectId}/5-draft#section-${check.section_id}`}
                      className="text-[11px] font-bold text-red-600 underline-offset-2 hover:underline"
                    >
                      실패 — 해당 칸으로
                    </Link>
                  ) : (
                    <span className="text-[11px] font-bold text-red-600">실패</span>
                  )}
                </li>
              ))
            : FALLBACK_CHECKS.map(([code, label]) => (
                <li key={code} className="flex items-center gap-3">
                  <span className="rounded-full bg-[#F3F7F5] px-2 py-0.5 text-[11px] font-bold text-[#65736E]">
                    {code}
                  </span>
                  <span className="flex-1 text-[#40504B]">{label}</span>
                  <span className="text-[11px] font-bold text-[#65736E]">검사 준비 중</span>
                </li>
              ))}
        </ul>
        {!report && reportLoaded ? (
          <p className="mt-3 text-xs leading-5 text-[#65736E]">
            검사 기능이 연결되면 통과한 문서만 기본 다운로드가 활성화됩니다. 지금은 검사 없이 내려받을 수
            있습니다.
          </p>
        ) : null}
      </section>

      {pendingConfirmations.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5" data-testid="confirmation-card">
          <h2 className="text-sm font-extrabold text-amber-900">내보내기 전에 확인해 주세요</h2>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            아래 내용은 공고에서 확정하지 못했습니다. 사실이 맞는지 확인해야 내려받을 수 있습니다.
          </p>
          <ul className="mt-3 space-y-2">
            {pendingConfirmations.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-amber-900">
                <input
                  type="checkbox"
                  id={`confirm-${item}`}
                  checked={checkedItems.includes(item)}
                  onChange={(e) =>
                    setCheckedItems((prev) => (e.target.checked ? [...prev, item] : prev.filter((v) => v !== item)))
                  }
                  className="mt-1"
                />
                <label htmlFor={`confirm-${item}`}>{item}</label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="confirm-items"
            disabled={busy === 'confirm' || checkedItems.length !== pendingConfirmations.length}
            onClick={confirmItems}
            className="mt-4 rounded-full bg-[#245D50] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
          >
            모두 확인했습니다
          </button>
        </section>
      ) : null}

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p> : null}

      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5" data-testid="export-card">
        <h2 className="text-sm font-extrabold text-[#24312D]">내보내기</h2>
        <p className="mt-1 text-xs leading-5 text-[#65736E]">
          HWPX는 원본 양식 구조를 그대로 지킵니다. 내려받은 문서는 산출물 기록에 남습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['hwpx', 'HWPX 다운로드', true],
              ['pdf', 'PDF 다운로드', false],
              ['html', 'HTML 다운로드', false],
            ] as Array<[ExportFormat, string, boolean]>
          ).map(([format, label, primary]) => (
            <button
              key={format}
              type="button"
              data-testid={`export-${format}`}
              disabled={!canDownload || busy !== null}
              onClick={() => runExport(format)}
              className={[
                'rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-50',
                primary
                  ? 'bg-[#245D50] text-white hover:bg-[#3A7A68]'
                  : 'border border-[#245D50] text-[#245D50] hover:bg-[#EDF7F2]',
              ].join(' ')}
            >
              {busy === format ? '내보내는 중…' : label}
            </button>
          ))}
        </div>
        {gatedByConfirmation ? (
          <p className="mt-3 text-xs text-amber-800">위의 확인 항목을 먼저 확인해 주세요.</p>
        ) : null}
        {gatedByIntegrity ? (
          <p className="mt-3 text-xs text-[#65736E]">
            검사를 통과하지 못했습니다. 실패 항목을 고치는 것이 좋지만, 필요하면{' '}
            <button
              type="button"
              data-testid="export-bypass"
              disabled={busy !== null || gatedByConfirmation}
              onClick={() => runExport('hwpx', true)}
              className="font-bold text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
            >
              검사 무시하고 다운로드
            </button>
            할 수 있습니다. 파일명에 _검증전이 붙습니다.
          </p>
        ) : null}
      </section>
    </div>
  );
}
