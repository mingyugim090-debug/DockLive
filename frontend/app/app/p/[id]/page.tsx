'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getWorkflow } from '@/lib/api';
import { currentStageOf, getProject, saveProject, stagePath, summaryFromWorkflow } from '@/lib/pipeline';

/** 프로젝트 상세 진입점 — 현재 단계로 자동 이동 (IA.md 라우트 맵) */
export default function ProjectEntryPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let project = getProject(params.id);
      if (!project) {
        try {
          const workflow = await getWorkflow(params.id);
          project = summaryFromWorkflow(workflow.data);
          saveProject(project);
        } catch {
          if (!cancelled) router.replace('/app');
          return;
        }
      }
      if (!cancelled) router.replace(stagePath(params.id, currentStageOf(project.state)));
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  return null;
}
