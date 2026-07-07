'use client';

import type { ChartSpec } from '@/lib/types';

const SERIES_COLORS = ['#245D50', '#6A9C89', '#3A7A68', '#A8C5B8'];
const WIDTH = 640;
const HEIGHT = 280;
const PADDING = { top: 24, right: 16, bottom: 48, left: 56 };

function formatValue(value: number): string {
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`;
  return value.toLocaleString('ko-KR');
}

function Legend({ chart }: { chart: ChartSpec }) {
  if (chart.series.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-[#40504B]">
      {chart.series.map((series, i) => (
        <span key={series.name} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
          {series.name}
        </span>
      ))}
    </div>
  );
}

function BarChart({ chart }: { chart: ChartSpec }) {
  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(1, ...chart.series.flatMap((s) => s.values.map((v) => Math.abs(v))));
  const groupWidth = plotW / Math.max(1, chart.labels.length);
  const barWidth = Math.min(48, (groupWidth * 0.7) / Math.max(1, chart.series.length));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={chart.title || '막대 그래프'} className="w-full">
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={WIDTH - PADDING.right} y2={HEIGHT - PADDING.bottom} stroke="#DDE7E2" />
      {chart.labels.map((label, li) => {
        const groupX = PADDING.left + groupWidth * li + (groupWidth - barWidth * chart.series.length) / 2;
        return (
          <g key={`${li}-${label}`}>
            {chart.series.map((series, si) => {
              const value = series.values[li] ?? 0;
              const h = (Math.abs(value) / maxValue) * plotH;
              const x = groupX + si * barWidth;
              const y = HEIGHT - PADDING.bottom - h;
              return (
                <g key={series.name}>
                  <rect data-testid="chart-bar" x={x} y={y} width={barWidth - 2} height={h} rx={3} fill={SERIES_COLORS[si % SERIES_COLORS.length]} />
                  <text x={x + (barWidth - 2) / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#40504B">
                    {formatValue(value)}
                  </text>
                </g>
              );
            })}
            <text x={PADDING.left + groupWidth * li + groupWidth / 2} y={HEIGHT - PADDING.bottom + 18} textAnchor="middle" fontSize="11" fill="#24312D">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ chart }: { chart: ChartSpec }) {
  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(1, ...chart.series.flatMap((s) => s.values.map((v) => Math.abs(v))));
  const stepX = plotW / Math.max(1, chart.labels.length - 1);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={chart.title || '꺾은선 그래프'} className="w-full">
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={WIDTH - PADDING.right} y2={HEIGHT - PADDING.bottom} stroke="#DDE7E2" />
      {chart.series.map((series, si) => {
        const points = series.values
          .map((value, i) => `${PADDING.left + stepX * i},${HEIGHT - PADDING.bottom - (Math.abs(value) / maxValue) * plotH}`)
          .join(' ');
        return (
          <g key={series.name}>
            <polyline data-testid="chart-line" points={points} fill="none" stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth="2.5" />
            {series.values.map((value, i) => (
              <circle key={i} cx={PADDING.left + stepX * i} cy={HEIGHT - PADDING.bottom - (Math.abs(value) / maxValue) * plotH} r="3.5" fill={SERIES_COLORS[si % SERIES_COLORS.length]} />
            ))}
          </g>
        );
      })}
      {chart.labels.map((label, i) => (
        <text key={`${i}-${label}`} x={PADDING.left + stepX * i} y={HEIGHT - PADDING.bottom + 18} textAnchor="middle" fontSize="11" fill="#24312D">
          {label}
        </text>
      ))}
    </svg>
  );
}

function PieChart({ chart }: { chart: ChartSpec }) {
  const series = chart.series[0];
  const total = series ? series.values.reduce((sum, v) => sum + Math.abs(v), 0) : 0;
  if (!series || total <= 0) return null;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const radius = Math.min(WIDTH, HEIGHT) / 2 - 30;
  let angle = -Math.PI / 2;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={chart.title || '원형 그래프'} className="w-full">
      {series.values.map((value, i) => {
        const slice = (Math.abs(value) / total) * Math.PI * 2;
        const x1 = cx + radius * Math.cos(angle);
        const y1 = cy + radius * Math.sin(angle);
        const midAngle = angle + slice / 2;
        angle += slice;
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);
        const largeArc = slice > Math.PI ? 1 : 0;
        const labelX = cx + radius * 0.65 * Math.cos(midAngle);
        const labelY = cy + radius * 0.65 * Math.sin(midAngle);
        return (
          <g key={`${i}-${chart.labels[i] ?? i}`}>
            <path
              data-testid="chart-slice"
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <text x={labelX} y={labelY} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">
              {chart.labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ChartBlock({ chart }: { chart: ChartSpec }) {
  return (
    <figure data-testid="chart-block" className="my-3">
      {chart.title ? (
        <figcaption className="mb-1 text-center text-xs font-bold text-[#245D50]">{chart.title}</figcaption>
      ) : null}
      {chart.chart_type === 'line' ? <LineChart chart={chart} /> : chart.chart_type === 'pie' ? <PieChart chart={chart} /> : <BarChart chart={chart} />}
      <Legend chart={chart} />
    </figure>
  );
}
