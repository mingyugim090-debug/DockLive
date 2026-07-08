'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  PROJECTS_CHANGED_EVENT,
  currentStageOf,
  dDayOf,
  listProjects,
  stagePath,
  type ProjectSummary,
} from '@/lib/pipeline';

function ProjectItem({ project, active, onClose }: { project: ProjectSummary; active: boolean; onClose: () => void }) {
  const stage = currentStageOf(project.state);
  const dday = dDayOf(project.deadline);
  return (
    <Link
      href={stagePath(project.id, stage)}
      onClick={onClose}
      className={[
        'block rounded-2xl px-3 py-2.5 transition',
        active ? 'bg-[#E7F1ED]' : 'hover:bg-[#F3F7F5]',
      ].join(' ')}
    >
      <p className="truncate text-[13px] font-semibold text-[#24312D]">{project.title}</p>
      <p className="mt-1 flex items-center gap-2 text-[11px]">
        <span className="font-bold text-[#245D50]">
          {project.state === 'exported' ? '내보내기 완료' : `${stage.n}/6 ${stage.label}`}
        </span>
        {dday !== null ? (
          <span className={dday <= 7 ? 'font-bold text-red-600' : 'text-[#65736E]'}>
            {dday >= 0 ? `D-${dday}` : `마감 지남`}
          </span>
        ) : null}
      </p>
    </Link>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  const refresh = useCallback(() => setProjects(listProjects()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, refresh);
  }, [refresh]);

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 bg-[#24312D]/25 backdrop-blur-sm transition lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[var(--theme-border)] bg-white px-4 py-5 shadow-panel transition-transform lg:static lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Link href="/" className="flex items-center gap-3 rounded-2xl px-3 py-2" onClick={onClose}>
          <Image src="/docklive-mark.svg" alt="" width={42} height={42} className="h-10 w-10" />
          <span>
            <span className="block text-base font-bold text-[#24312D]">DockLive</span>
            <span className="text-xs text-[#65736E]">공고 기반 제출 초안</span>
          </span>
        </Link>

        <Link
          href="/app/new"
          onClick={onClose}
          data-testid="sidebar-new-project"
          className="mt-6 flex items-center justify-center rounded-full bg-[#245D50] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
        >
          새 프로젝트
        </Link>

        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto" data-testid="sidebar-projects">
          <Link
            href="/app"
            onClick={onClose}
            className={[
              'block rounded-full px-3 py-2 text-[13px] font-bold transition',
              pathname === '/app' ? 'bg-[#E7F1ED] text-[#245D50]' : 'text-[#65736E] hover:bg-[#F3F7F5]',
            ].join(' ')}
          >
            프로젝트 목록
          </Link>
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              active={pathname.startsWith(`/app/p/${project.id}`)}
              onClose={onClose}
            />
          ))}
          {!projects.length ? (
            <p className="px-3 py-2 text-[11px] leading-5 text-[#65736E]">
              아직 프로젝트가 없습니다. 공고를 붙여넣으면 여기에 쌓입니다.
            </p>
          ) : null}
        </nav>

        <div className="mt-4 border-t border-[#DDE7E2] pt-3" data-testid="sidebar-account">
          <p className="px-3 text-[11px] font-bold text-[#65736E]">계정</p>
          <div className="mt-1 space-y-0.5">
            <Link
              href="/account/billing"
              onClick={onClose}
              className="block rounded-full px-3 py-2 text-[13px] font-semibold text-[#65736E] transition hover:bg-[#F3F7F5] hover:text-[#24312D]"
            >
              결제·플랜
            </Link>
            <Link
              href="/account/settings"
              onClick={onClose}
              className="block rounded-full px-3 py-2 text-[13px] font-semibold text-[#65736E] transition hover:bg-[#F3F7F5] hover:text-[#24312D]"
            >
              설정
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
