'use client';

import { useEffect, useRef, useState } from 'react';
import { createDraftStream, getWorkflow, restoreWorkflow, reviseDraft, saveDraftFeedback } from '@/lib/api';
import type { DraftSection, DraftStreamEvent, WorkflowSession } from '@/lib/types';
import { EvidencePanel } from './EvidencePanel';

function statusLabel(status: DraftSection['status']): { text: string; tone: 'green' | 'neutral' | 'red' } {
  switch (status) {
    case 'drafted':
      return { text: '초안 완료', tone: 'green' };
    case 'revised':
      return { text: '수정됨', tone: 'green' };
    case 'confirmed':
      return { text: '확인됨', tone: 'green' };
    case 'needs_input':
      return { text: '입력 필요', tone: 'red' };
    default:
      return { text: '비어 있음', tone: 'neutral' };
  }
}

function SectionCard({
  section,
  busy,
  onHighlight,
  onDirectSave,
  onAiRevise,
}: {
  section: DraftSection;
  busy: boolean;
  onHighlight: (key: string) => void;
  onDirectSave: (sectionId: string, content: string) => Promise<void>;
  onAiRevise: (sectionId: string, feedback: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content_markdown);
  const [feedback, setFeedback] = useState(section.user_feedback ?? '');
  const [showFeedback, setShowFeedback] = useState(false);
  const status = statusLabel(section.status);
  const count = (editing ? draft : section.content_markdown).length;

  useEffect(() => {
    if (!editing) setDraft(section.content_markdown);
  }, [section.content_markdown, editing]);

  return (
    <article
      id={`section-${section.section_id}`}
      data-testid={`draft-section-${section.section_id}`}
      className="rounded-2xl border border-[#DDE7E2] bg-white p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-extrabold text-[#24312D]">{section.title}</h3>
        <span
          className={[
            'rounded-full px-2.5 py-0.5 text-[10px] font-bold',
            status.tone === 'green'
              ? 'bg-[#EDF7F2] text-[#245D50]'
              : status.tone === 'red'
                ? 'bg-red-50 text-red-600'
                : 'bg-[#F3F7F5] text-[#65736E]',
          ].join(' ')}
        >
          {status.text}
        </span>
        <span className="text-[10px] text-[#65736E]">{count.toLocaleString()}자</span>
      </header>

      {section.related_criteria.length || section.source_evidence_ids.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {section.related_criteria.map((name) => (
            <button
              key={name}
              type="button"
              data-testid={`chip-crit-${section.section_id}-${name}`}
              onClick={() => onHighlight(`crit-${name}`)}
              className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50] transition hover:bg-[#DDE7E2]"
            >
              평가기준 · {name}
            </button>
          ))}
          {section.source_evidence_ids.map((evidenceId) => (
            <button
              key={evidenceId}
              type="button"
              onClick={() => onHighlight(`ev-${evidenceId}`)}
              className="rounded-full bg-[#F3F7F5] px-2 py-0.5 text-[10px] font-bold text-[#65736E] transition hover:bg-[#DDE7E2]"
            >
              근거 · {evidenceId}
            </button>
          ))}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3">
          <textarea
            data-testid={`section-editor-${section.section_id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(16, Math.max(6, draft.split('\n').length + 2))}
            className="w-full rounded-xl border border-[#DDE7E2] px-3 py-2 text-sm leading-6 text-[#24312D] focus:border-[#6A9C89] focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid={`section-save-${section.section_id}`}
              disabled={busy}
              onClick={async () => {
                await onDirectSave(section.section_id, draft);
                setEditing(false);
              }}
              className="rounded-full bg-[#245D50] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(section.content_markdown);
                setEditing(false);
              }}
              className="text-xs font-semibold text-[#65736E]"
            >
              취소
            </button>
            <span className="ml-auto text-[10px] text-[#65736E]">{draft.length.toLocaleString()}자</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#40504B]">
          {section.content_markdown || '아직 내용이 없습니다. AI 초안을 받거나 직접 입력해 주세요.'}
        </div>
      )}

      {section.confirmation_required.length ? (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
          {section.confirmation_required.map((item) => (
            <p key={item}>확인 필요 · {item}</p>
          ))}
        </div>
      ) : null}

      {!editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F3F7F5] pt-3">
          <button
            type="button"
            data-testid={`section-edit-${section.section_id}`}
            disabled={busy}
            onClick={() => setEditing(true)}
            className="rounded-full border border-[#245D50] px-4 py-1.5 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
          >
            직접 입력
          </button>
          <button
            type="button"
            data-testid={`section-revise-${section.section_id}`}
            disabled={busy}
            onClick={() => setShowFeedback((v) => !v)}
            className="rounded-full border border-[#DDE7E2] px-4 py-1.5 text-xs font-bold text-[#40504B] transition hover:border-[#6A9C89] disabled:opacity-50"
          >
            AI 초안 다시 받기
          </button>
        </div>
      ) : null}

      {showFeedback && !editing ? (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            data-testid={`section-feedback-${section.section_id}`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="어떻게 고칠지 알려 주세요 (예: 수치를 앞세워 간결하게)"
            className="flex-1 rounded-full border border-[#DDE7E2] px-3 py-1.5 text-xs focus:border-[#6A9C89] focus:outline-none"
          />
          <button
            type="button"
            data-testid={`section-revise-run-${section.section_id}`}
            disabled={busy}
            onClick={async () => {
              await onAiRevise(section.section_id, feedback);
              setShowFeedback(false);
            }}
            className="rounded-full bg-[#245D50] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
          >
            다시 받기
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function DraftStage({
  workflow,
  onWorkflow,
  onGoExport,
}: {
  workflow: WorkflowSession;
  onWorkflow: (workflow: WorkflowSession) => void;
  onGoExport: () => void;
}) {
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [activeDelta, setActiveDelta] = useState('');
  const [error, setError] = useState('');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => esRef.current?.close(), []);

  const startStream = () => {
    setStreaming(true);
    setStreamLog([]);
    setActiveDelta('');
    setError('');
    esRef.current?.close();
    const es = createDraftStream(workflow.id, (event: DraftStreamEvent) => {
      if (event.type === 'section_start') {
        setActiveDelta('');
        setStreamLog((prev) => [...prev, event.content]);
      } else if (event.type === 'delta') {
        setActiveDelta((prev) => prev + event.content);
      } else if (event.type === 'workflow_done') {
        es.close();
        esRef.current = null;
        getWorkflow(workflow.id).then((res) => {
          onWorkflow(res.data);
          setStreaming(false);
        });
      } else if (event.type === 'error') {
        setError(event.content);
        es.close();
        esRef.current = null;
        setStreaming(false);
      }
    });
    esRef.current = es;
  };

  const directSave = async (sectionId: string, content: string) => {
    setBusy(true);
    setError('');
    try {
      const next: WorkflowSession = {
        ...workflow,
        draft_sections: workflow.draft_sections.map((section) =>
          section.section_id === sectionId
            ? { ...section, content_markdown: content, status: 'revised' as const }
            : section,
        ),
      };
      const res = await restoreWorkflow(workflow.id, next);
      onWorkflow(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const aiRevise = async (sectionId: string, feedback: string) => {
    setBusy(true);
    setError('');
    try {
      if (feedback.trim()) await saveDraftFeedback(workflow.id, sectionId, feedback.trim());
      const res = await reviseDraft(workflow.id, sectionId);
      onWorkflow(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '다시 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const sections = workflow.draft_sections ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <EvidencePanel analysis={workflow.analysis} inputs={workflow.user_inputs ?? []} highlightKey={highlightKey} />
      </aside>

      <div className="min-w-0 space-y-4">
        {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p> : null}

        {!sections.length && !streaming ? (
          <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 text-center">
            <p className="text-sm font-bold text-[#24312D]">항목별 초안을 받아 보세요</p>
            <p className="mt-1 text-xs leading-5 text-[#65736E]">
              공고 근거와 내 답변만 사용해 작성합니다. 확인이 필요한 내용은 표시해 드립니다.
            </p>
            <button
              type="button"
              data-testid="draft-start"
              onClick={startStream}
              className="mt-4 rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
            >
              AI 초안 받기
            </button>
          </div>
        ) : null}

        {streaming ? (
          <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5" data-testid="draft-streaming">
            <p className="text-xs font-bold text-[#245D50]">작성 중…</p>
            <ul className="mt-2 space-y-1 text-[11px] text-[#65736E]">
              {streamLog.map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ul>
            {activeDelta ? (
              <p className="mt-2 max-h-40 overflow-hidden whitespace-pre-wrap text-xs leading-5 text-[#40504B]">
                {activeDelta}
              </p>
            ) : null}
          </div>
        ) : null}

        {sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            busy={busy}
            onHighlight={setHighlightKey}
            onDirectSave={directSave}
            onAiRevise={aiRevise}
          />
        ))}

        {sections.length && !streaming ? (
          <div className="flex items-center justify-between rounded-2xl border border-[#DDE7E2] bg-white px-5 py-4">
            <p className="text-xs text-[#65736E]">미채움 항목은 다음 단계의 검사에서 잡아 드립니다.</p>
            <button
              type="button"
              data-testid="draft-go-export"
              onClick={onGoExport}
              className="rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
            >
              검사·내보내기로
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
