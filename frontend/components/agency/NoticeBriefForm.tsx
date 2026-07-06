'use client';

import { useState } from 'react';
import { recallAgencyPriorNotices } from '@/lib/api';
import type { AgencyNoticeBrief, AgencyPriorNoticeRecallItem } from '@/lib/types';
import { Button } from '@/components/ui/Button';

const fieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ id: keyof AgencyNoticeBrief; label: string; type?: 'textarea' | 'text'; placeholder?: string }>;
}> = [
  {
    title: '1. 어떤 사업인가요?',
    description: '공고문의 제목과 개요 섹션에 그대로 반영됩니다.',
    fields: [
      { id: 'title', label: '공고명', placeholder: '예: 2026년 지역 AI 전환 지원사업 참여기업 모집 공고' },
      { id: 'agency_name', label: '기관명', placeholder: '예: OO산업진흥원' },
      { id: 'program_purpose', label: '사업 목적', type: 'textarea', placeholder: '이 사업으로 무엇을 지원하고 어떤 효과를 기대하는지 적어 주세요.' },
      { id: 'support_details', label: '지원 내용', type: 'textarea', placeholder: '지원 항목, 지원 방식 등' },
    ],
  },
  {
    title: '2. 요건과 기준',
    description: '비워 두면 해당 항목은 "확인 필요"로 표시되고 검토 단계에서 다시 안내합니다.',
    fields: [
      { id: 'budget', label: '예산', placeholder: '예: 총 900,000,000원, 과제당 최대 50,000,000원' },
      { id: 'program_period', label: '사업 기간', placeholder: '예: 2026. 3. 1. ~ 2026. 11. 30.' },
      { id: 'eligibility_rules', label: '신청 자격', type: 'textarea' },
      { id: 'evaluation_criteria', label: '평가 기준', type: 'textarea', placeholder: '예: 사업 필요성 30점, 실행 가능성 30점...' },
      { id: 'submission_method', label: '신청 방법', type: 'textarea' },
    ],
  },
  {
    title: '3. 필수 조항',
    description: '법적 문구는 기관에서 확정한 텍스트를 붙여 넣어 주세요. 임의로 만들어 넣지 않습니다.',
    fields: [
      { id: 'legal_basis', label: '법적 근거', placeholder: '예: 지역산업진흥 조례 제12조' },
      { id: 'privacy_policy', label: '개인정보 처리방침', type: 'textarea' },
      { id: 'fair_competition_clause', label: '공정경쟁 문구', type: 'textarea' },
      { id: 'appeal_process', label: '이의신청 절차', type: 'textarea' },
      { id: 'contact', label: '문의처', placeholder: '예: AI전환팀 02-0000-0000' },
    ],
  },
];

interface NoticeBriefFormProps {
  brief: AgencyNoticeBrief;
  onBriefChange: (next: AgencyNoticeBrief) => void;
  busy: string | null;
  onGenerate: () => void;
  onBack: () => void;
}

export function NoticeBriefForm({ brief, onBriefChange, busy, onGenerate, onBack }: NoticeBriefFormProps) {
  const [openGroup, setOpenGroup] = useState(0);
  const [recallResults, setRecallResults] = useState<AgencyPriorNoticeRecallItem[]>([]);
  const [recallBusy, setRecallBusy] = useState(false);

  function updateField(id: keyof AgencyNoticeBrief, value: string) {
    onBriefChange({ ...brief, [id]: value });
  }

  async function searchSimilar() {
    setRecallBusy(true);
    try {
      const res = await recallAgencyPriorNotices(brief);
      setRecallResults(res.data);
    } catch {
      setRecallResults([]);
    } finally {
      setRecallBusy(false);
    }
  }

  function attachRecallItem(item: AgencyPriorNoticeRecallItem) {
    if (brief.references.some((reference) => reference.id === item.id)) return;
    onBriefChange({
      ...brief,
      references: [
        ...brief.references,
        {
          id: item.id,
          source_type: 'prior_notice',
          filename: '',
          title: item.title,
          text: item.summary,
          evidence_label: item.title,
        },
      ],
    });
  }

  function removeReference(id: string) {
    onBriefChange({ ...brief, references: brief.references.filter((reference) => reference.id !== id) });
  }

  const canGenerate = brief.title.trim().length > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        {fieldGroups.map((group, index) => {
          const isOpen = openGroup === index;
          const filled = group.fields.filter((field) => String(brief[field.id] ?? '').trim()).length;
          return (
            <div key={group.title} className="rounded-2xl border border-[#DDE7E2] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left"
                data-testid={`brief-group-${index}`}
              >
                <div>
                  <h3 className="text-base font-bold text-[#24312D]">{group.title}</h3>
                  <p className="mt-0.5 text-xs text-[#65736E]">{group.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#EDF7F2] px-2.5 py-1 text-[11px] font-bold text-[#245D50]">
                  {filled}/{group.fields.length}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-[#EDF2EF] p-5">
                  {group.fields.map((field) => {
                    const value = String(brief[field.id] ?? '');
                    return (
                      <label key={field.id} className="block">
                        <span className="text-xs font-bold text-[#65736E]">{field.label}</span>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={value}
                            onChange={(event) => updateField(field.id, event.target.value)}
                            rows={3}
                            placeholder={field.placeholder}
                            className="mt-1 w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={(event) => updateField(field.id, event.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 h-10 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 text-sm text-[#24312D] outline-none focus:border-[#6A9C89]"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-xs font-bold text-[#65736E]">제출 서류 (한 줄에 하나)</span>
            <textarea
              value={brief.required_documents.join('\n')}
              onChange={(event) =>
                onBriefChange({
                  ...brief,
                  required_documents: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                })
              }
              rows={4}
              placeholder={'참여신청서\n사업계획서\n사업자등록증'}
              className="mt-1 w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <Button variant="secondary" onClick={onBack}>
            공고 탐색으로
          </Button>
          <Button onClick={onGenerate} disabled={busy !== null || !canGenerate} data-testid="brief-generate">
            {busy === 'generate' ? '초안 생성 중...' : '공고문 초안 생성'}
          </Button>
        </div>
        {!canGenerate && <p className="text-right text-xs text-[#65736E]">공고명을 입력하면 초안을 생성할 수 있습니다.</p>}
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">담긴 참고자료</h3>
          <p className="mt-1 text-xs leading-5 text-[#65736E]">
            초안의 각 섹션은 브리프 입력과 이 참고자료를 근거로 만들어지고, 근거는 문서 편집 단계에서 추적할 수 있습니다.
          </p>
          <ul className="mt-3 space-y-2" data-testid="brief-references">
            {brief.references.length ? (
              brief.references.map((reference) => (
                <li key={reference.id} className="rounded-xl border border-[#EDF2EF] bg-[#F8FBFA] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold leading-5 text-[#24312D]">{reference.title}</p>
                    <button
                      type="button"
                      onClick={() => removeReference(reference.id)}
                      className="shrink-0 text-[11px] font-bold text-[#65736E] hover:text-[#B42318]"
                    >
                      제거
                    </button>
                  </div>
                  {reference.text && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#65736E]">{reference.text}</p>}
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-[#DDE7E2] p-3 text-center text-xs text-[#65736E]">
                아직 담긴 참고자료가 없습니다. 공고 탐색 단계에서 담을 수 있습니다.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">우리 기관의 과거 공고 찾기</h3>
          <p className="mt-1 text-xs leading-5 text-[#65736E]">조직 내부에 저장한 공고만 유사도 검색에 사용합니다.</p>
          <Button
            variant="secondary"
            onClick={() => void searchSimilar()}
            disabled={recallBusy}
            className="mt-3 w-full"
            data-testid="brief-recall"
          >
            {recallBusy ? '검색 중...' : '브리프와 유사한 과거 공고 검색'}
          </Button>
          <div className="mt-3 space-y-2">
            {recallResults.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#EDF2EF] bg-[#F8FBFA] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold leading-5 text-[#24312D]">{item.title}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#245D50]">
                    {Math.round(item.similarity * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => attachRecallItem(item)}
                  className="mt-2 rounded-full border border-[#DDE7E2] bg-white px-3 py-1 text-[11px] font-bold text-[#24312D] hover:border-[#6A9C89]"
                >
                  근거로 추가
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
