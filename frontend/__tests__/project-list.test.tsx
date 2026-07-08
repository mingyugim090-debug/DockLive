import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectListPage from '@/app/app/page';
import { saveProject, type ProjectSummary } from '@/lib/pipeline';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  analyzeText: vi.fn(),
  getWorkflow: vi.fn(),
}));

function summary(partial: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'wf-1',
    title: '2026 스마트상점 지원사업',
    state: 'questions',
    mode: 'notice',
    deadline: null,
    artifacts: {},
    created_at: '2026-07-08T00:00:00.000Z',
    updated_at: '2026-07-08T00:00:00.000Z',
    ...partial,
  };
}

describe('ProjectListPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockClear();
  });

  it('shows the paste input immediately when there are no projects', async () => {
    render(<ProjectListPage />);
    await waitFor(() => expect(screen.getByTestId('empty-paste-input')).toBeInTheDocument());
    expect(screen.getByText('첫 공고를 붙여넣어 보세요')).toBeInTheDocument();
  });

  it('renders project cards with state badge and resume deep link', async () => {
    saveProject(summary());
    render(<ProjectListPage />);
    await waitFor(() => expect(screen.getByTestId('project-card-wf-1')).toBeInTheDocument());
    expect(screen.getByText('3/6 확인 질문')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('project-resume-wf-1'));
    expect(pushMock).toHaveBeenCalledWith('/app/p/wf-1/3-questions');
  });

  it('deletes only after inline confirmation', async () => {
    saveProject(summary());
    render(<ProjectListPage />);
    await waitFor(() => expect(screen.getByTestId('project-card-wf-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('project-delete-wf-1'));
    expect(screen.getByTestId('project-card-wf-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('project-delete-confirm-wf-1'));
    await waitFor(() => expect(screen.queryByTestId('project-card-wf-1')).not.toBeInTheDocument());
  });
});
