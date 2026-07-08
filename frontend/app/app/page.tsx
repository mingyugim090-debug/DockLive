'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { analyzeText, getWorkflow } from '@/lib/api';
import {
  PROJECTS_CHANGED_EVENT,
  currentStageOf,
  dDayOf,
  listProjects,
  removeProject,
  saveProject,
  stagePath,
  summaryFromWorkflow,
  type ProjectSummary,
} from '@/lib/pipeline';
function StateBadge({ project }: { project: ProjectSummary }) {
  const stage = currentStageOf(project.state);
  const label = project.state === 'exported' ? '내보내기 완료' : `${stage.n}/6 ${stage.label}`;
  return (
    <span className="rounded-full bg-[#EDF7F2] px-2.5 py-1 text-[11px] font-bold text-[#245D50]">{label}</span>
  );
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const dday = dDayOf(deadline);
  if (dday === null) return null;
  const urgent = dday <= 7;
  return (
    <span
      className={[
        'rounded-full px-2.5 py-1 text-[11px] font-bold',
        urgent ? 'bg-red-50 text-red-600' : 'bg-[#F3F7F5] text-[#40504B]',
      ].join(' ')}
    >
      {dday >= 0 ? `D-${dday}` : `마감 ${-dday}일 지남`}
    </span>
  );
}

/** 빈 목록 = 붙여넣기 입력 즉시 노출 (PAGE_SPECS: 버튼 한 번 아끼기) */
function EmptyState() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    if (text.trim().length < 100) {
      setError('공고 내용이 너무 짧습니다. 100자 이상 붙여넣으면 분석을 시작합니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await analyzeText(text, '');
      const workflow = await getWorkflow(res.data.id);
      saveProject(summaryFromWorkflow(workflow.data));
      router.push(`/app/p/${res.data.id}/2-analysis`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '공고를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-[#24312D]">첫 공고를 붙여넣어 보세요</h1>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        공고가 근거가 되고, 평가기준이 기준이 됩니다. 붙여넣는 즉시 분석을 시작합니다.
      </p>
      <textarea
        data-testid="empty-paste-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="공고 본문을 붙여넣어 주세요"
        rows={8}
        className="mt-6 w-full rounded-2xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm text-[#24312D] placeholder:text-[#65736E] focus:border-[#6A9C89] focus:outline-none"
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          data-testid="empty-analyze"
          disabled={busy || !text.trim()}
          onClick={start}
          className="rounded-full bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
        >
          {busy ? '공고 읽는 중…' : '분석 시작'}
        </button>
        <Link href="/app/new" className="text-sm font-semibold text-[#3A7A68] underline-offset-4 hover:underline">
          파일·URL로 시작
        </Link>
      </div>
      <p className="mt-6 text-xs text-[#65736E]">
        공고 없이 양식만 채우려면{' '}
        <Link href="/app/new?mode=form" className="font-semibold text-[#3A7A68] underline-offset-4 hover:underline">
          양식만 채우기
        </Link>
        로 시작하세요.
      </p>
    </div>
  );
}

export default function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const refresh = useCallback(() => setProjects(listProjects()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, refresh);
  }, [refresh]);

  if (projects === null) return null;
  if (!projects.length) return <EmptyState />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#24312D]">프로젝트</h1>
        <Link
          href="/app/new"
          className="rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
        >
          새 프로젝트
        </Link>
      </div>
      <ul className="mt-6 space-y-3">
        {projects.map((project) => {
          const stage = currentStageOf(project.state);
          return (
            <li
              key={project.id}
              data-testid={`project-card-${project.id}`}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DDE7E2] bg-white px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#24312D]">{project.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StateBadge project={project} />
                  <DeadlineBadge deadline={project.deadline} />
                </div>
              </div>
              <button
                type="button"
                data-testid={`project-resume-${project.id}`}
                onClick={() => router.push(stagePath(project.id, stage))}
                className="rounded-full border border-[#245D50] px-4 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2]"
              >
                이어하기
              </button>
              {confirmingId === project.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-[#40504B]">삭제할까요?</span>
                  <button
                    type="button"
                    data-testid={`project-delete-confirm-${project.id}`}
                    onClick={() => {
                      removeProject(project.id);
                      setConfirmingId(null);
                    }}
                    className="font-bold text-red-600"
                  >
                    삭제
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)} className="font-semibold text-[#65736E]">
                    취소
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  data-testid={`project-delete-${project.id}`}
                  onClick={() => setConfirmingId(project.id)}
                  className="text-xs font-semibold text-[#65736E] hover:text-red-600"
                >
                  삭제
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
