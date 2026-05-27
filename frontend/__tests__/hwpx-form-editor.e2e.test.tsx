import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HwpxFormEditor } from '@/components/workspace/HwpxFormEditor';
import type { HwpxEditableRegion, HwpxFormSession } from '@/lib/types';

const apiMocks = vi.hoisted(() => ({
  createHwpxFormSession: vi.fn(),
  draftAllHwpxRegions: vi.fn(),
  draftHwpxRegion: vi.fn(),
  exportHwpxFormSession: vi.fn(),
  getHwpxFormSession: vi.fn(),
  previewHwpxRegionDraft: vi.fn(),
  updateHwpxRegion: vi.fn(),
}));

vi.mock('@/lib/api', () => apiMocks);

function region(
  id: string,
  label: string,
  row: number,
  col: number,
  sectionHeading: string,
  placeholderHint: string,
): HwpxEditableRegion {
  return {
    id,
    kind: 'textarea',
    label,
    section_heading: sectionHeading,
    display_order: row,
    page_index: 0,
    bbox: { x: 5, y: 10 + row * 6, width: 90, height: 6 },
    value: '',
    prompt: '',
    placeholder_hint: placeholderHint,
    draft_status: 'empty',
    source_ref: {
      type: 'table_cell',
      section_path: 'Contents/section0.xml',
      table_index: 0,
      row,
      col,
    },
  };
}

function kaistSession(regions: HwpxEditableRegion[]): HwpxFormSession {
  return {
    id: 'hwpx-kaist-e2e',
    source_filename: 'KAIST_OverEdge_창업_아이디어_기술서.hwpx',
    canonical_hwpx_storage_path: null,
    status: 'editing',
    created_at: '2026-05-27T00:00:00Z',
    updated_at: '2026-05-27T00:00:00Z',
    warnings: [],
    pages: [],
    regions,
    analysis: {
      title: 'KAIST OverEdge 창업 아이디어 기술서',
      summary: 'KAIST OverEdge 창업 아이디어 제출 양식',
      stats: { tables: 1 },
      fields: [],
      sections: [],
      attachments: [],
      blocks: [
        {
          id: 'table-0',
          type: 'table',
          role: 'table',
          section_index: 0,
          text: '요약 소개',
          source_ref: { type: 'table', section_path: 'Contents/section0.xml', table_index: 0 },
          rows: [
            [
              {
                id: 'cell-0-0',
                text: '요약 소개 (전체 1p 이내 작성)',
                row_span: 1,
                col_span: 2,
                background: '#9CA3AF',
                align: 'center',
                vertical_align: 'middle',
                style: { minHeight: 32, bold: true },
              },
            ],
            [
              {
                id: 'cell-1-0',
                text: '1. Problem(풀고자 하는 문제)*250자 이내 작성',
                row_span: 1,
                col_span: 1,
                width: 38,
                background: '#F3F4F6',
              },
              {
                id: 'cell-1-1',
                text: '*시장 현황 및 문제점',
                row_span: 1,
                col_span: 1,
                width: 62,
              },
            ],
            [
              {
                id: 'cell-2-0',
                text: '2. Solution(정의한 문제에 대한 나의 솔루션)*250자 이내 작성',
                row_span: 1,
                col_span: 1,
                width: 38,
                background: '#F3F4F6',
              },
              {
                id: 'cell-2-1',
                text: '*제품 차별성 중심 작성',
                row_span: 1,
                col_span: 1,
                width: 62,
              },
            ],
            [
              {
                id: 'cell-3-0',
                text: '3. AI 활용 역량(AI 도메인 전문성 및 활용 계획)',
                row_span: 1,
                col_span: 1,
                width: 38,
                background: '#F3F4F6',
              },
              {
                id: 'cell-3-1',
                text: '*AI 활용 경험과 계획',
                row_span: 1,
                col_span: 1,
                width: 62,
              },
            ],
          ],
        },
      ],
    },
  };
}

describe('HWPX KAIST form workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:hwpx-e2e'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('uploads a KAIST-style HWPX form, drafts all fields, reviews AI-filled items, and downloads HWPX', async () => {
    const user = userEvent.setup();
    const initialRegions = [
      region('problem', '1. Problem(풀고자 하는 문제)', 1, 1, '요약 소개 (전체 1p 이내 작성)', '*시장 현황 및 문제점'),
      region('solution', '2. Solution(정의한 문제에 대한 나의 솔루션)', 2, 1, '요약 소개 (전체 1p 이내 작성)', '*제품 차별성 중심 작성'),
      region('ai-capability', '3. AI 활용 역량(AI 도메인 전문성 및 활용 계획)', 3, 1, '요약 소개 (전체 1p 이내 작성)', '*AI 활용 경험과 계획'),
    ];
    let currentSession = kaistSession(initialRegions);
    const draftedSession = kaistSession(
      initialRegions.map((item) => ({
        ...item,
        value:
          item.id === 'problem'
            ? '의료 AI 문서 작성 현장에서는 HWPX 양식의 반복 입력과 서식 보존이 병목으로 작용한다.'
            : item.id === 'solution'
              ? 'DockLive는 원본 HWPX 표 구조를 유지한 채 사용자의 요청을 각 작성 칸에 맞춰 자동 반영한다.'
              : '팀은 LLM 프롬프트 설계와 HWPX 구조 분석을 결합해 제출 문서 자동화 역량을 고도화한다.',
        draft_status: 'drafted',
      })),
    );

    apiMocks.createHwpxFormSession.mockResolvedValue({ success: true, data: currentSession });
    apiMocks.getHwpxFormSession.mockRejectedValue(new Error('no saved session'));
    apiMocks.updateHwpxRegion.mockImplementation(async (_sessionId, regionId, payload) => {
      currentSession = {
        ...currentSession,
        regions: currentSession.regions.map((item) =>
          item.id === regionId ? { ...item, value: payload.value, prompt: payload.prompt ?? item.prompt } : item,
        ),
      };
      return { success: true, data: currentSession };
    });
    apiMocks.draftAllHwpxRegions.mockImplementation(async () => {
      currentSession = draftedSession;
      return { success: true, data: draftedSession };
    });
    apiMocks.exportHwpxFormSession.mockResolvedValue({
      success: true,
      filename: 'KAIST_OverEdge_완성본.hwpx',
      content_type: 'application/vnd.hancom.hwpx',
      content: Buffer.from('PK fake hwpx package').toString('base64'),
      encoding: 'base64',
      warnings: [],
      validation_summary: { validation_passed: true, structure_preserved: true },
    });

    render(<HwpxFormEditor />);

    await user.upload(
      screen.getByTestId('hwpx-file-input'),
      new File(['fake hwpx bytes'], 'KAIST_OverEdge_창업_아이디어_기술서.hwpx', {
        type: 'application/vnd.hancom.hwpx',
      }),
    );

    expect((await screen.findAllByText('KAIST_OverEdge_창업_아이디어_기술서.hwpx')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1. Problem(풀고자 하는 문제)').length).toBeGreaterThanOrEqual(1);

    await user.type(
      screen.getByLabelText('전체 요구사항'),
      'DockLive 서비스의 HWPX 원본 서식 보존 자동완성 방향으로 작성해줘.',
    );
    await user.click(screen.getByTestId('hwpx-draft-all-button'));

    await waitFor(() => expect(apiMocks.draftAllHwpxRegions).toHaveBeenCalledTimes(1));
    expect(
      (await screen.findAllByText('의료 AI 문서 작성 현장에서는 HWPX 양식의 반복 입력과 서식 보존이 병목으로 작용한다.')).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI 3').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByTestId('review-filter-drafted'));
    expect(screen.getAllByText('AI 작성').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByTestId('hwpx-export-button'));

    await waitFor(() => expect(apiMocks.exportHwpxFormSession).toHaveBeenCalledWith('hwpx-kaist-e2e'));
    expect(await screen.findByText('최종 HWPX가 생성되었습니다. 내용을 더 고치면 다시 생성할 수 있습니다.')).toBeInTheDocument();
  });

  it('shows an inline AI proposal and applies it only after approval', async () => {
    const user = userEvent.setup();
    const initialRegions = [
      region('problem', '1. Problem(풀고자 하는 문제)', 1, 1, '요약 소개 (전체 1p 이내 작성)', '*시장 현황 및 문제점'),
      region('solution', '2. Solution(정의한 문제에 대한 나의 솔루션)', 2, 1, '요약 소개 (전체 1p 이내 작성)', '*제품 차별성 중심 작성'),
    ];
    let currentSession = kaistSession(initialRegions);
    const proposalText = 'HWPX 기반 문서 작성 과정은 원본 표 구조를 유지하면서도 반복 입력을 줄여야 한다.';

    apiMocks.createHwpxFormSession.mockResolvedValue({ success: true, data: currentSession });
    apiMocks.getHwpxFormSession.mockRejectedValue(new Error('no saved session'));
    apiMocks.previewHwpxRegionDraft.mockResolvedValue({
      success: true,
      region_id: 'problem',
      content: proposalText,
      prompt: '1. Problem(풀고자 하는 문제) 항목을 제출용 문장으로 작성해줘.',
    });
    apiMocks.updateHwpxRegion.mockImplementation(async (_sessionId, regionId, payload) => {
      currentSession = {
        ...currentSession,
        regions: currentSession.regions.map((item) =>
          item.id === regionId
            ? { ...item, value: payload.value, prompt: payload.prompt ?? item.prompt, draft_status: payload.draftStatus ?? 'revised' }
            : item,
        ),
      };
      return { success: true, data: currentSession };
    });

    render(<HwpxFormEditor />);

    await user.upload(
      screen.getByTestId('hwpx-file-input'),
      new File(['fake hwpx bytes'], 'KAIST_OverEdge_창업_아이디어_기술서.hwpx', {
        type: 'application/vnd.hancom.hwpx',
      }),
    );

    await user.click(screen.getByTestId('inline-ai-write'));

    expect(await screen.findByTestId('inline-ai-proposal')).toBeInTheDocument();
    expect(screen.getAllByText(proposalText).length).toBeGreaterThanOrEqual(1);
    expect(apiMocks.updateHwpxRegion).not.toHaveBeenCalled();

    await user.click(screen.getAllByText('적용')[0]);

    await waitFor(() => expect(apiMocks.updateHwpxRegion).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateHwpxRegion.mock.calls[0][2]).toMatchObject({
      value: proposalText,
      draftStatus: 'drafted',
    });
    expect(screen.getAllByText('AI 1').length).toBeGreaterThanOrEqual(1);
  });
});
