'use client';

import { useState } from 'react';
import { recallAgencyPriorNotices } from '@/lib/api';
import type { AgencyNoticeBrief, AgencyPriorNoticeRecallItem, NoticeRecipe } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface NoticeBriefFormProps {
  brief: AgencyNoticeBrief;
  recipe: NoticeRecipe;
  onBriefChange: (next: AgencyNoticeBrief) => void;
  busy: string | null;
  onGenerate: () => void;
  onBack: () => void;
  onNextReferences: () => void;
}

export function NoticeBriefForm({
  brief,
  recipe,
  onBriefChange,
  busy,
  onGenerate,
  onBack,
  onNextReferences,
}: NoticeBriefFormProps) {
  const [recallResults, setRecallResults] = useState<AgencyPriorNoticeRecallItem[]>([]);
  const [recallBusy, setRecallBusy] = useState(false);

  function fieldValue(id: keyof AgencyNoticeBrief): string {
    const value = brief[id];
    return Array.isArray(value) ? value.join('\n') : String(value ?? '');
  }

  function updateField(id: keyof AgencyNoticeBrief, value: string) {
    if (id === 'required_documents') {
      onBriefChange({
        ...brief,
        required_documents: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      });
      return;
    }
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

  const requiredCount = recipe.fields.filter((field) => field.required).length;
  const requiredFilled = recipe.fields.filter((field) => field.required && fieldValue(field.id).trim()).length;
  const canGenerate = fieldValue('title').trim().length > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#3A7A68]">{recipe.label}</p>
              <h2 className="mt-1 text-xl font-bold text-[#24312D]">필요한 내용만 채워주세요</h2>
              <p className="mt-1 text-xs leading-5 text-[#65736E]">{recipe.description}</p>
            </div>
            <span className="rounded-full bg-[#EDF7F2] px-3 py-1 text-[11px] font-bold text-[#245D50]">
              필수 {requiredFilled}/{requiredCount}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recipe.fields.map((field) => {
              const value = fieldValue(field.id);
              const isTextarea = field.type === 'textarea' || field.id === 'required_documents';
              return (
                <label
                  key={field.id}
                  className={['block', isTextarea ? 'md:col-span-2' : ''].join(' ')}
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-[#65736E]">
                    {field.label}
                    {field.required && <span className="text-[#D97706]">필수</span>}
                  </span>
                  {isTextarea ? (
                    <textarea
                      value={value}
                      onChange={(event) => updateField(field.id, event.target.value)}
                      rows={field.id === 'required_documents' ? 4 : 3}
                      placeholder={field.placeholder}
                      className="mt-1 w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-3 py-2 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
                      data-testid={`brief-field-${field.id}`}
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(event) => updateField(field.id, event.target.value)}
                      placeholder={field.placeholder}
                      className="mt-1 h-10 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 text-sm text-[#24312D] outline-none focus:border-[#6A9C89]"
                      data-testid={`brief-field-${field.id}`}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <Button variant="secondary" onClick={onBack}>
            방향 다시 고르기
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onNextReferences} data-testid="studio-next-references">
              참고자료 고르기
            </Button>
            <Button onClick={onGenerate} disabled={busy !== null || !canGenerate} data-testid="brief-generate">
              {busy === 'generate' ? '초안 생성 중...' : '공고문 초안 생성'}
            </Button>
          </div>
        </div>
        {!canGenerate && <p className="text-right text-xs text-[#65736E]">공고 제목을 입력하면 초안을 생성할 수 있습니다.</p>}
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">담긴 참고자료</h3>
          <p className="mt-1 text-xs leading-5 text-[#65736E]">
            참고자료는 문서 구조와 표현 방식의 근거로만 사용하고, 사실값은 그대로 복사하지 않습니다.
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
                아직 담긴 참고자료가 없습니다. 다음 단계에서 비슷한 구조를 고를 수 있습니다.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#24312D]">우리 기관의 과거 공고 찾기</h3>
          <p className="mt-1 text-xs leading-5 text-[#65736E]">입력한 내용과 비슷한 내부 공고가 있으면 함께 참고할 수 있습니다.</p>
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
