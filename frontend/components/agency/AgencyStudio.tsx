'use client';

import { useState } from 'react';
import { createAgencyNoticeDraft, exportAgencyNoticeDraft, transitionAgencyNoticeDraft } from '@/lib/api';
import type { AgencyNoticeBrief, AgencyNoticeDraft, AgencyPriorNotice, ExportResponse } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { IrisNoticeFeed } from '@/components/agency/IrisNoticeFeed';
import { NoticeBriefForm } from '@/components/agency/NoticeBriefForm';
import { NoticeDocumentEditor } from '@/components/agency/NoticeDocumentEditor';
import { ApprovalDrawer } from '@/components/agency/ApprovalDrawer';

export type StudioStage = 'discover' | 'brief' | 'edit' | 'review' | 'export';

const STAGES: Array<{ id: StudioStage; label: string; hint: string }> = [
  { id: 'discover', label: '공고 탐색', hint: 'IRIS 공고를 참고자료로 담기' },
  { id: 'brief', label: '사업 브리프', hint: '우리 사업 정보 입력' },
  { id: 'edit', label: '문서 편집', hint: '공고문 초안을 직접 다듬기' },
  { id: 'review', label: '검토·승인', hint: '승인 단계와 필수 조항 확인' },
  { id: 'export', label: 'Export', hint: 'HWPX · PDF · DOCX' },
];

const defaultBrief: AgencyNoticeBrief = {
  organization_id: '00000000-0000-4000-8000-000000000001',
  author_id: 'demo-user',
  author_name: '사업 담당자',
  agency_name: '',
  title: '',
  program_type: 'support_program',
  program_purpose: '',
  budget: '',
  program_period: '',
  eligibility_rules: '',
  support_details: '',
  evaluation_criteria: '',
  submission_method: '',
  required_documents: [],
  contact: '',
  legal_basis: '',
  privacy_policy: '',
  fair_competition_clause: '',
  appeal_process: '',
  references: [],
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

export function statusLabel(status: AgencyNoticeDraft['status']) {
  const labels: Record<AgencyNoticeDraft['status'], string> = {
    draft: '초안',
    under_review: '검토 중',
    revision_requested: '수정 요청',
    approving: '최종 승인 중',
    approved: '승인 완료',
    published: '게시 준비 완료',
  };
  return labels[status];
}

export function AgencyStudio({ initialDraft = null }: { initialDraft?: AgencyNoticeDraft | null }) {
  const [stage, setStage] = useState<StudioStage>(initialDraft ? 'edit' : 'discover');
  const [brief, setBrief] = useState<AgencyNoticeBrief>(defaultBrief);
  const [draft, setDraft] = useState<AgencyNoticeDraft | null>(initialDraft);
  const [savedReferences, setSavedReferences] = useState<AgencyPriorNotice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(label: string, task: () => Promise<T>, onDone: (value: T) => void | Promise<void>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await task();
      await onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 처리에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function handleReferenceSaved(reference: AgencyPriorNotice) {
    setSavedReferences((prev) => (prev.some((item) => item.id === reference.id) ? prev : [...prev, reference]));
    setBrief((current) => {
      if (current.references.some((item) => item.id === reference.id)) return current;
      return {
        ...current,
        references: [
          ...current.references,
          {
            id: reference.id,
            source_type: 'prior_notice',
            filename: reference.source_filename ?? '',
            title: reference.title,
            text: reference.summary || reference.text || '',
            evidence_label: reference.title,
          },
        ],
      };
    });
    setNotice(`"${reference.title}"을(를) 참고자료로 담았습니다. 사업 브리프 단계에서 확인할 수 있습니다.`);
  }

  async function generateDraft() {
    await run(
      'generate',
      () => createAgencyNoticeDraft(brief),
      (res) => {
        setDraft(res.data);
        setStage('edit');
        setNotice('공고문 초안을 생성했습니다. 문서에서 섹션을 클릭해 바로 수정할 수 있습니다.');
      },
    );
  }

  async function transition(action: 'submit-review' | 'request-revision' | 'approve' | 'publish', message: string) {
    if (!draft) return;
    await run(
      action,
      () => transitionAgencyNoticeDraft(draft.id, action, message),
      (res) => {
        setDraft(res.data);
        setNotice(message);
      },
    );
  }

  async function exportDraft(format: 'hwpx' | 'pdf' | 'docx') {
    if (!draft) return;
    await run(
      `export-${format}`,
      () => exportAgencyNoticeDraft(draft.id, format),
      (res) => {
        downloadExport(res);
        setNotice(`${res.filename} 파일을 내려받았습니다.`);
      },
    );
  }

  const stageIndex = STAGES.findIndex((item) => item.id === stage);
  const stageEnabled = (target: StudioStage) =>
    target === 'discover' || target === 'brief' || Boolean(draft);

  return (
    <div className="space-y-5">
      <section className="border-b border-[#DDE7E2] pb-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-[#3A7A68]">공고 스튜디오</p>
          <h1 className="text-3xl font-bold text-[#24312D]">IRIS 공고를 참고해 우리 기관 공고문을 만듭니다</h1>
          <p className="text-sm leading-6 text-[#65736E]">
            {draft
              ? `${draft.title} · ${statusLabel(draft.status)} · 확인 필요 ${draft.confirmation_required.length}건`
              : '접수 중인 공고를 둘러보고, 참고자료를 담고, 브리프만 채우면 초안이 만들어집니다.'}
          </p>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="작성 단계">
          {STAGES.map((item, index) => {
            const isActive = item.id === stage;
            const isDone = index < stageIndex;
            const enabled = stageEnabled(item.id);
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`studio-stage-${item.id}`}
                onClick={() => enabled && setStage(item.id)}
                disabled={!enabled}
                className={[
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition',
                  isActive
                    ? 'border-[#245D50] bg-[#245D50] text-white'
                    : isDone
                      ? 'border-[#6A9C89] bg-[#EDF7F2] text-[#245D50]'
                      : enabled
                        ? 'border-[#DDE7E2] bg-white text-[#40504B] hover:border-[#6A9C89]'
                        : 'border-[#DDE7E2] bg-[#F8FBFA] text-[#65736E] opacity-60',
                ].join(' ')}
              >
                <span className={[
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                  isActive ? 'bg-white text-[#245D50]' : 'bg-[#EDF7F2] text-[#245D50]',
                ].join(' ')}
                >
                  {index + 1}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <p className="mt-2 text-xs text-[#65736E]">{STAGES[stageIndex]?.hint}</p>

        {notice ? <p className="mt-3 rounded-md bg-[#EDF7F2] px-3 py-2 text-sm text-[#245D50]" data-testid="studio-notice">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-md bg-[#FEF2F2] px-3 py-2 text-sm text-[#B42318]" data-testid="studio-error">{error}</p> : null}
      </section>

      {stage === 'discover' && (
        <div className="space-y-4">
          <IrisNoticeFeed organizationId={brief.organization_id} onReferenceSaved={handleReferenceSaved} />
          <div className="flex justify-end">
            <Button onClick={() => setStage('brief')} data-testid="studio-next-brief">
              {savedReferences.length ? `참고자료 ${savedReferences.length}건과 함께 브리프 작성` : '참고자료 없이 브리프 작성'}
            </Button>
          </div>
        </div>
      )}

      {stage === 'brief' && (
        <NoticeBriefForm
          brief={brief}
          onBriefChange={setBrief}
          busy={busy}
          onGenerate={generateDraft}
          onBack={() => setStage('discover')}
        />
      )}

      {stage === 'edit' && draft && (
        <NoticeDocumentEditor
          draft={draft}
          onDraftChange={setDraft}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setNotice={setNotice}
          onExport={exportDraft}
          onGoReview={() => setStage('review')}
        />
      )}

      {stage === 'review' && draft && (
        <ApprovalDrawer
          draft={draft}
          onDraftChange={setDraft}
          busy={busy}
          onTransition={transition}
          onBack={() => setStage('edit')}
          onGoExport={() => setStage('export')}
        />
      )}

      {stage === 'export' && draft && (
        <section className="rounded-2xl border border-[#DDE7E2] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold text-[#3A7A68]">Export</p>
          <h2 className="mt-2 text-2xl font-bold text-[#24312D]">{draft.title}</h2>
          <p className="mt-2 text-sm text-[#65736E]">
            현재 상태: {statusLabel(draft.status)} · 원하는 형식으로 내려받으세요.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => void exportDraft('hwpx')} disabled={busy !== null} data-testid="studio-export-hwpx">
              {busy === 'export-hwpx' ? '생성 중...' : 'HWPX 다운로드'}
            </Button>
            <Button variant="secondary" onClick={() => void exportDraft('pdf')} disabled={busy !== null}>
              {busy === 'export-pdf' ? '생성 중...' : 'PDF 다운로드'}
            </Button>
            <Button variant="secondary" onClick={() => void exportDraft('docx')} disabled={busy !== null}>
              {busy === 'export-docx' ? '생성 중...' : 'DOCX 다운로드'}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setStage('review')}
            className="mt-6 text-xs font-bold text-[#3A7A68] underline underline-offset-2"
          >
            검토 단계로 돌아가기
          </button>
        </section>
      )}

      {(stage === 'edit' || stage === 'review' || stage === 'export') && !draft && (
        <section className="rounded-2xl border border-dashed border-[#DDE7E2] bg-[#F8FBFA] p-10 text-center">
          <p className="text-sm text-[#65736E]">아직 초안이 없습니다. 사업 브리프 단계에서 초안을 먼저 생성해 주세요.</p>
        </section>
      )}
    </div>
  );
}
