'use client';

import { useEffect, useRef } from 'react';
import type { AnalysisResult, UserInputField } from '@/lib/types';

/** 근거 칩이 가리키는 좌패널 항목 키:
 *  - 평가기준: `crit-{이름}`
 *  - 내 답변: `answer-{입력 id}`
 *  - 원문 근거: `ev-{field}`
 */
export function EvidencePanel({
  analysis,
  inputs,
  highlightKey,
}: {
  analysis: AnalysisResult;
  inputs: UserInputField[];
  highlightKey: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightKey || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLElement>(`[data-evidence-key="${CSS.escape(highlightKey)}"]`);
    if (!el) return;
    el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    el.classList.add('bg-[#EDF7F2]');
    const timer = window.setTimeout(() => el.classList.remove('bg-[#EDF7F2]'), 1600);
    return () => window.clearTimeout(timer);
  }, [highlightKey]);

  const criteria = analysis.rubric?.criteria?.length
    ? analysis.rubric.criteria
    : analysis.evaluation_criteria.map((name) => ({ name, weight: 0, description: '', source_ref: '' }));

  return (
    <div ref={rootRef} data-testid="evidence-panel" className="space-y-4 text-sm">
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-4">
        <h3 className="text-xs font-extrabold text-[#24312D]">평가기준</h3>
        <ul className="mt-2 space-y-1.5">
          {criteria.length ? (
            criteria.map((criterion) => (
              <li
                key={criterion.name}
                data-evidence-key={`crit-${criterion.name}`}
                className="rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="font-semibold text-[#24312D]">{criterion.name}</span>
                {criterion.weight ? (
                  <span className="ml-2 rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">
                    {criterion.weight}점
                  </span>
                ) : null}
                {criterion.description ? (
                  <p className="mt-0.5 text-[11px] leading-4 text-[#65736E]">{criterion.description}</p>
                ) : null}
              </li>
            ))
          ) : (
            <li className="px-2 text-[11px] text-[#65736E]">공고에서 평가기준을 찾지 못했습니다.</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-4">
        <h3 className="text-xs font-extrabold text-[#24312D]">요구사항</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] leading-5 text-[#40504B]">
          {analysis.eligibility.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {analysis.checklist.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-4">
        <h3 className="text-xs font-extrabold text-[#24312D]">내 답변</h3>
        <ul className="mt-2 space-y-1.5">
          {inputs.length ? (
            inputs.map((field) => (
              <li
                key={field.id}
                data-evidence-key={`answer-${field.id}`}
                className="rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="text-[11px] font-semibold text-[#65736E]">{field.label}</span>
                {field.value ? (
                  <p className="text-[12px] leading-5 text-[#24312D]">{field.value}</p>
                ) : (
                  <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    미입력
                  </span>
                )}
              </li>
            ))
          ) : (
            <li className="px-2 text-[11px] text-[#65736E]">확인 질문이 없었습니다.</li>
          )}
        </ul>
      </section>

      {analysis.source_evidence.length ? (
        <section className="rounded-2xl border border-[#DDE7E2] bg-white p-4">
          <h3 className="text-xs font-extrabold text-[#24312D]">공고 원문 근거</h3>
          <ul className="mt-2 space-y-2">
            {analysis.source_evidence.map((evidence, index) => (
              <li
                key={`${evidence.field}-${index}`}
                data-evidence-key={`ev-${evidence.field}`}
                className="rounded-lg px-2 py-1.5 transition-colors"
              >
                <p className="text-[10px] font-bold text-[#65736E]">{evidence.field}</p>
                <blockquote className="mt-0.5 border-l-2 border-[#6A9C89] pl-2 text-[12px] leading-5 text-[#40504B]">
                  {evidence.quote}
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
