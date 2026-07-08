'use client';

import { useState } from 'react';
import { HwpxFormEditor } from '@/components/workspace/HwpxFormEditor';
import type { WorkflowSession } from '@/lib/types';

type FormTab = 'structure' | 'hwpx';

/** 4단계 — 양식 선택: 공고 기반 기본 구조로 진행하거나, HWPX 양식을 업로드해 직접 채운다. */
export function FormStage({
  workflow,
  defaultTab,
  onStructureChosen,
}: {
  workflow: WorkflowSession | null;
  defaultTab: FormTab;
  onStructureChosen: () => void;
}) {
  const [tab, setTab] = useState<FormTab>(defaultTab);
  const sections = workflow?.analysis?.document_template ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-full bg-[#F3F7F5] p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'structure'}
          data-testid="form-tab-structure"
          onClick={() => setTab('structure')}
          className={[
            'flex-1 rounded-full px-4 py-2 text-xs font-bold transition',
            tab === 'structure' ? 'bg-white text-[#245D50] shadow-sm' : 'text-[#65736E]',
          ].join(' ')}
        >
          공고 기반 구조로 작성
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'hwpx'}
          data-testid="form-tab-hwpx"
          onClick={() => setTab('hwpx')}
          className={[
            'flex-1 rounded-full px-4 py-2 text-xs font-bold transition',
            tab === 'hwpx' ? 'bg-white text-[#245D50] shadow-sm' : 'text-[#65736E]',
          ].join(' ')}
        >
          HWPX 양식 업로드
        </button>
      </div>

      {tab === 'structure' ? (
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6" data-testid="form-structure">
          {sections.length ? (
            <>
              <p className="text-sm font-bold text-[#24312D]">공고에서 뽑은 문서 구조입니다</p>
              <p className="mt-1 text-xs leading-5 text-[#65736E]">
                이 구조 그대로 다음 단계에서 항목별로 작성합니다.
              </p>
              <ol className="mt-4 space-y-2">
                {[...sections]
                  .sort((a, b) => a.order - b.order)
                  .map((section) => (
                    <li key={section.id} className="rounded-xl border border-[#F3F7F5] bg-[#F8FBFA] px-4 py-3">
                      <p className="text-sm font-semibold text-[#24312D]">
                        {section.order}. {section.title}
                      </p>
                      {section.hint ? <p className="mt-0.5 text-[11px] leading-4 text-[#65736E]">{section.hint}</p> : null}
                    </li>
                  ))}
              </ol>
              <button
                type="button"
                data-testid="form-structure-start"
                onClick={onStructureChosen}
                className="mt-5 rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
              >
                이 구조로 작성 시작
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-[#24312D]">공고에서 문서 구조를 찾지 못했습니다</p>
              <p className="mt-1 text-xs leading-5 text-[#65736E]">
                HWPX 양식을 업로드하면 그 구조 그대로 채울 수 있습니다. 공고를 연결했다면 다음 단계에서
                기본 구조로도 작성할 수 있습니다.
              </p>
              <button
                type="button"
                data-testid="form-structure-start"
                onClick={onStructureChosen}
                className="mt-5 rounded-full border border-[#245D50] px-6 py-3 text-sm font-bold text-[#245D50] transition hover:bg-[#EDF7F2]"
              >
                기본 구조로 작성 시작
              </button>
            </>
          )}
        </div>
      ) : (
        <div data-testid="form-hwpx">
          <p className="mb-3 text-xs leading-5 text-[#65736E]">
            받은 HWPX 양식을 올리면 채울 칸을 찾아 드립니다. 양식 작성은 이 화면 안에서 끝나고,
            완성본은 원본 구조 그대로 저장됩니다.
          </p>
          <HwpxFormEditor />
        </div>
      )}
    </div>
  );
}
