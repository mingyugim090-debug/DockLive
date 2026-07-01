'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addAgencyNoticeComment,
  createAgencyPriorNotice,
  createClauseLibraryEntry,
  createAgencyNoticeDraft,
  exportAgencyNoticeDraft,
  listClauseLibrary,
  recallAgencyPriorNotices,
  transitionAgencyNoticeDraft,
  updateAgencyNoticeSection,
} from '@/lib/api';
import type {
  AgencyNoticeBrief,
  AgencyNoticeDraft,
  AgencyNoticeSection,
  AgencyPriorNoticeRecallItem,
  ClauseLibraryEntry,
  ExportResponse,
} from '@/lib/types';

const defaultBrief: AgencyNoticeBrief = {
  organization_id: '00000000-0000-4000-8000-000000000001',
  author_id: 'demo-user',
  author_name: '사업 담당자',
  agency_name: '가상지역산업진흥원',
  title: '2026년 지역 AI 전환 지원사업 참여기업 모집 공고',
  program_type: 'support_program',
  program_purpose: '지역 중소기업의 AI 활용 역량을 높이고 업무 자동화 실증을 지원한다.',
  budget: '총 900,000,000원, 과제당 최대 50,000,000원',
  program_period: '2026. 3. 1.부터 2026. 11. 30.까지',
  eligibility_rules: '본점 또는 사업장이 해당 지역에 있는 중소기업',
  support_details: 'AI 진단, PoC 개발, 데이터 정비, 전문가 멘토링을 지원한다.',
  evaluation_criteria: '사업 필요성 30점, 실행 가능성 30점, 지역 파급효과 20점, 예산 적정성 20점',
  submission_method: '기관 온라인 접수 시스템으로 신청서와 증빙서류를 제출한다.',
  required_documents: ['참여신청서', '사업계획서', '사업자등록증', '개인정보 수집 및 이용 동의서'],
  contact: 'AI전환팀 02-0000-0000',
  legal_basis: '지역산업진흥 조례 제12조',
  privacy_policy: '개인정보는 사업 평가와 사후관리 목적으로만 수집 및 이용한다.',
  fair_competition_clause: '허위자료 제출, 중복수혜, 부정행위가 확인되면 선정 취소 및 환수 조치한다.',
  appeal_process: '',
  references: [
    {
      id: 'prior-2025',
      source_type: 'prior_notice',
      filename: '2025-ai-support-notice.hwpx',
      title: '2025년 지역 AI 전환 지원사업 공고',
      text: '전년도 공고는 선정 결과 통보 후 이의신청 기간을 7일 부여한다고 안내했다.',
      evidence_label: '전년도 공고',
    },
  ],
};

const fieldGroups: Array<{
  title: string;
  fields: Array<{ id: keyof AgencyNoticeBrief; label: string; type?: 'textarea' | 'text' }>;
}> = [
  {
    title: '사업 브리프',
    fields: [
      { id: 'title', label: '공고명' },
      { id: 'agency_name', label: '기관명' },
      { id: 'program_type', label: '사업 유형' },
      { id: 'program_purpose', label: '사업 목적', type: 'textarea' },
      { id: 'support_details', label: '지원 내용', type: 'textarea' },
    ],
  },
  {
    title: '요건과 기준',
    fields: [
      { id: 'budget', label: '예산' },
      { id: 'program_period', label: '사업 기간' },
      { id: 'eligibility_rules', label: '신청 자격', type: 'textarea' },
      { id: 'evaluation_criteria', label: '평가 기준', type: 'textarea' },
      { id: 'submission_method', label: '신청 방법', type: 'textarea' },
    ],
  },
  {
    title: '필수 조항',
    fields: [
      { id: 'legal_basis', label: '법적 근거' },
      { id: 'privacy_policy', label: '개인정보 처리방침', type: 'textarea' },
      { id: 'fair_competition_clause', label: '공정경쟁 문구', type: 'textarea' },
      { id: 'appeal_process', label: '이의신청 절차', type: 'textarea' },
      { id: 'contact', label: '문의처' },
    ],
  },
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

function statusLabel(status: AgencyNoticeDraft['status']) {
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

export function AgencyControlRoom({ initialDraft = null }: { initialDraft?: AgencyNoticeDraft | null }) {
  const [brief, setBrief] = useState<AgencyNoticeBrief>(defaultBrief);
  const [draft, setDraft] = useState<AgencyNoticeDraft | null>(initialDraft);
  const [selectedSectionId, setSelectedSectionId] = useState(initialDraft?.sections[0]?.id ?? 'overview');
  const [sectionText, setSectionText] = useState(initialDraft?.sections[0]?.content_markdown ?? '');
  const [commentText, setCommentText] = useState('');
  const [priorNoticeText, setPriorNoticeText] = useState(
    '2025년 지역 AI 전환 지원사업 공고\n지역 중소기업의 AI 진단, PoC 개발, 데이터 정비, 전문가 멘토링을 지원한다.',
  );
  const [recallResults, setRecallResults] = useState<AgencyPriorNoticeRecallItem[]>([]);
  const [clauseLibrary, setClauseLibrary] = useState<ClauseLibraryEntry[]>([]);
  const [newClauseLabel, setNewClauseLabel] = useState('');
  const [newClauseType, setNewClauseType] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSection = useMemo(
    () => draft?.sections.find((section) => section.id === selectedSectionId) ?? null,
    [draft, selectedSectionId],
  );
  const latestVersion = draft?.versions[draft.versions.length - 1] ?? null;
  const controlRoomStatus = draft
    ? `${statusLabel(draft.status)} · v${latestVersion?.version_number ?? 1} · 확인 필요 ${draft.confirmation_required.length}건`
    : '초안 대기 · 필수 조항 4개 · 승인 단계 3단계';
  const selectedTraceItems = selectedSection?.source_traces ?? [];
  const selectedComments = draft?.comments.filter((comment) => comment.section_id === selectedSectionId) ?? [];

  useEffect(() => {
    let cancelled = false;
    listClauseLibrary(brief.organization_id, brief.program_type)
      .then((res) => {
        if (!cancelled) setClauseLibrary(res.data);
      })
      .catch(() => {
        if (!cancelled) setClauseLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [brief.organization_id, brief.program_type]);

  function updateBriefField(id: keyof AgencyNoticeBrief, value: string) {
    setBrief((current) => ({ ...current, [id]: value }));
  }

  function selectSection(section: AgencyNoticeSection) {
    setSelectedSectionId(section.id);
    setSectionText(section.content_markdown);
  }

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

  async function generateDraft() {
    await run(
      'generate',
      () => createAgencyNoticeDraft(brief),
      (res) => {
        setDraft(res.data);
        const firstSection = res.data.sections[0];
        if (firstSection) selectSection(firstSection);
        setNotice('기관 공고 초안과 승인 흐름을 생성했습니다.');
      },
    );
  }

  async function savePriorNotice() {
    await run(
      'save-prior',
      () =>
        createAgencyPriorNotice({
          organization_id: brief.organization_id,
          title: `${new Date().getFullYear() - 1}년 유사 공고`,
          program_type: brief.program_type,
          budget: brief.budget,
          program_period: brief.program_period,
          text: priorNoticeText,
        }),
      (res) => {
        setNotice(`${res.data.title}을 과거 공고로 저장했습니다.`);
      },
    );
  }

  async function recallPriorNotices() {
    await run(
      'recall',
      () => recallAgencyPriorNotices(brief),
      (res) => {
        setRecallResults(res.data);
        setNotice(res.data.length ? '유사 과거 공고를 찾았습니다.' : '저장된 유사 과거 공고가 없습니다.');
      },
    );
  }

  function attachPriorNotice(item: AgencyPriorNoticeRecallItem) {
    setBrief((current) => {
      if (current.references.some((reference) => reference.id === item.id)) return current;
      return {
        ...current,
        references: [
          ...current.references,
          {
            id: item.id,
            source_type: 'prior_notice',
            filename: '',
            title: item.title,
            text: item.summary,
            evidence_label: item.title,
          },
        ],
      };
    });
    setNotice('선택한 과거 공고를 현재 초안의 근거로 추가했습니다.');
  }

  async function addClauseLibraryEntry() {
    if (!newClauseLabel.trim() || !newClauseType.trim()) return;
    await run(
      'clause-add',
      () =>
        createClauseLibraryEntry({
          organization_id: brief.organization_id,
          clause_type: newClauseType.trim(),
          label: newClauseLabel.trim(),
          required_for_program_types: [brief.program_type],
          template_text: '',
        }),
      async () => {
        const res = await listClauseLibrary(brief.organization_id, brief.program_type);
        setClauseLibrary(res.data);
        setNewClauseLabel('');
        setNewClauseType('');
        setNotice('필수 조항을 라이브러리에 추가했습니다.');
      },
    );
  }

  async function saveSection() {
    if (!draft || !selectedSection) return;
    await run(
      'save-section',
      () => updateAgencyNoticeSection(draft.id, selectedSection.id, sectionText),
      (res) => {
        setDraft(res.data);
        setNotice('섹션을 저장하고 새 버전을 만들었습니다.');
      },
    );
  }

  async function addComment() {
    if (!draft || !commentText.trim()) return;
    await run(
      'comment',
      () => addAgencyNoticeComment(draft.id, commentText, selectedSection?.id),
      (res) => {
        setDraft(res.data);
        setCommentText('');
        setNotice('현재 버전에 댓글을 남겼습니다.');
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
        setNotice(`${res.filename} 파일을 생성했습니다.`);
      },
    );
  }

  return (
    <div className="space-y-5">
      <section className="border-b border-[#DDE7E2] pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#4F46E5]">Agency NoticeOps</p>
            <h1 className="mt-1 text-3xl font-bold tracking-normal text-[#24312D]">승인 컨트롤룸</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#65736E]">{controlRoomStatus}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateDraft}
              disabled={busy !== null}
              className="h-10 rounded-md bg-[#4F46E5] px-4 text-sm font-bold text-white transition hover:bg-[#4338CA] disabled:opacity-60"
            >
              {busy === 'generate' ? '생성 중' : '초안 생성'}
            </button>
            {draft ? (
              <>
                <button
                  type="button"
                  onClick={() => transition('submit-review', '팀장 검토를 요청했습니다.')}
                  disabled={busy !== null || !['draft', 'revision_requested'].includes(draft.status)}
                  className="h-10 rounded-md border border-[#C9D8D2] bg-white px-4 text-sm font-bold text-[#24312D] transition hover:border-[#4F46E5] disabled:opacity-50"
                >
                  검토 요청
                </button>
                <button
                  type="button"
                  onClick={() => transition('approve', '승인 단계를 진행했습니다.')}
                  disabled={busy !== null || !['under_review', 'approving'].includes(draft.status)}
                  className="h-10 rounded-md border border-[#C9D8D2] bg-white px-4 text-sm font-bold text-[#24312D] transition hover:border-[#4F46E5] disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => transition('request-revision', '수정 요청을 남겼습니다.')}
                  disabled={busy !== null || !['under_review', 'approving'].includes(draft.status)}
                  className="h-10 rounded-md border border-[#F1C7C7] bg-white px-4 text-sm font-bold text-[#9F2E2E] transition hover:border-[#C24141] disabled:opacity-50"
                >
                  수정 요청
                </button>
              </>
            ) : null}
          </div>
        </div>
        {notice ? <p className="mt-3 rounded-md bg-[#EDF7F2] px-3 py-2 text-sm text-[#245D50]">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-md bg-[#FEF2F2] px-3 py-2 text-sm text-[#B42318]">{error}</p> : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_330px]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-[#D8DEE8] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#24312D]">과거 공고 Recall</h2>
                <p className="mt-1 text-xs leading-5 text-[#65736E]">조직 내부에 저장한 공고만 유사도 검색에 사용합니다.</p>
              </div>
              <span className="rounded-md bg-[#EEF2FF] px-2 py-1 text-[11px] font-bold text-[#4F46E5]">org scoped</span>
            </div>
            <textarea
              value={priorNoticeText}
              onChange={(event) => setPriorNoticeText(event.target.value)}
              rows={5}
              className="mt-3 w-full resize-y rounded-md border border-[#CBD8D3] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={savePriorNotice}
                disabled={busy !== null || !priorNoticeText.trim()}
                className="h-9 rounded-md border border-[#CBD8D3] bg-white px-3 text-sm font-bold text-[#24312D] disabled:opacity-50"
              >
                저장
              </button>
              <button
                type="button"
                onClick={recallPriorNotices}
                disabled={busy !== null}
                className="h-9 rounded-md bg-[#4F46E5] px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                검색
              </button>
            </div>
            {recallResults.length ? (
              <div className="mt-3 space-y-2" aria-label="유사 과거 공고">
                {recallResults.map((item) => (
                  <div key={item.id} className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold leading-5 text-[#24312D]">{item.title}</p>
                      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[#4F46E5]">
                        {Math.round(item.similarity * 100)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#65736E]">{item.summary || item.program_period}</p>
                    <button
                      type="button"
                      onClick={() => attachPriorNotice(item)}
                      className="mt-2 h-8 rounded-md border border-[#CBD8D3] bg-white px-3 text-xs font-bold text-[#24312D]"
                    >
                      근거 추가
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {fieldGroups.map((group) => (
            <div key={group.title} className="rounded-lg border border-[#DDE7E2] bg-white p-4">
              <h2 className="text-sm font-bold text-[#24312D]">{group.title}</h2>
              <div className="mt-3 space-y-3">
                {group.fields.map((field) => {
                  const value = String(brief[field.id] ?? '');
                  return (
                    <label key={field.id} className="block">
                      <span className="text-xs font-bold text-[#65736E]">{field.label}</span>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={value}
                          onChange={(event) => updateBriefField(field.id, event.target.value)}
                          rows={3}
                          className="mt-1 w-full resize-y rounded-md border border-[#CBD8D3] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
                        />
                      ) : (
                        <input
                          value={value}
                          onChange={(event) => updateBriefField(field.id, event.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-[#CBD8D3] bg-white px-3 text-sm text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <label className="block">
              <span className="text-xs font-bold text-[#65736E]">제출 서류</span>
              <textarea
                value={brief.required_documents.join('\n')}
                onChange={(event) =>
                  setBrief((current) => ({
                    ...current,
                    required_documents: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                  }))
                }
                rows={5}
                className="mt-1 w-full resize-y rounded-md border border-[#CBD8D3] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
              />
            </label>
          </div>
          <div className="rounded-lg border border-[#D8DEE8] bg-white p-4">
            <h2 className="text-sm font-bold text-[#24312D]">조항 라이브러리</h2>
            <div className="mt-3 space-y-2">
              {clauseLibrary.map((entry) => (
                <div key={entry.id} className="rounded-md border border-[#E5EDE9] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#24312D]">{entry.label}</p>
                    <span className="rounded-md bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-bold text-[#65736E]">
                      {entry.source}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#65736E]">{entry.clause_type}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={newClauseType}
                onChange={(event) => setNewClauseType(event.target.value)}
                placeholder="clause_type"
                className="h-9 rounded-md border border-[#CBD8D3] bg-white px-3 text-sm text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
              />
              <input
                value={newClauseLabel}
                onChange={(event) => setNewClauseLabel(event.target.value)}
                placeholder="조항 이름"
                className="h-9 rounded-md border border-[#CBD8D3] bg-white px-3 text-sm text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
              />
              <button
                type="button"
                onClick={addClauseLibraryEntry}
                disabled={busy !== null || !newClauseType.trim() || !newClauseLabel.trim()}
                className="h-9 rounded-md border border-[#CBD8D3] bg-white px-3 text-sm font-bold text-[#24312D] disabled:opacity-50"
              >
                필수 조항 추가
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 rounded-lg border border-[#DDE7E2] bg-white">
          {draft ? (
            <div className="grid min-h-[760px] lg:grid-cols-[230px_minmax(0,1fr)]">
              <nav className="border-b border-[#E5EDE9] p-3 lg:border-b-0 lg:border-r">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#65736E]">현재 상태</span>
                  <span className="rounded-md bg-[#EEF2FF] px-2 py-1 text-xs font-bold text-[#4F46E5]">
                    {statusLabel(draft.status)}
                  </span>
                </div>
                <div className="space-y-1">
                  {draft.sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => selectSection(section)}
                      className={[
                        'w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition',
                        selectedSectionId === section.id
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : 'text-[#65736E] hover:bg-[#F6FAF8] hover:text-[#24312D]',
                      ].join(' ')}
                    >
                      <span className="block">{section.title}</span>
                      {section.confirmation_required.length ? (
                        <span className="mt-1 block text-[11px] text-[#B45309]">확인 {section.confirmation_required.length}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </nav>

              <div className="flex min-w-0 flex-col">
                <div className="border-b border-[#E5EDE9] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#65736E]">v{latestVersion?.version_number ?? 1}</p>
                      <h2 className="mt-1 text-xl font-bold text-[#24312D]">{draft.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveSection()}
                        disabled={busy !== null || !selectedSection}
                        className="h-9 rounded-md bg-[#4F46E5] px-3 text-sm font-bold text-white transition hover:bg-[#4338CA] disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => exportDraft('hwpx')}
                        disabled={busy !== null}
                        className="h-9 rounded-md border border-[#C9D8D2] bg-white px-3 text-sm font-bold text-[#24312D]"
                      >
                        HWPX
                      </button>
                      <button
                        type="button"
                        onClick={() => exportDraft('pdf')}
                        disabled={busy !== null}
                        className="h-9 rounded-md border border-[#C9D8D2] bg-white px-3 text-sm font-bold text-[#24312D]"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => exportDraft('docx')}
                        disabled={busy !== null}
                        className="h-9 rounded-md border border-[#C9D8D2] bg-white px-3 text-sm font-bold text-[#24312D]"
                      >
                        DOCX
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid flex-1 gap-0 lg:grid-cols-2">
                  <section className="border-b border-[#E5EDE9] p-4 lg:border-b-0 lg:border-r">
                    <h3 className="text-sm font-bold text-[#24312D]">{selectedSection?.title ?? '섹션'}</h3>
                    <textarea
                      value={sectionText}
                      onChange={(event) => setSectionText(event.target.value)}
                      rows={24}
                      className="mt-3 min-h-[620px] w-full resize-none rounded-md border border-[#CBD8D3] bg-[#FBFDFC] px-4 py-3 font-mono text-sm leading-6 text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
                    />
                  </section>
                  <section className="bg-[#F8FBFA] p-4">
                    <h3 className="text-sm font-bold text-[#24312D]">문서 미리보기</h3>
                    <div className="mt-3 max-h-[620px] overflow-auto rounded-md border border-[#DDE7E2] bg-white p-5">
                      {draft.sections.map((section) => (
                        <article key={section.id} className="border-b border-[#EDF2EF] py-4 last:border-0">
                          <h4 className="text-base font-bold text-[#24312D]">{section.title}</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#40504B]">{section.content_markdown}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[760px] items-center justify-center p-8 text-center">
              <div>
                <p className="text-sm font-bold text-[#4F46E5]">대기 중</p>
                <h2 className="mt-2 text-2xl font-bold text-[#24312D]">기관 공고 초안을 생성하세요.</h2>
                <p className="mt-2 text-sm leading-6 text-[#65736E]">왼쪽 브리프를 기준으로 섹션, 필수 조항, 승인 단계를 구성합니다.</p>
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <div className="rounded-lg border border-[#D8DEE8] bg-white p-4">
            <h2 className="text-sm font-bold text-[#24312D]">근거 추적</h2>
            <p className="mt-1 text-xs leading-5 text-[#65736E]">{selectedSection?.title ?? '섹션'} 기준</p>
            <div className="mt-3 space-y-2">
              {selectedTraceItems.length ? (
                selectedTraceItems.map((trace) => (
                  <div key={trace.evidence_id} className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#24312D]">{trace.label}</p>
                      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[#4F46E5]">
                        {trace.source_type}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#65736E]">{trace.quote}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#65736E]">섹션을 선택하면 연결된 입력과 참조가 표시됩니다.</p>
              )}
            </div>
            {selectedSection?.confirmation_required.length ? (
              <div className="mt-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-3">
                <p className="text-xs font-bold text-[#92400E]">확인 필요</p>
                <ul className="mt-1 space-y-1 text-xs leading-5 text-[#92400E]">
                  {selectedSection.confirmation_required.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <h2 className="text-sm font-bold text-[#24312D]">승인 단계</h2>
            <div className="mt-4 space-y-3">
              {draft?.approval_workflow.steps.map((step) => (
                <div key={step.id} className="flex gap-3">
                  <div
                    className={[
                      'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                      step.status === 'approved'
                        ? 'bg-[#DDF4E8] text-[#047857]'
                        : step.status === 'active'
                          ? 'bg-[#EEF2FF] text-[#4F46E5]'
                          : step.status === 'changes_requested'
                            ? 'bg-[#FEF3C7] text-[#B45309]'
                            : 'bg-[#EEF2F1] text-[#65736E]',
                    ].join(' ')}
                  >
                    {step.step_order}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#24312D]">{step.title}</p>
                    <p className="mt-0.5 text-xs text-[#65736E]">{step.role} · {step.status}</p>
                  </div>
                </div>
              )) ?? <p className="text-sm text-[#65736E]">초안 생성 후 표시됩니다.</p>}
            </div>
            {draft?.status === 'approved' ? (
              <button
                type="button"
                onClick={() => transition('publish', '게시용 최종본을 확정했습니다.')}
                disabled={busy !== null}
                className="mt-4 h-10 w-full rounded-md bg-[#4F46E5] px-4 text-sm font-bold text-white transition hover:bg-[#4338CA] disabled:opacity-50"
              >
                게시 준비 완료
              </button>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <h2 className="text-sm font-bold text-[#24312D]">필수 조항</h2>
            <div className="mt-3 space-y-2">
              {draft?.mandatory_clause_checks.map((check) => (
                <div key={check.id} className="rounded-md border border-[#E5EDE9] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#24312D]">{check.label}</p>
                    <span
                      className={[
                        'rounded-md px-2 py-0.5 text-[11px] font-bold',
                        check.status === 'satisfied'
                          ? 'bg-[#DDF4E8] text-[#047857]'
                          : 'bg-[#FEF3C7] text-[#B45309]',
                      ].join(' ')}
                    >
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#65736E]">{check.note}</p>
                </div>
              )) ?? <p className="text-sm text-[#65736E]">초안 생성 후 표시됩니다.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <h2 className="text-sm font-bold text-[#24312D]">버전 기록</h2>
            <div className="mt-3 max-h-48 space-y-2 overflow-auto">
              {draft?.versions.map((version) => (
                <div key={version.id} className="rounded-md border border-[#E5EDE9] px-3 py-2">
                  <p className="text-xs font-bold text-[#24312D]">v{version.version_number} · {version.created_by}</p>
                  <p className="mt-1 text-xs leading-5 text-[#65736E]">{version.change_summary}</p>
                </div>
              )) ?? <p className="text-sm text-[#65736E]">초안 생성 후 표시됩니다.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <h2 className="text-sm font-bold text-[#24312D]">댓글</h2>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={3}
              className="mt-3 w-full resize-y rounded-md border border-[#CBD8D3] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF]"
            />
            <button
              type="button"
              onClick={addComment}
              disabled={busy !== null || !draft || !commentText.trim()}
              className="mt-2 h-9 w-full rounded-md border border-[#C9D8D2] bg-white px-3 text-sm font-bold text-[#24312D] disabled:opacity-50"
            >
              댓글 남기기
            </button>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {(selectedComments.length ? selectedComments : draft?.comments ?? []).map((comment) => (
                <div key={comment.id} className="rounded-md bg-[#F8FBFA] px-3 py-2">
                  <p className="text-xs font-bold text-[#40504B]">{comment.author_name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#65736E]">{comment.body}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
