'use client';

import Link from 'next/link';
import {
  PIPELINE_STAGES,
  isStageDone,
  isStageReachable,
  stagePath,
  type PipelineStage,
  type ProjectState,
} from '@/lib/pipeline';

export function PipelineStepper({
  projectId,
  state,
  activeStage,
}: {
  projectId: string;
  state: ProjectState;
  activeStage: PipelineStage;
}) {
  return (
    <ol data-testid="pipeline-stepper" className="flex flex-wrap items-center gap-1.5">
      {PIPELINE_STAGES.map((stage) => {
        const done = isStageDone(state, stage);
        const active = stage.n === activeStage.n;
        const reachable = isStageReachable(state, stage);
        const chip = [
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition',
          active
            ? 'bg-[#245D50] text-white'
            : done
              ? 'bg-[#EDF7F2] text-[#245D50]'
              : reachable
                ? 'text-[#40504B] hover:bg-[#F3F7F5]'
                : 'text-[#65736E]/50',
        ].join(' ');
        const body = (
          <>
            <span
              className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                active ? 'bg-white/20' : done ? 'bg-[#245D50] text-white' : 'border border-current',
              ].join(' ')}
            >
              {done ? '✓' : stage.n}
            </span>
            {stage.label}
          </>
        );
        return (
          <li key={stage.slug}>
            {reachable && !active ? (
              <Link data-testid={`stepper-${stage.slug}`} href={stagePath(projectId, stage)} className={chip}>
                {body}
              </Link>
            ) : (
              <span
                data-testid={`stepper-${stage.slug}`}
                aria-current={active ? 'step' : undefined}
                aria-disabled={!reachable}
                className={chip}
              >
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
