import { beforeEach, describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGES,
  currentStageOf,
  dDayOf,
  getProject,
  isStageReachable,
  listProjects,
  removeProject,
  saveProject,
  stageBySlug,
  stateFromWorkflowStatus,
  type ProjectSummary,
} from '@/lib/pipeline';

function summary(partial: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'wf-1',
    title: '테스트 공고',
    state: 'analyzed',
    mode: 'notice',
    deadline: null,
    artifacts: {},
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
    ...partial,
  };
}

describe('pipeline state machine', () => {
  it('maps backend workflow status to pipeline states', () => {
    expect(stateFromWorkflowStatus('analyzed')).toBe('analyzed');
    expect(stateFromWorkflowStatus('collecting_inputs')).toBe('questions');
    expect(stateFromWorkflowStatus('drafting')).toBe('drafting');
    expect(stateFromWorkflowStatus('reviewing')).toBe('drafting');
    expect(stateFromWorkflowStatus('confirmed')).toBe('verified');
    expect(stateFromWorkflowStatus('finalized')).toBe('exported');
  });

  it('derives the current stage from state', () => {
    expect(currentStageOf('draft').n).toBe(1);
    expect(currentStageOf('analyzed').n).toBe(2);
    expect(currentStageOf('questions').n).toBe(3);
    expect(currentStageOf('form_mapped').n).toBe(4);
    expect(currentStageOf('drafting').n).toBe(5);
    expect(currentStageOf('verified').n).toBe(6);
    expect(currentStageOf('exported').n).toBe(6);
  });

  it('blocks unreachable stages and allows visited ones', () => {
    const stage5 = stageBySlug('5-draft')!;
    const stage2 = stageBySlug('2-analysis')!;
    expect(isStageReachable('analyzed', stage5)).toBe(false);
    expect(isStageReachable('drafting', stage5)).toBe(true);
    expect(isStageReachable('drafting', stage2)).toBe(true);
  });

  it('allows stage 6 any time once drafting has started (no stage-5 completion gate)', () => {
    const stage6 = stageBySlug('6-export')!;
    expect(isStageReachable('drafting', stage6)).toBe(true);
    expect(isStageReachable('form_mapped', stage6)).toBe(false);
    expect(isStageReachable('analyzed', stage6)).toBe(false);
  });

  it('has six stages with url slugs', () => {
    expect(PIPELINE_STAGES).toHaveLength(6);
    expect(PIPELINE_STAGES.map((stage) => stage.slug)).toEqual([
      '1-notice',
      '2-analysis',
      '3-questions',
      '4-form',
      '5-draft',
      '6-export',
    ]);
  });
});

describe('dDayOf', () => {
  it('computes remaining days', () => {
    expect(dDayOf('2026-08-06', new Date('2026-07-08T09:00:00'))).toBe(29);
    expect(dDayOf('2026-07-08', new Date('2026-07-08T23:00:00'))).toBe(0);
    expect(dDayOf(null)).toBeNull();
    expect(dDayOf('not-a-date')).toBeNull();
  });
});

describe('project registry', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves, lists, and removes projects', () => {
    saveProject(summary({ id: 'a' }));
    saveProject(summary({ id: 'b', title: '두 번째' }));
    expect(listProjects()).toHaveLength(2);
    expect(getProject('b')?.title).toBe('두 번째');
    removeProject('a');
    expect(listProjects().map((p) => p.id)).toEqual(['b']);
  });

  it('updates in place and keeps created_at', () => {
    saveProject(summary({ id: 'a' }));
    const created = getProject('a')!.created_at;
    saveProject(summary({ id: 'a', state: 'drafting' }));
    expect(listProjects()).toHaveLength(1);
    expect(getProject('a')!.state).toBe('drafting');
    expect(getProject('a')!.created_at).toBe(created);
  });
});
