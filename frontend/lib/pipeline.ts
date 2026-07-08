// 6단계 파이프라인 모델 (docs/FLOWS.md 상태 머신의 프론트 구현).
// 프로젝트 = 백엔드 WorkflowSession을 감싸는 요약. 목록은 localStorage 레지스트리로
// 유지한다 (백엔드 프로젝트 목록 API 도입 전까지의 브리지 — Phase B에서 교체 가능).
import type { AnalysisResult, WorkflowSession, WorkflowStatus } from './types';

export type ProjectState =
  | 'draft'
  | 'analyzed'
  | 'questions'
  | 'form_mapped'
  | 'drafting'
  | 'verified'
  | 'exported';

export type StageSlug =
  | '1-notice'
  | '2-analysis'
  | '3-questions'
  | '4-form'
  | '5-draft'
  | '6-export';

export interface PipelineStage {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  slug: StageSlug;
  label: string;
  /** 이 단계가 완료로 표시되는 최소 상태 */
  doneAt: ProjectState;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { n: 1, slug: '1-notice', label: '공고 입력', doneAt: 'draft' },
  { n: 2, slug: '2-analysis', label: '요구사항 분석', doneAt: 'analyzed' },
  { n: 3, slug: '3-questions', label: '확인 질문', doneAt: 'questions' },
  { n: 4, slug: '4-form', label: '양식 선택', doneAt: 'form_mapped' },
  { n: 5, slug: '5-draft', label: '항목별 작성', doneAt: 'drafting' },
  { n: 6, slug: '6-export', label: '검사·내보내기', doneAt: 'verified' },
];

const STATE_ORDER: ProjectState[] = [
  'draft',
  'analyzed',
  'questions',
  'form_mapped',
  'drafting',
  'verified',
  'exported',
];

export function stateRank(state: ProjectState): number {
  return STATE_ORDER.indexOf(state);
}

/** 상태에서 "현재 진행 중인 단계" 번호를 얻는다. exported는 6에 머문다. */
export function currentStageOf(state: ProjectState): PipelineStage {
  const rank = stateRank(state);
  const n = Math.min(rank + 1, 6) as PipelineStage['n'];
  return PIPELINE_STAGES[n - 1];
}

/** 단계 도달 가능 여부: 현재 단계 이하만 접근 가능 (PAGE_SPECS: 미도달 단계 리다이렉트).
 * 예외: 5단계(작성)는 완료 조건이 없으므로 작성 중이면 6단계로 언제든 이동 가능 (FLOWS.md). */
export function isStageReachable(state: ProjectState, stage: PipelineStage): boolean {
  if (stage.n === 6) return stateRank(state) >= stateRank('drafting');
  return stage.n <= currentStageOf(state).n;
}

export function isStageDone(state: ProjectState, stage: PipelineStage): boolean {
  return stateRank(state) >= stateRank(stage.doneAt) && currentStageOf(state).n > stage.n;
}

export function stagePath(projectId: string, stage: PipelineStage): string {
  return `/app/p/${projectId}/${stage.slug}`;
}

export function stageBySlug(slug: string): PipelineStage | undefined {
  return PIPELINE_STAGES.find((stage) => stage.slug === slug);
}

/** 백엔드 WorkflowStatus → 파이프라인 상태 매핑 */
export function stateFromWorkflowStatus(status: WorkflowStatus): ProjectState {
  switch (status) {
    case 'analyzed':
      return 'analyzed';
    case 'collecting_inputs':
      return 'questions';
    case 'drafting':
    case 'reviewing':
      return 'drafting';
    case 'confirmed':
      return 'verified';
    case 'finalized':
      return 'exported';
    default:
      return 'draft';
  }
}

// ---------------- 단계별 산출물 스키마 ----------------
// 각 단계가 프로젝트에 남기는 산출물의 참조. 값 자체는 백엔드가 소유하고
// (WorkflowSession, HwpxFormSession) 여기에는 재진입에 필요한 참조만 둔다.

export interface ProjectArtifacts {
  /** 1단계: 공고 원문 확보 방식 */
  notice_source?: 'text' | 'pdf' | 'url' | 'hwpx' | 'hwp' | 'demo';
  /** 2단계: 분석 결과 id (= workflow id) */
  analysis_id?: string;
  /** 3단계: 답변 완료한 질문 수 / 전체 질문 수 */
  questions_answered?: number;
  questions_total?: number;
  /** 4단계: HWPX 양식 세션 id 또는 템플릿 id */
  form_session_id?: string;
  template_id?: string;
  /** 5단계: 작성된 섹션 수 / 전체 */
  sections_drafted?: number;
  sections_total?: number;
  /** 6단계: export 이력 id 목록 */
  export_ids?: string[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  state: ProjectState;
  /** 양식만 채우기(4단계 직행) 프로젝트 여부 — FLOWS.md 건너뛰기 규칙 */
  mode: 'notice' | 'form';
  /** 공고 마감일 (ISO). D-n 계산용 */
  deadline: string | null;
  artifacts: ProjectArtifacts;
  created_at: string;
  updated_at: string;
}

export function deadlineFromAnalysis(analysis: AnalysisResult | null | undefined): string | null {
  const item = analysis?.timeline?.find((entry) => entry.is_deadline);
  return item?.date ?? null;
}

export function dDayOf(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const target = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function summaryFromWorkflow(workflow: WorkflowSession, mode: 'notice' | 'form' = 'notice'): ProjectSummary {
  const nowIso = new Date().toISOString();
  const total = workflow.user_inputs?.length ?? 0;
  const answered = workflow.user_inputs?.filter((field) => Boolean(field.value)).length ?? 0;
  return {
    id: workflow.id,
    title: workflow.analysis?.title || '제목 없는 프로젝트',
    state: stateFromWorkflowStatus(workflow.status),
    mode,
    deadline: deadlineFromAnalysis(workflow.analysis),
    artifacts: {
      analysis_id: workflow.analysis?.id,
      questions_answered: answered,
      questions_total: total,
      sections_drafted: workflow.draft_sections?.filter((s) => s.status !== 'empty').length ?? 0,
      sections_total: workflow.draft_sections?.length ?? 0,
    },
    created_at: nowIso,
    updated_at: nowIso,
  };
}

// ---------------- 프로젝트 레지스트리 (localStorage) ----------------

const REGISTRY_KEY = 'docklive.projects.v1';
export const PROJECTS_CHANGED_EVENT = 'docklive-projects-changed';

function readRegistry(): ProjectSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProjectSummary[]) : [];
  } catch {
    return [];
  }
}

function writeRegistry(projects: ProjectSummary[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
}

export function listProjects(): ProjectSummary[] {
  return readRegistry().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getProject(id: string): ProjectSummary | undefined {
  return readRegistry().find((project) => project.id === id);
}

export function saveProject(summary: ProjectSummary): void {
  const rest = readRegistry().filter((project) => project.id !== summary.id);
  const existing = readRegistry().find((project) => project.id === summary.id);
  writeRegistry([
    ...rest,
    {
      ...summary,
      created_at: existing?.created_at ?? summary.created_at,
      updated_at: new Date().toISOString(),
    },
  ]);
}

export function removeProject(id: string): void {
  writeRegistry(readRegistry().filter((project) => project.id !== id));
}
