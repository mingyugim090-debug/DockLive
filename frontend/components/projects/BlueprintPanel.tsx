'use client';

import type { DocumentBlueprint } from '@/lib/types';

const VISUAL_LABELS: Record<string, string> = {
  table: '표',
  chart: '그래프',
  paragraph: '문단',
  heading: '제목',
};

export function BlueprintPanel({ blueprint }: { blueprint: DocumentBlueprint }) {
  return (
    <div className="space-y-3" data-testid="blueprint-panel">
      <p className="text-[11px] leading-4 text-[#65736E]">{blueprint.rationale}</p>
      <ol className="space-y-2">
        {blueprint.sections.map((section, index) => (
          <li key={section.id} className="rounded-xl border border-[#DDE7E2] bg-white px-3 py-2">
            <p className="text-xs font-bold text-[#24312D]">
              {index + 1}. {section.title}
            </p>
            {section.intent ? <p className="mt-0.5 text-[11px] text-[#65736E]">{section.intent}</p> : null}
            {section.planned_visuals.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {section.planned_visuals.map((plan, i) => (
                  <span key={`${plan.source_ref}-${i}`} className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">
                    {VISUAL_LABELS[plan.kind] ?? plan.kind} · {plan.title}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {blueprint.confirmation_required.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
          {blueprint.confirmation_required.map((item) => (
            <p key={item}>· {item}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
