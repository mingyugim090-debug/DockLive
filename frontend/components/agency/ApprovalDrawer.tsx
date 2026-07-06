'use client';

import { useMemo, useState } from 'react';
import { addAgencyNoticeComment } from '@/lib/api';
import type { AgencyNoticeDraft } from '@/lib/types';
import { Button } from '@/components/ui/Button';

type TransitionAction = 'submit-review' | 'request-revision' | 'approve' | 'publish';

interface ApprovalDrawerProps {
  draft: AgencyNoticeDraft;
  onDraftChange: (draft: AgencyNoticeDraft) => void;
  busy: string | null;
  onTransition: (action: TransitionAction, message: string) => Promise<void>;
  onBack: () => void;
  onGoExport: () => void;
}

const STEP_STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  active: '진행 중',
  approved: '승인',
  changes_requested: '수정 요청',
  skipped: '건너뜀',
};

const CLAUSE_STATUS_LABEL: Record<string, string> = {
  satisfied: '충족',
  missing: '누락',
  needs_confirmation: '확인 필요',
};

export function ApprovalDrawer({ draft, onDraftChange, busy, onTransition, onBack, onGoExport }: ApprovalDrawerProps) {
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  const missingClauses = useMemo(
    () => draft.mandatory_clause_checks.filter((check) => check.status === 'missing'),
    [draft.mandatory_clause_checks],
  );

  async function submitComment() {
    if (!commentText.trim()) return;
    setCommentBusy(true);
    try {
      const res = await addAgencyNoticeComment(draft.id, commentText.trim());
      onDraftChange(res.data);
      setCommentText('');
    } finally {
      setCommentBusy(false);
    }
  }

  const canSubmitReview = ['draft', 'revision_requested'].includes(draft.status);
  const canApprove = ['under_review', 'approving'].includes(draft.status);
  const canPublish = draft.status === 'approved';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#3A7A68]">검토·승인</p>
              <h2 className="mt-1 text-xl font-bold text-[#24312D]">{draft.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void onTransition('submit-review', '팀장 검토를 요청했습니다.')}
                disabled={busy !== null || !canSubmitReview}
                data-testid="approval-submit-review"
              >
                검토 요청
              </Button>
              <Button
                onClick={() => void onTransition('approve', '승인 단계를 진행했습니다.')}
                disabled={busy !== null || !canApprove}
                data-testid="approval-approve"
              >
                승인
              </Button>
              <Button
                variant="secondary"
                onClick={() => void onTransition('request-revision', '수정 요청을 남겼습니다.')}
                disabled={busy !== null || !canApprove}
              >
                수정 요청
              </Button>
              {canPublish && (
                <Button onClick={() => void onTransition('publish', '게시용 최종본을 확정했습니다.')} disabled={busy !== null} data-testid="approval-publish">
                  게시 확정
                </Button>
              )}
            </div>
          </div>

          <ol className="mt-6 space-y-4">
            {draft.approval_workflow.steps.map((step) => (
              <li key={step.id} className="flex gap-3">
                <div
                  className={[
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    step.status === 'approved'
                      ? 'bg-[#C8DBD2] text-[#245D50]'
                      : step.status === 'active'
                        ? 'bg-[#245D50] text-white'
                        : step.status === 'changes_requested'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[#EDF2EF] text-[#65736E]',
                  ].join(' ')}
                >
                  {step.step_order}
                </div>
                <div className="flex-1 border-b border-[#EDF2EF] pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#24312D]">{step.title}</p>
                    <span className="text-xs font-bold text-[#65736E]">{STEP_STATUS_LABEL[step.status] ?? step.status}</span>
                  </div>
                  {step.decision_note && <p className="mt-1 text-xs leading-5 text-[#65736E]">{step.decision_note}</p>}
                </div>
              </li>
            ))}
          </ol>

          {missingClauses.length > 0 && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              필수 조항 {missingClauses.length}건이 누락되어 검토 요청이 제한될 수 있습니다. 문서 편집 단계에서 채워 주세요.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">필수 조항 점검</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {draft.mandatory_clause_checks.map((check) => (
              <li key={check.id} className="rounded-xl border border-[#EDF2EF] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#24312D]">{check.label}</p>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      check.status === 'satisfied' ? 'bg-[#EDF7F2] text-[#245D50]' : 'bg-amber-100 text-amber-700',
                    ].join(' ')}
                  >
                    {CLAUSE_STATUS_LABEL[check.status] ?? check.status}
                  </span>
                </div>
                {check.note && <p className="mt-1 text-[11px] leading-4 text-[#65736E]">{check.note}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <Button variant="secondary" onClick={onBack}>
            문서 편집으로
          </Button>
          <Button onClick={onGoExport} disabled={busy !== null} data-testid="approval-go-export">
            Export 단계로
          </Button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">코멘트</h3>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={3}
            placeholder="검토 의견을 남기면 현재 버전에 기록됩니다."
            className="mt-3 w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
            data-testid="approval-comment-input"
          />
          <Button
            variant="secondary"
            onClick={() => void submitComment()}
            disabled={commentBusy || !commentText.trim()}
            className="mt-2 w-full"
            data-testid="approval-comment-submit"
          >
            {commentBusy ? '남기는 중...' : '코멘트 남기기'}
          </Button>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto">
            {draft.comments.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-[#F8FBFA] px-3 py-2">
                <p className="text-xs font-bold text-[#40504B]">{comment.author_name}</p>
                <p className="mt-1 text-xs leading-5 text-[#65736E]">{comment.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">버전 기록</h3>
          <div className="mt-3 max-h-56 space-y-2 overflow-auto">
            {[...draft.versions].reverse().map((version) => (
              <div key={version.id} className="rounded-xl border border-[#EDF2EF] px-3 py-2">
                <p className="text-xs font-bold text-[#24312D]">
                  v{version.version_number} · {version.created_by}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#65736E]">{version.change_summary}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
