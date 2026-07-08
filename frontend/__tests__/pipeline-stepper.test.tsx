import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PipelineStepper } from '@/components/pipeline/PipelineStepper';
import { stageBySlug } from '@/lib/pipeline';

describe('PipelineStepper', () => {
  it('marks done stages with check, current with aria-current, unreached as disabled', () => {
    render(<PipelineStepper projectId="wf-1" state="questions" activeStage={stageBySlug('3-questions')!} />);

    // 1~2단계 완료 → 체크 + 클릭 이동 링크
    expect(screen.getByTestId('stepper-1-notice')).toHaveTextContent('✓');
    expect(screen.getByTestId('stepper-2-analysis')).toHaveTextContent('✓');
    expect(screen.getByTestId('stepper-2-analysis').closest('a')).toHaveAttribute('href', '/app/p/wf-1/2-analysis');

    // 현재 단계 강조
    expect(screen.getByTestId('stepper-3-questions')).toHaveAttribute('aria-current', 'step');

    // 미도달 단계 비활성 (링크 아님)
    expect(screen.getByTestId('stepper-5-draft')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('stepper-5-draft').closest('a')).toBeNull();
  });

  it('renders all six stage labels', () => {
    render(<PipelineStepper projectId="wf-1" state="draft" activeStage={stageBySlug('1-notice')!} />);
    for (const label of ['공고 입력', '요구사항 분석', '확인 질문', '양식 선택', '항목별 작성', '검사·내보내기']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
