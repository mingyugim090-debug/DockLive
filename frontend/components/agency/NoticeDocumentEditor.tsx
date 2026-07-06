'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { aiReviseAgencyNoticeSection, updateAgencyNoticeSection } from '@/lib/api';
import type { AgencyNoticeDraft, AgencyNoticeSection, DocumentStyleProfile } from '@/lib/types';
import { DEFAULT_DOCUMENT_STYLE_PROFILE_ID, documentStyleProfiles, getDocumentStyleProfile } from '@/lib/documentStyleProfiles';
import { Button } from '@/components/ui/Button';

function splitTableRow(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);
}

function DocumentMarkdown({ content }: { content: string }) {
  const nodes = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return [<p key="empty" className="text-xs italic opacity-60">내용이 비어 있습니다. 클릭해서 작성하세요.</p>];
    const elements: ReactNode[] = [];
    let listItems: string[] = [];
    const flushList = () => {
      if (!listItems.length) return;
      const current = listItems;
      listItems = [];
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-5">
          {current.map((item, i) => (
            <li key={`${i}-${item.slice(0, 12)}`} className="list-disc leading-7">
              {item}
            </li>
          ))}
        </ul>,
      );
    };

    const lines = trimmed.split(/\r?\n/);
    let index = 0;
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line) {
        flushList();
        index += 1;
        continue;
      }
      if (index + 1 < lines.length && line.startsWith('|') && isTableSeparator(lines[index + 1])) {
        flushList();
        const header = splitTableRow(line);
        const rows: string[][] = [];
        index += 2;
        while (index < lines.length) {
          const candidate = lines[index].trim();
          if (!candidate.startsWith('|')) break;
          if (!isTableSeparator(candidate)) rows.push(splitTableRow(candidate));
          index += 1;
        }
        elements.push(
          <table key={`table-${elements.length}`} className="doc-table my-3 w-full border-collapse text-[0.95em]">
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th key={`${i}-${cell}`} className="border px-3 py-1.5 text-left font-bold">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cellIndex}-${cell}`} className="border px-3 py-1.5 align-top">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>,
        );
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushList();
        elements.push(
          <h4 key={`h-${elements.length}`} className="doc-heading mt-1 text-[1.1em] font-extrabold">
            {heading[2]}
          </h4>,
        );
        index += 1;
        continue;
      }
      const list = line.match(/^[-*]\s+(.+)$/);
      if (list) {
        listItems.push(list[1]);
        index += 1;
        continue;
      }
      flushList();
      elements.push(
        <p key={`p-${elements.length}`} className="my-1.5 leading-7">
          {line}
        </p>,
      );
      index += 1;
    }
    flushList();
    return elements;
  }, [content]);

  return <>{nodes}</>;
}

interface NoticeDocumentEditorProps {
  draft: AgencyNoticeDraft;
  onDraftChange: (draft: AgencyNoticeDraft) => void;
  busy: string | null;
  setBusy: (value: string | null) => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  onExport: (format: 'hwpx' | 'pdf' | 'docx') => Promise<void>;
  onGoReview: () => void;
}

export function NoticeDocumentEditor({
  draft,
  onDraftChange,
  busy,
  setBusy,
  setError,
  setNotice,
  onExport,
  onGoReview,
}: NoticeDocumentEditorProps) {
  const [styleProfileId, setStyleProfileId] = useState(DEFAULT_DOCUMENT_STYLE_PROFILE_ID);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const profile: DocumentStyleProfile = getDocumentStyleProfile(styleProfileId);
  const selectedSection = draft.sections.find((section) => section.id === selectedSectionId) ?? null;
  const latestVersion = draft.versions[draft.versions.length - 1] ?? null;
  const editable = !['approved', 'published'].includes(draft.status);

  function startEditing(section: AgencyNoticeSection) {
    setSelectedSectionId(section.id);
    if (!editable) return;
    setEditingSectionId(section.id);
    setEditText(section.content_markdown);
  }

  async function saveSection() {
    if (!editingSectionId) return;
    setBusy('save-section');
    setError(null);
    try {
      const res = await updateAgencyNoticeSection(draft.id, editingSectionId, editText);
      onDraftChange(res.data);
      setEditingSectionId(null);
      setNotice('섹션을 저장했습니다. 새 버전이 기록되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '섹션 저장에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function aiReviseSection() {
    if (!editingSectionId) return;
    setBusy('ai-revise');
    setError(null);
    try {
      const saved = await updateAgencyNoticeSection(draft.id, editingSectionId, editText);
      const res = await aiReviseAgencyNoticeSection(saved.data.id, editingSectionId);
      onDraftChange(res.data);
      const revised = res.data.sections.find((section) => section.id === editingSectionId);
      setEditText(revised?.content_markdown ?? editText);
      setNotice('AI가 섹션을 개조식·행정문체로 다듬었습니다. 내용을 확인하고 저장하세요.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 다듬기에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#DDE7E2] bg-white p-3 shadow-sm">
          <label className="flex items-center gap-2 text-xs font-bold text-[#65736E]">
            문서 스타일
            <select
              value={styleProfileId}
              onChange={(event) => setStyleProfileId(event.target.value)}
              className="rounded-full border border-[#DDE7E2] bg-white px-3 py-1.5 text-xs font-bold text-[#24312D] outline-none focus:border-[#6A9C89]"
              data-testid="editor-style-select"
            >
              {documentStyleProfiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] text-[#65736E]">v{latestVersion?.version_number ?? 1}</span>
          {!editable && (
            <span className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">
              승인 이후에는 편집이 잠깁니다
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void onExport('hwpx')} disabled={busy !== null}>
              HWPX
            </Button>
            <Button variant="ghost" onClick={() => void onExport('pdf')} disabled={busy !== null}>
              PDF
            </Button>
            <Button onClick={onGoReview} data-testid="editor-go-review">
              검토·승인으로
            </Button>
          </div>
        </div>

        <div
          className="max-h-[calc(100vh-220px)] min-h-[680px] overflow-auto rounded-2xl border border-[#DDE7E2] p-5"
          style={{ background: profile.preview.pageBackground }}
        >
          <article
            className="agency-notice-paper mx-auto min-h-[1120px] max-w-[760px] px-10 py-12 shadow-[0_18px_48px_rgba(36,49,45,0.14)] sm:px-14"
            style={{
              background: profile.preview.documentBackground,
              color: profile.colors.text,
              fontFamily: profile.typography.fontFamily,
              fontSize: profile.typography.bodySize,
              lineHeight: profile.typography.lineHeight,
              '--style-primary': profile.colors.primary,
              '--style-table-header-bg': profile.colors.tableHeaderBg,
              '--style-table-header-text': profile.colors.tableHeaderText,
              '--style-table-border': profile.table.borderColor,
              '--style-selected-outline': profile.preview.selectedOutline,
            } as CSSProperties}
            data-testid="editor-paper"
          >
            <style jsx global>{`
              .agency-notice-paper .doc-heading {
                color: var(--style-primary);
              }
              .agency-notice-paper .doc-table th {
                background: var(--style-table-header-bg);
                color: var(--style-table-header-text);
                border-color: var(--style-table-border);
              }
              .agency-notice-paper .doc-table td {
                border-color: var(--style-table-border);
              }
            `}</style>

            <header className="text-center">
              {draft.brief.agency_name && (
                <p className="text-xs font-bold opacity-70">{draft.brief.agency_name} 공고</p>
              )}
              <h2
                className="mt-4 font-extrabold leading-snug"
                style={{ fontSize: profile.typography.titleSize, fontWeight: profile.typography.titleWeight, color: profile.colors.primary }}
              >
                {draft.title}
              </h2>
              {draft.brief.program_purpose && (
                <p className="mt-5 border-y py-3 text-left leading-7" style={{ borderColor: profile.table.borderColor }}>
                  {draft.brief.agency_name || '우리 기관'}에서는 {draft.brief.program_purpose.replace(/[.。]\s*$/, '')}를 위해
                  다음과 같이 공고하오니 관심 있는 대상자의 많은 신청 바랍니다.
                </p>
              )}
            </header>

            <div className="mt-6 space-y-2">
              {draft.sections.map((section) => {
                const isEditing = editingSectionId === section.id;
                const isSelected = selectedSectionId === section.id;
                const needsConfirmation = section.confirmation_required.length > 0;
                if (isEditing) {
                  return (
                    <div key={section.id} className="rounded-lg border-2 p-3" style={{ borderColor: profile.preview.selectedOutline }}>
                      <textarea
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        rows={Math.max(6, editText.split('\n').length + 1)}
                        autoFocus
                        className="w-full resize-y rounded-md border border-[#DDE7E2] bg-[#FBFDFC] px-3 py-2 font-mono text-[13px] leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
                        data-testid="editor-section-textarea"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void aiReviseSection()}
                          disabled={busy !== null}
                          className="mr-auto rounded-full border border-[#6A9C89] bg-[#EDF7F2] px-4 py-1.5 text-xs font-bold text-[#245D50] disabled:opacity-50"
                          data-testid="editor-ai-revise"
                        >
                          {busy === 'ai-revise' ? 'AI 다듬는 중...' : '✨ AI 다듬기 (개조식)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSectionId(null)}
                          className="rounded-full border border-[#DDE7E2] bg-white px-4 py-1.5 text-xs font-bold text-[#40504B]"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveSection()}
                          disabled={busy !== null}
                          className="rounded-full bg-[#245D50] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                          data-testid="editor-save-section"
                        >
                          {busy === 'save-section' ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={section.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => startEditing(section)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') startEditing(section);
                    }}
                    className={[
                      'group relative cursor-text rounded-lg px-3 py-2 transition',
                      isSelected ? 'ring-2' : 'hover:bg-black/[0.025]',
                    ].join(' ')}
                    style={isSelected ? ({ ['--tw-ring-color' as string]: profile.preview.selectedOutline } as CSSProperties) : undefined}
                    data-testid={`editor-section-${section.id}`}
                  >
                    {needsConfirmation && (
                      <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        확인 필요 {section.confirmation_required.length}
                      </span>
                    )}
                    <DocumentMarkdown content={section.content_markdown} />
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">근거 추적</h3>
          <p className="mt-1 text-xs text-[#65736E]">
            {selectedSection ? `"${selectedSection.title}" 섹션 기준` : '문서에서 섹션을 클릭하면 근거가 표시됩니다.'}
          </p>
          {selectedSection && (
            <div className="mt-3 space-y-2" data-testid="editor-source-traces">
              {selectedSection.source_traces.length ? (
                selectedSection.source_traces.map((trace) => (
                  <div key={trace.evidence_id} className="rounded-xl border border-[#EDF2EF] bg-[#F8FBFA] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#24312D]">{trace.label}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#3A7A68]">
                        {trace.source_type === 'brief' ? '브리프 입력' : trace.source_type === 'prior_notice' ? '참고 공고' : trace.source_type}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-[#65736E]">{trace.quote}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#65736E]">이 섹션에 연결된 근거가 없습니다.</p>
              )}
            </div>
          )}
          {selectedSection && selectedSection.confirmation_required.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">확인 필요</p>
              <ul className="mt-1 space-y-1 text-[11px] leading-5 text-amber-800">
                {selectedSection.confirmation_required.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">문서 전체 확인 필요</h3>
          {draft.confirmation_required.length ? (
            <ul className="mt-2 space-y-1 text-xs leading-5 text-[#65736E]">
              {draft.confirmation_required.slice(0, 8).map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[#65736E]">모든 항목이 채워졌습니다.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
