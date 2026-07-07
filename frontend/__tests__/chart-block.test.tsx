import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartBlock } from '@/components/projects/ChartBlock';
import type { ChartSpec } from '@/lib/types';

const BAR_CHART: ChartSpec = {
  chart_type: 'bar',
  title: '예산 배분',
  labels: ['인건비', '장비비', '마케팅비'],
  series: [
    { name: '1차년도', values: [42000000, 18000000, 9000000] },
    { name: '2차년도', values: [45000000, 6000000, 15000000] },
  ],
  source_table_id: 'pf-1:sheet-0',
};

describe('ChartBlock', () => {
  it('renders one bar per label per series', () => {
    render(<ChartBlock chart={BAR_CHART} />);
    expect(screen.getAllByTestId('chart-bar')).toHaveLength(6);
    expect(screen.getByText('예산 배분')).toBeInTheDocument();
    expect(screen.getByText('인건비')).toBeInTheDocument();
  });

  it('renders a legend when there are multiple series', () => {
    render(<ChartBlock chart={BAR_CHART} />);
    expect(screen.getByText('1차년도')).toBeInTheDocument();
    expect(screen.getByText('2차년도')).toBeInTheDocument();
  });

  it('renders line and pie variants', () => {
    const { rerender } = render(<ChartBlock chart={{ ...BAR_CHART, chart_type: 'line' }} />);
    expect(screen.getAllByTestId('chart-line')).toHaveLength(2);
    rerender(<ChartBlock chart={{ ...BAR_CHART, chart_type: 'pie' }} />);
    expect(screen.getAllByTestId('chart-slice')).toHaveLength(3);
  });
});
