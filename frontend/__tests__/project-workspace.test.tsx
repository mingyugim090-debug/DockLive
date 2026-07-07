import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectWorkspace } from '@/components/projects/ProjectWorkspace';
import type { DocumentWorkspace, GeneratedDocument, VisualBlock } from '@/lib/types';

const apiMocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  createDemoWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  uploadWorkspaceFile: vi.fn(),
  analyzeWorkspace: vi.fn(),
  buildWorkspaceBlueprint: vi.fn(),
  generateWorkspaceDocument: vi.fn(),
  transformWorkspaceBlock: vi.fn(),
  exportWorkspace: vi.fn(),
  planWorkspaceExcelArtifact: vi.fn(),
  generateWorkspaceExcelArtifact: vi.fn(),
  openWorkspaceArtifact: vi.fn(),
  syncWorkspaceArtifact: vi.fn(),
}));

vi.mock('@/lib/api', () => apiMocks);

function cell(text: string, row: number, col: number) {
  return { text, row_index: row, col_index: col, row_span: 1, col_span: 1 };
}

const PARAGRAPH_BLOCK: VisualBlock = {
  id: 'blk-2',
  section_id: 'bs-1',
  kind: 'paragraph',
  markdown: '사업 기간: 2026년 3월 ~ 11월\n예산: 500만원',
  rows: [],
  chart: null,
  source_refs: [],
  status: 'drafted',
};

const TABLE_BLOCK: VisualBlock = {
  id: 'blk-3',
  section_id: 'bs-4',
  kind: 'table',
  markdown: '',
  rows: [
    [cell('항목', 0, 0), cell('1차년도', 0, 1)],
    [cell('인건비', 1, 0), cell('42000000', 1, 1)],
  ],
  chart: null,
  source_refs: ['pf-1:sheet-0'],
  status: 'drafted',
};

const CHART_BLOCK: VisualBlock = {
  id: 'blk-4',
  section_id: 'bs-4',
  kind: 'chart',
  markdown: '',
  rows: TABLE_BLOCK.rows,
  chart: {
    chart_type: 'bar',
    title: '예산 그래프',
    labels: ['인건비'],
    series: [{ name: '1차년도', values: [42000000] }],
    source_table_id: 'pf-1:sheet-0',
  },
  source_refs: ['pf-1:sheet-0'],
  status: 'drafted',
};

const DOCUMENT: GeneratedDocument = {
  id: 'doc-1',
  title: '디지털전환 사업계획서',
  style_profile_id: 'submission',
  blocks: [
    { id: 'blk-1', section_id: 'bs-1', kind: 'heading', markdown: '사업 개요', rows: [], chart: null, source_refs: [], status: 'drafted' },
    PARAGRAPH_BLOCK,
    TABLE_BLOCK,
    CHART_BLOCK,
  ],
  warnings: [],
};

const EXCEL_ARTIFACT = {
  id: 'artifact-1',
  workspace_id: 'ws-1',
  kind: 'excel',
  filename: 'dashboard.xlsx',
  content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  storage_path: 'C:\\tmp\\dashboard.xlsx',
  plan: {
    id: 'wp-1',
    artifact_kind: 'excel',
    title: 'Excel dashboard',
    sheets: [
      { id: 'dashboard', name: '대시보드', title: '대시보드', tables: [], charts: [], notes: [] },
      { id: 'documents', name: '제출서류', title: '제출서류', tables: [], charts: [], notes: [] },
      { id: 'charts', name: '차트', title: '차트', tables: [], charts: [], notes: [] },
      { id: 'evidence', name: '원문근거', title: '원문근거', tables: [], charts: [], notes: [] },
    ],
    confirmation_required: ['source confirmation: review exported cells before final submission'],
    warnings: [],
  },
  sync_state: {
    status: 'not_opened',
    last_opened_at: '',
    last_synced_at: '',
    last_mtime: 0,
    snapshot: {},
    warnings: [],
    error_message: '',
  },
  warnings: [],
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
};

function workspaceFixture(overrides: Partial<DocumentWorkspace> = {}): DocumentWorkspace {
  return {
    id: 'ws-1',
    title: '데모 프로젝트',
    files: [
      {
        id: 'pf-1',
        workspace_id: 'ws-1',
        filename: '예산.csv',
        file_kind: 'spreadsheet',
        source_type: 'csv',
        text: '',
        sheet_data: { sheets: [{ name: '예산.csv', headers: ['항목', '1차년도'], rows: [['인건비', '42000000']] }], warnings: [] },
        warnings: [],
        created_at: '2026-07-07T00:00:00Z',
      },
    ],
    analysis: {
      id: 'a-1',
      source_type: 'demo',
      summary: '소상공인 디지털전환 지원',
      doc_type: 'startup',
      applicant_kind: 'company',
      title: '소상공인 디지털전환 지원사업',
      organization: '중소벤처기업부',
      timeline: [{ id: 't-1', label: '접수 마감', date: '2026-08-01', d_day: 25, is_deadline: true, status: 'safe' }],
      checklist: [],
      document_template: [],
      analyzed_at: '2026-07-07T00:00:00Z',
      eligibility: ['소상공인'],
      evaluation_criteria: [],
      benefits: [],
      cautions: [],
      uncertain_fields: [],
      evidence_quotes: [],
      source_evidence: [],
      missing_questions: [],
      support_programs: [],
    },
    blueprint: null,
    document: null,
    artifacts: [],
    status: 'analyzed',
    created_at: '2026-07-07T00:00:00Z',
    updated_at: '2026-07-07T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProjectWorkspace', () => {
  it('starts a demo workspace and shows files with analysis summary', async () => {
    apiMocks.createDemoWorkspace.mockResolvedValue({ success: true, data: workspaceFixture() });

    render(<ProjectWorkspace />);
    fireEvent.click(screen.getByTestId('start-demo'));

    await waitFor(() => expect(screen.getByTestId('workspace-file-list')).toBeInTheDocument());
    expect(screen.getByText('예산.csv')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-summary')).toBeInTheDocument();
    expect(screen.getByText('소상공인 디지털전환 지원사업')).toBeInTheDocument();
  });

  it('runs blueprint then generate and renders paragraph, table and chart blocks', async () => {
    const base = workspaceFixture();
    apiMocks.createDemoWorkspace.mockResolvedValue({ success: true, data: base });
    apiMocks.buildWorkspaceBlueprint.mockResolvedValue({
      success: true,
      data: workspaceFixture({
        status: 'blueprint_ready',
        blueprint: {
          id: 'bp-1',
          sections: [
            { id: 'bs-1', title: '사업 개요', intent: '', planned_visuals: [], source_file_ids: [] },
            {
              id: 'bs-4',
              title: '예산 계획',
              intent: '',
              planned_visuals: [{ kind: 'table', title: '예산.csv', source_ref: 'pf-1:sheet-0' }],
              source_file_ids: ['pf-1'],
            },
          ],
          rationale: '공고 분석에서 추출한 구성입니다.',
          confirmation_required: [],
        },
      }),
    });
    apiMocks.generateWorkspaceDocument.mockResolvedValue({ success: true, data: DOCUMENT });

    render(<ProjectWorkspace />);
    fireEvent.click(screen.getByTestId('start-demo'));
    await waitFor(() => expect(screen.getByTestId('action-blueprint')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('action-blueprint'));
    await waitFor(() => expect(screen.getByTestId('blueprint-panel')).toBeInTheDocument());
    expect(screen.getByText('표 · 예산.csv')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('action-generate'));
    await waitFor(() => expect(screen.getByTestId('document-canvas')).toBeInTheDocument());
    expect(screen.getByText('디지털전환 사업계획서')).toBeInTheDocument();
    expect(screen.getByText(/사업 기간: 2026년 3월/)).toBeInTheDocument();
    expect(screen.getByText('42000000')).toBeInTheDocument();
    expect(screen.getByTestId('chart-block')).toBeInTheDocument();
    expect(screen.getByTestId('export-bar')).toBeInTheDocument();
  });

  it('transforms a selected paragraph into a table via the inline command menu', async () => {
    apiMocks.createDemoWorkspace.mockResolvedValue({
      success: true,
      data: workspaceFixture({ status: 'generated', document: DOCUMENT }),
    });
    const transformed: VisualBlock = {
      ...PARAGRAPH_BLOCK,
      kind: 'table',
      markdown: '',
      rows: [
        [cell('항목', 0, 0), cell('내용', 0, 1)],
        [cell('사업 기간', 1, 0), cell('2026년 3월 ~ 11월', 1, 1)],
        [cell('예산', 2, 0), cell('500만원', 2, 1)],
      ],
      status: 'revised',
    };
    apiMocks.transformWorkspaceBlock.mockResolvedValue({ success: true, data: transformed });

    render(<ProjectWorkspace />);
    fireEvent.click(screen.getByTestId('start-demo'));
    await waitFor(() => expect(screen.getByTestId('document-canvas')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('canvas-block-blk-2'));
    await waitFor(() => expect(screen.getByTestId('inline-command-menu')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('command-to_table'));
    await waitFor(() =>
      expect(apiMocks.transformWorkspaceBlock).toHaveBeenCalledWith('ws-1', 'blk-2', 'to_table'),
    );
    await waitFor(() => expect(screen.getByText('사업 기간')).toBeInTheDocument());
    expect(screen.getByText('500만원')).toBeInTheDocument();
  });

  it('surfaces transform errors without fabricating a result', async () => {
    apiMocks.createDemoWorkspace.mockResolvedValue({
      success: true,
      data: workspaceFixture({ status: 'generated', document: DOCUMENT }),
    });
    apiMocks.transformWorkspaceBlock.mockRejectedValue(new Error('표로 변환할 항목 구조를 찾지 못했습니다.'));

    render(<ProjectWorkspace />);
    fireEvent.click(screen.getByTestId('start-demo'));
    await waitFor(() => expect(screen.getByTestId('document-canvas')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('canvas-block-blk-2'));
    await waitFor(() => expect(screen.getByTestId('inline-command-menu')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('command-to_table'));

    await waitFor(() =>
      expect(screen.getByTestId('workspace-error')).toHaveTextContent('표로 변환할 항목 구조'),
    );
  });

  it('generates an Excel artifact and shows workflow log plus artifact card', async () => {
    apiMocks.createDemoWorkspace.mockResolvedValue({
      success: true,
      data: workspaceFixture({ status: 'generated', document: DOCUMENT }),
    });
    apiMocks.generateWorkspaceExcelArtifact.mockResolvedValue({ success: true, data: EXCEL_ARTIFACT });

    render(<ProjectWorkspace />);
    fireEvent.click(screen.getByTestId('start-demo'));
    await waitFor(() => expect(screen.getByTestId('document-canvas')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('action-excel-generate'));

    await waitFor(() => expect(apiMocks.generateWorkspaceExcelArtifact).toHaveBeenCalledWith('ws-1'));
    expect(screen.getByTestId('artifact-card-excel')).toHaveTextContent('dashboard.xlsx');
    expect(screen.getByTestId('workspace-log')).toHaveTextContent('Excel');
    expect(screen.getByText('최종 제출 전 Excel 셀 값을 확인해 주세요.')).toBeInTheDocument();
  });

  it('syncs an existing Excel artifact and displays the synced status', async () => {
    apiMocks.createDemoWorkspace.mockResolvedValue({
      success: true,
      data: workspaceFixture({
        status: 'generated',
        document: DOCUMENT,
        artifacts: [EXCEL_ARTIFACT],
      } as Partial<DocumentWorkspace>),
    });
    apiMocks.syncWorkspaceArtifact.mockResolvedValue({
      success: true,
      data: {
        ...EXCEL_ARTIFACT,
        sync_state: {
          ...EXCEL_ARTIFACT.sync_state,
          status: 'synced',
          last_synced_at: '2026-07-07T01:00:00Z',
          snapshot: { source: 'user_edit', sheets: { dashboard: [['notice title']] } },
        },
      },
    });

    render(<ProjectWorkspace />);
    fireEvent.click(screen.getByTestId('start-demo'));
    await waitFor(() => expect(screen.getByTestId('artifact-card-excel')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('artifact-sync-artifact-1'));

    await waitFor(() => expect(apiMocks.syncWorkspaceArtifact).toHaveBeenCalledWith('ws-1', 'artifact-1'));
    expect(screen.getByTestId('artifact-card-excel')).toHaveTextContent('저장 동기화됨');
    expect(screen.getByTestId('workspace-log')).toHaveTextContent('동기화');
  });

  it('automatically syncs an opened Excel artifact while the workspace stays active', async () => {
    vi.useFakeTimers();
    const openedArtifact = {
      ...EXCEL_ARTIFACT,
      sync_state: {
        ...EXCEL_ARTIFACT.sync_state,
        status: 'opened',
        last_opened_at: '2026-07-07T01:00:00Z',
      },
    };
    apiMocks.createDemoWorkspace.mockResolvedValue({
      success: true,
      data: workspaceFixture({
        status: 'generated',
        document: DOCUMENT,
        artifacts: [openedArtifact],
      } as Partial<DocumentWorkspace>),
    });
    apiMocks.syncWorkspaceArtifact.mockResolvedValue({
      success: true,
      data: {
        ...openedArtifact,
        sync_state: {
          ...openedArtifact.sync_state,
          status: 'synced',
          last_synced_at: '2026-07-07T01:05:00Z',
          snapshot: { source: 'user_edit', sheets: { dashboard: [['auto synced']] } },
        },
      },
    });

    render(<ProjectWorkspace />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('start-demo'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('artifact-card-excel')).toHaveTextContent('Excel에서 편집 중');
    expect(apiMocks.syncWorkspaceArtifact).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.syncWorkspaceArtifact).toHaveBeenCalledWith('ws-1', 'artifact-1');
    expect(screen.getByTestId('artifact-card-excel')).toHaveTextContent('저장 동기화됨');
    expect(screen.getByTestId('workspace-log')).toHaveTextContent('Excel auto sync');
  });
});
