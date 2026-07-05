import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { RubricScoreCard } from '@/components/score/RubricScoreCard';
import type { EvaluationRubric, RubricScore } from '@/lib/types';

const rubric: EvaluationRubric = {
  criteria: [
    { name: '문제인식', weight: 30, description: '문제 정의', source_ref: '공고 평가기준' },
    { name: '실현가능성', weight: 30, description: '실행 계획', source_ref: '공고 평가기준' },
  ],
  total_weight: 100,
  source: 'notice',
};

const weakScore: RubricScore = {
  per_criterion: [
    { name: '문제인식', score: 30, max: 30, weakness: '', suggestion: '', target_section_id: null },
    {
      name: '실현가능성',
      score: 15,
      max: 30,
      weakness: '실행 계획에 구체적 일정이 없음',
      suggestion: '월별 추진 일정을 추가하세요',
      target_section_id: 'sec-solution',
    },
  ],
  total: 45,
  grounded_only: true,
  scored_at: '2026-07-05T00:00:00Z',
};

describe('RubricScoreCard', () => {
  it('shows only the score trigger when no rubric score exists yet', () => {
    render(
      <RubricScoreCard
        rubric={rubric}
        rubricScore={null}
        busy={false}
        onScore={vi.fn()}
        onReviseWeak={vi.fn()}
        reviseCounts={{}}
      />,
    );

    expect(screen.getByRole('button', { name: '채점하기' })).toBeInTheDocument();
    expect(screen.queryByText(/총점/)).not.toBeInTheDocument();
  });

  it('lets the user trigger a revise for a weak criterion under the revision cap', () => {
    const onReviseWeak = vi.fn();
    render(
      <RubricScoreCard
        rubric={rubric}
        rubricScore={weakScore}
        busy={false}
        onScore={vi.fn()}
        onReviseWeak={onReviseWeak}
        reviseCounts={{}}
      />,
    );

    expect(screen.getByText('총점 45 / 100')).toBeInTheDocument();
    const reviseButton = screen.getByRole('button', { name: /약점만 재작성/ });
    fireEvent.click(reviseButton);

    expect(onReviseWeak).toHaveBeenCalledWith('sec-solution', expect.stringContaining('실행 계획에 구체적 일정이 없음'));
  });

  it('stops offering a revise button once the weak section hit the revision cap', () => {
    render(
      <RubricScoreCard
        rubric={rubric}
        rubricScore={weakScore}
        busy={false}
        onScore={vi.fn()}
        onReviseWeak={vi.fn()}
        reviseCounts={{ 'sec-solution': 2 }}
      />,
    );

    expect(screen.queryByRole('button', { name: /약점만 재작성/ })).not.toBeInTheDocument();
    expect(screen.getByText('재작성 횟수를 모두 사용했습니다. 이제부터는 직접 편집해 주세요.')).toBeInTheDocument();
  });
});
