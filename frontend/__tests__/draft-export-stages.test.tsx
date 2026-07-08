import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftStage } from '@/components/pipeline/DraftStage';
import { ExportStage } from '@/components/pipeline/ExportStage';
import type { AnalysisResult, DraftSection, WorkflowSession } from '@/lib/types';

const api = vi.hoisted(() => ({
  createDraftStream: vi.fn(),
  getWorkflow: vi.fn(),
  restoreWorkflow: vi.fn(),
  reviseDraft: vi.fn(),
  saveDraftFeedback: vi.fn(),
  confirmWorkflow: vi.fn(),
  exportWorkflowHtml: vi.fn(),
  exportWorkflowHwpx: vi.fn(),
  exportWorkflowPdf: vi.fn(),
  finalizeWorkflow: vi.fn(),
  getProjectIntegrity: vi.fn(),
}));

vi.mock('@/lib/api', () => api);
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function analysis(partial: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    id: 'wf-1',
    source_type: 'text',
    summary: '요약',
    doc_type: 'business_plan',
    applicant_kind: 'company',
    title: '스마트상점 지원사업',
    organization: '소진공',
    timeline: [],
    checklist: [],
    document_template: [],
    analyzed_at: '2026-07-08',
    eligibility: ['소상공인'],
    evaluation_criteria: [],
    rubric: {
      criteria: [{ name: '디지털 전환 필요성', weight: 40, description: '', source_ref: '' }],
      total_weight: 100,
      source: 'notice',
    },
    benefits: [],
    cautions: [],
    uncertain_fields: [],
    source_evidence: [{ field: '지원대상', quote: '소상공인 대상', confidence: 0.9 }],
    missing_questions: [],
    support_programs: [],
    ...partial,
  } as AnalysisResult;
}

function section(partial: Partial<DraftSection> = {}): DraftSection {
  return {
    id: 'ds-1',
    section_id: 'sec-1',
    title: '사업 개요',
    content_markdown: '초안 내용입니다.',
    purpose: '',
    related_criteria: ['디지털 전환 필요성'],
    source_evidence_ids: [],
    revision_notes: [],
    status: 'drafted',
    needs_confirmation: [],
    confirmation_required: [],
    user_feedback: '',
    psst_axis: 'none',
    ...partial,
  };
}

function workflow(partial: Partial<WorkflowSession> = {}): WorkflowSession {
  return {
    id: 'wf-1',
    analysis: analysis(),
    status: 'drafting',
    user_inputs: [
      { id: 'q1', label: '예산 규모', field_type: 'text', required: true, value: '' },
    ],
    draft_sections: [section()],
    confirmed_items: [],
    created_at: '2026-07-08',
    updated_at: '2026-07-08',
    ...partial,
  } as WorkflowSession;
}

describe('DraftStage (5단계 2패널)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders evidence panel on the left and section cards with criteria chips', () => {
    render(<DraftStage workflow={workflow()} onWorkflow={vi.fn()} onGoExport={vi.fn()} />);
    expect(screen.getByTestId('evidence-panel')).toBeInTheDocument();
    expect(screen.getByText('40점')).toBeInTheDocument();
    expect(screen.getByTestId('draft-section-sec-1')).toBeInTheDocument();
    expect(screen.getByTestId('chip-crit-sec-1-디지털 전환 필요성')).toBeInTheDocument();
    // 미입력 배지 (내 답변 비어 있음)
    expect(screen.getByText('미입력')).toBeInTheDocument();
  });

  it('persists direct edits through restoreWorkflow', async () => {
    const updated = workflow();
    api.restoreWorkflow.mockResolvedValue({ success: true, data: updated });
    const onWorkflow = vi.fn();
    render(<DraftStage workflow={workflow()} onWorkflow={onWorkflow} onGoExport={vi.fn()} />);

    fireEvent.click(screen.getByTestId('section-edit-sec-1'));
    fireEvent.change(screen.getByTestId('section-editor-sec-1'), { target: { value: '직접 수정한 내용' } });
    fireEvent.click(screen.getByTestId('section-save-sec-1'));

    await waitFor(() => expect(api.restoreWorkflow).toHaveBeenCalled());
    const [, payload] = api.restoreWorkflow.mock.calls[0];
    expect(payload.draft_sections[0].content_markdown).toBe('직접 수정한 내용');
    expect(payload.draft_sections[0].status).toBe('revised');
    expect(onWorkflow).toHaveBeenCalledWith(updated);
  });

  it('shows the draft start button when there are no sections yet', () => {
    render(
      <DraftStage workflow={workflow({ draft_sections: [] })} onWorkflow={vi.fn()} onGoExport={vi.fn()} />,
    );
    expect(screen.getByTestId('draft-start')).toBeInTheDocument();
  });
});

describe('ExportStage (6단계 무결성+내보내기)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows 검사 준비 중 fallback and keeps downloads enabled when integrity API is unavailable', async () => {
    api.getProjectIntegrity.mockResolvedValue(null);
    render(
      <ExportStage
        workflow={workflow()}
        projectId="wf-1"
        onWorkflow={vi.fn()}
        onVerified={vi.fn()}
        onExported={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getAllByText('검사 준비 중').length).toBeGreaterThan(0));
    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.getByTestId('export-hwpx')).not.toBeDisabled();
  });

  it('blocks downloads until confirmation items are checked', async () => {
    api.getProjectIntegrity.mockResolvedValue(null);
    const confirmedWorkflow = workflow({ confirmed_items: ['지원 한도 500만 원'] });
    api.confirmWorkflow.mockResolvedValue({ success: true, data: confirmedWorkflow });
    const onWorkflow = vi.fn();
    render(
      <ExportStage
        workflow={workflow({
          draft_sections: [section({ confirmation_required: ['지원 한도 500만 원'] })],
        })}
        projectId="wf-1"
        onWorkflow={onWorkflow}
        onVerified={vi.fn()}
        onExported={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('confirmation-card')).toBeInTheDocument());
    expect(screen.getByTestId('export-hwpx')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('지원 한도 500만 원'));
    fireEvent.click(screen.getByTestId('confirm-items'));
    await waitFor(() => expect(api.confirmWorkflow).toHaveBeenCalledWith('wf-1', ['지원 한도 500만 원']));
    expect(onWorkflow).toHaveBeenCalledWith(confirmedWorkflow);
  });

  it('gates default download on failed integrity and offers _검증전 bypass', async () => {
    api.getProjectIntegrity.mockResolvedValue({
      passed: false,
      checks: [
        { code: 'C1', label: '필수 칸', passed: false, section_id: 'sec-1' },
        { code: 'C2', label: '숫자 일치', passed: true },
      ],
    });
    render(
      <ExportStage
        workflow={workflow()}
        projectId="wf-1"
        onWorkflow={vi.fn()}
        onVerified={vi.fn()}
        onExported={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('보완 필요')).toBeInTheDocument());
    expect(screen.getByTestId('export-hwpx')).toBeDisabled();
    expect(screen.getByTestId('export-bypass')).toBeInTheDocument();
    // 실패 항목 → 5단계 슬롯 점프 링크
    expect(screen.getByText('실패 — 해당 칸으로').closest('a')).toHaveAttribute(
      'href',
      '/app/p/wf-1/5-draft#section-sec-1',
    );
  });

  it('marks verified when integrity passes', async () => {
    api.getProjectIntegrity.mockResolvedValue({ passed: true, checks: [{ code: 'C1', label: 'ok', passed: true }] });
    const onVerified = vi.fn();
    render(
      <ExportStage
        workflow={workflow()}
        projectId="wf-1"
        onWorkflow={vi.fn()}
        onVerified={onVerified}
        onExported={vi.fn()}
      />,
    );
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(screen.getByText('전체 통과')).toBeInTheDocument();
    expect(screen.getByTestId('export-hwpx')).not.toBeDisabled();
  });

  it('finalizes before first export and renames bypass downloads', async () => {
    api.getProjectIntegrity.mockResolvedValue(null);
    const finalized = workflow({ final_document: { title: 't', content_markdown: 'c', created_at: 'now' } });
    api.finalizeWorkflow.mockResolvedValue({ success: true, data: finalized });
    api.exportWorkflowHwpx.mockResolvedValue({
      success: true,
      filename: 'plan.hwpx',
      content_type: 'application/octet-stream',
      content: btoa('hwpx-bytes'),
      encoding: 'base64',
      validation_summary: {},
    });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    const onExported = vi.fn();
    render(
      <ExportStage
        workflow={workflow()}
        projectId="wf-1"
        onWorkflow={vi.fn()}
        onVerified={vi.fn()}
        onExported={onExported}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('export-hwpx')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('export-hwpx'));
    await waitFor(() => expect(api.finalizeWorkflow).toHaveBeenCalledWith('wf-1'));
    await waitFor(() => expect(api.exportWorkflowHwpx).toHaveBeenCalledWith('wf-1'));
    await waitFor(() => expect(onExported).toHaveBeenCalled());
  });
});
