'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getWorkflow, saveWorkflowInputs } from '@/lib/api';
import { PipelineStepper } from '@/components/pipeline/PipelineStepper';
import { DraftStage } from '@/components/pipeline/DraftStage';
import { ExportStage } from '@/components/pipeline/ExportStage';
import { FormStage } from '@/components/pipeline/FormStage';
import {
  currentStageOf,
  dDayOf,
  getProject,
  isStageReachable,
  saveProject,
  stageBySlug,
  stagePath,
  stateRank,
  summaryFromWorkflow,
  type PipelineStage,
  type ProjectState,
  type ProjectSummary,
} from '@/lib/pipeline';
import type { AnalysisResult, SourceEvidence, UserInputField, WorkflowSession } from '@/lib/types';

const SOURCE_LABEL: Record<string, string> = {
  pdf: 'PDF 파일',
  hwpx: 'HWPX 파일',
  hwp: 'HWP 파일',
  url: '웹 공고',
  text: '붙여넣은 텍스트',
  demo: '데모 공고',
};

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-[#24312D]">{title}</h2>
        {badge}
      </div>
      <div className="mt-3 text-sm leading-6 text-[#40504B]">{children}</div>
    </section>
  );
}

/** 카드 하단 "원문 근거" 토글 — 공고 원문 인용을 하이라이트로 보여준다. */
function EvidenceQuotes({ evidence, keywords }: { evidence: SourceEvidence[]; keywords: string[] }) {
  const [open, setOpen] = useState(false);
  const matched = evidence.filter((item) =>
    keywords.some((keyword) => item.field.toLowerCase().includes(keyword) || item.quote.includes(keyword)),
  );
  if (!matched.length) return null;
  return (
    <div className="mt-3 border-t border-[#F3F7F5] pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-bold text-[#3A7A68] underline-offset-2 hover:underline"
      >
        원문 근거 {matched.length}건 {open ? '접기' : '보기'}
      </button>
      {open ? (
        <ul className="mt-2 space-y-2">
          {matched.map((item, index) => (
            <li key={`${item.field}-${index}`}>
              <blockquote className="rounded-lg bg-[#EDF7F2] px-3 py-2 text-[12px] leading-5 text-[#24312D]">
                “{item.quote}”
                <span className="mt-1 block text-[10px] text-[#65736E]">
                  {item.field}
                  {item.page ? ` · ${item.page}쪽` : ''}
                </span>
              </blockquote>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NoticeStage({ workflow }: { workflow: WorkflowSession }) {
  const source = workflow.analysis?.source_type ? SOURCE_LABEL[workflow.analysis.source_type] ?? '원문' : '원문';
  return (
    <div className="space-y-4">
      <Card title="확보한 공고">
        <p className="font-bold text-[#24312D]">{workflow.analysis?.title}</p>
        <p className="mt-1 text-xs text-[#65736E]">
          {workflow.analysis?.organization} · {source}
          {workflow.analysis?.source_name ? ` (${workflow.analysis.source_name})` : ''}
        </p>
        {workflow.analysis?.summary ? <p className="mt-3">{workflow.analysis.summary}</p> : null}
      </Card>
      <Card title="공고 교체">
        <p>공고를 교체하면 요구사항 분석과 확인 질문이 다시 계산됩니다. 교체가 필요하면 새 프로젝트로 시작해 주세요.</p>
        <Link
          href="/app/new"
          className="mt-3 inline-block rounded-full border border-[#245D50] px-4 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2]"
        >
          새 공고로 시작
        </Link>
      </Card>
    </div>
  );
}

function AnalysisStage({
  analysis,
  project,
  onConfirm,
}: {
  analysis: AnalysisResult;
  project: ProjectSummary;
  onConfirm: () => void;
}) {
  const deadline = analysis.timeline?.find((item) => item.is_deadline);
  const dday = dDayOf(deadline?.date ?? null);
  const evidence = analysis.source_evidence ?? [];
  const criteria = analysis.rubric?.criteria?.length
    ? analysis.rubric.criteria
    : analysis.evaluation_criteria.map((name) => ({ name, weight: 0, description: '', source_ref: '' }));

  return (
    <div className="space-y-4">
      <Card title="마감일">
        {deadline ? (
          <p>
            <span className="font-bold text-[#245D50]">{deadline.date}</span>
            {dday !== null ? <span className="ml-2 text-xs font-bold text-red-600">D-{dday}</span> : null}
            <span className="ml-2 text-xs text-[#65736E]">{deadline.label}</span>
          </p>
        ) : (
          <p className="text-[#65736E]">공고에서 마감일을 찾지 못했습니다. 원문을 확인해 주세요.</p>
        )}
        <EvidenceQuotes evidence={evidence} keywords={['마감', '접수', '기간', 'deadline', 'timeline']} />
      </Card>

      <Card title="지원 자격">
        {analysis.eligibility?.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {analysis.eligibility.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[#65736E]">공고에서 자격 요건을 찾지 못했습니다.</p>
        )}
        <EvidenceQuotes evidence={evidence} keywords={['자격', '대상', 'eligibility']} />
      </Card>

      <Card title="제출 서류">
        {analysis.checklist?.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {analysis.checklist.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[#65736E]">공고에서 제출 서류 목록을 찾지 못했습니다.</p>
        )}
        <EvidenceQuotes evidence={evidence} keywords={['서류', '제출', 'checklist', 'submission']} />
      </Card>

      <Card title="평가기준" badge={analysis.rubric?.total_weight ? (
        <span className="rounded-full bg-[#EDF7F2] px-2.5 py-1 text-[11px] font-bold text-[#245D50]">
          총 {analysis.rubric.total_weight}점
        </span>
      ) : undefined}
      >
        {criteria.length ? (
          <ul className="space-y-2" data-testid="analysis-criteria">
            {criteria.map((criterion) => (
              <li key={criterion.name} className="flex items-start gap-2">
                <span className="flex-1">
                  <span className="font-semibold text-[#24312D]">{criterion.name}</span>
                  {criterion.description ? (
                    <span className="block text-[11px] leading-4 text-[#65736E]">{criterion.description}</span>
                  ) : null}
                </span>
                {criterion.weight ? (
                  <span className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[11px] font-bold text-[#245D50]">
                    {criterion.weight}점
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#65736E]">공고에서 평가기준을 찾지 못했습니다. 작성 단계에서는 기본 구성으로 진행합니다.</p>
        )}
        <EvidenceQuotes evidence={evidence} keywords={['평가', '심사', '배점', 'evaluation']} />
      </Card>

      {project.state === 'analyzed' ? (
        <button
          type="button"
          data-testid="analysis-confirm"
          onClick={onConfirm}
          className="rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
        >
          분석 확인 — 확인 질문으로
        </button>
      ) : null}
    </div>
  );
}

function QuestionsStage({
  workflow,
  projectId,
  onAllDone,
}: {
  workflow: WorkflowSession;
  projectId: string;
  onAllDone: () => void;
}) {
  const [fields, setFields] = useState<UserInputField[]>(workflow.user_inputs ?? []);
  const [savedAt, setSavedAt] = useState('');

  const save = async (next: UserInputField[]) => {
    try {
      await saveWorkflowInputs(
        projectId,
        next.map((field) => ({ field_id: field.id, value: field.value ?? '' })),
      );
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      // 자동 저장 실패는 다음 blur에서 재시도 — 입력값은 로컬에 남아 있다.
    }
  };

  if (!fields.length) {
    return (
      <div className="space-y-4">
        <Card title="확인 질문">
          <p className="text-[#65736E]">공고에 없는 정보가 없어 바로 다음 단계로 갈 수 있습니다.</p>
        </Card>
        <button
          type="button"
          data-testid="questions-next"
          onClick={onAllDone}
          className="rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
        >
          양식 선택으로
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#65736E]">공고에 없는 정보만 묻습니다. 비워 두면 작성 단계에서 미입력으로 표시됩니다.</p>
        {savedAt ? <span className="text-[11px] text-[#65736E]">저장됨 {savedAt}</span> : null}
      </div>
      {fields.map((field, index) => (
        <Card key={field.id} title={field.label}>
          {field.description ? <p className="mb-2 text-xs text-[#65736E]">{field.description}</p> : null}
          {field.field_type === 'textarea' ? (
            <textarea
              data-testid={`question-${field.id}`}
              defaultValue={field.value ?? ''}
              rows={3}
              onBlur={(e) => {
                const next = fields.map((f, i) => (i === index ? { ...f, value: e.target.value } : f));
                setFields(next);
                save(next);
              }}
              className="w-full rounded-xl border border-[#DDE7E2] px-3 py-2 text-sm focus:border-[#6A9C89] focus:outline-none"
            />
          ) : (
            <input
              data-testid={`question-${field.id}`}
              type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
              defaultValue={field.value ?? ''}
              onBlur={(e) => {
                const next = fields.map((f, i) => (i === index ? { ...f, value: e.target.value } : f));
                setFields(next);
                save(next);
              }}
              className="w-full rounded-xl border border-[#DDE7E2] px-3 py-2 text-sm focus:border-[#6A9C89] focus:outline-none"
            />
          )}
        </Card>
      ))}
      <button
        type="button"
        data-testid="questions-next"
        onClick={onAllDone}
        className="rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
      >
        양식 선택으로 — 나머지는 나중에 채우기
      </button>
    </div>
  );
}

const STAGE_WIDTH: Record<string, string> = {
  '1-notice': 'max-w-3xl',
  '2-analysis': 'max-w-3xl',
  '3-questions': 'max-w-3xl',
  '4-form': 'max-w-5xl',
  '5-draft': 'max-w-6xl',
  '6-export': 'max-w-3xl',
};

export default function StagePage({ params }: { params: { id: string; stage: string } }) {
  const router = useRouter();
  const stage = stageBySlug(params.stage);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSession | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!stage) {
      router.replace(`/app/p/${params.id}`);
      return;
    }
    let cancelled = false;
    (async () => {
      let summary = getProject(params.id);
      try {
        const res = await getWorkflow(params.id);
        if (cancelled) return;
        setWorkflow(res.data);
        if (!summary) {
          summary = summaryFromWorkflow(res.data);
          saveProject(summary);
        }
      } catch {
        if (!summary) {
          if (!cancelled) setLoadError('프로젝트를 찾지 못했습니다. 목록에서 다시 선택해 주세요.');
          return;
        }
      }
      if (cancelled || !summary) return;
      // 미도달 단계 직접 접근 → 현재 단계로 (PAGE_SPECS)
      if (!isStageReachable(summary.state, stage)) {
        router.replace(stagePath(params.id, currentStageOf(summary.state)));
        return;
      }
      setProject(summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, params.stage, router, stage]);

  /** 워크플로 갱신 시 프로젝트 요약도 동기화 (상태는 뒤로 내려가지 않게 유지) */
  const syncWorkflow = useCallback(
    (next: WorkflowSession) => {
      setWorkflow(next);
      setProject((prev) => {
        if (!prev) return prev;
        const derived = summaryFromWorkflow(next, prev.mode);
        const state = stateRank(derived.state) > stateRank(prev.state) ? derived.state : prev.state;
        const merged = { ...prev, ...derived, state, mode: prev.mode, created_at: prev.created_at };
        saveProject(merged);
        return merged;
      });
    },
    [],
  );

  if (!stage) return null;
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[#65736E]">
        <p>{loadError}</p>
        <Link href="/app" className="mt-3 inline-block font-bold text-[#245D50] underline-offset-4 hover:underline">
          프로젝트 목록으로
        </Link>
      </div>
    );
  }
  if (!project) return null;

  const advance = (state: ProjectState, nextStage: PipelineStage) => {
    const next = { ...project, state: stateRank(state) > stateRank(project.state) ? state : project.state };
    saveProject(next);
    setProject(next);
    router.push(stagePath(project.id, nextStage));
  };

  const setStateOnly = (state: ProjectState) => {
    setProject((prev) => {
      if (!prev || stateRank(state) <= stateRank(prev.state)) return prev;
      const next = { ...prev, state };
      saveProject(next);
      return next;
    });
  };

  return (
    <div className={`mx-auto ${STAGE_WIDTH[stage.slug] ?? 'max-w-3xl'} px-4 py-8`}>
      <header className="mb-6">
        <p className="text-xs font-semibold text-[#65736E]">{project.title}</p>
        <div className="mt-3">
          <PipelineStepper projectId={project.id} state={project.state} activeStage={stage} />
        </div>
      </header>

      {stage.slug === '1-notice' && workflow ? <NoticeStage workflow={workflow} /> : null}
      {stage.slug === '2-analysis' && workflow ? (
        <AnalysisStage
          analysis={workflow.analysis}
          project={project}
          onConfirm={() => advance('questions', stageBySlug('3-questions')!)}
        />
      ) : null}
      {stage.slug === '3-questions' && workflow ? (
        <QuestionsStage
          workflow={workflow}
          projectId={project.id}
          onAllDone={() => advance('form_mapped', stageBySlug('4-form')!)}
        />
      ) : null}
      {stage.slug === '4-form' ? (
        <FormStage
          workflow={workflow}
          defaultTab={project.mode === 'form' ? 'hwpx' : 'structure'}
          onStructureChosen={() => advance('drafting', stageBySlug('5-draft')!)}
        />
      ) : null}
      {stage.slug === '5-draft' && workflow ? (
        <DraftStage
          workflow={workflow}
          onWorkflow={syncWorkflow}
          onGoExport={() => advance('drafting', stageBySlug('6-export')!)}
        />
      ) : null}
      {stage.slug === '6-export' && workflow ? (
        <ExportStage
          workflow={workflow}
          projectId={project.id}
          onWorkflow={syncWorkflow}
          onVerified={() => setStateOnly('verified')}
          onExported={() => setStateOnly('exported')}
        />
      ) : null}
    </div>
  );
}
