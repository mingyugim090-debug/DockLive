import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgencyStudio } from '@/components/agency/AgencyStudio';
import type { AgencyNoticeDraft } from '@/lib/types';

const apiMocks = vi.hoisted(() => ({
  listIrisNotices: vi.fn(),
  getIrisNoticeDetail: vi.fn(),
  saveIrisNoticeAsReference: vi.fn(),
  createAgencyNoticeDraft: vi.fn(),
  updateAgencyNoticeSection: vi.fn(),
  aiReviseAgencyNoticeSection: vi.fn(),
  addAgencyNoticeComment: vi.fn(),
  transitionAgencyNoticeDraft: vi.fn(),
  exportAgencyNoticeDraft: vi.fn(),
  recallAgencyPriorNotices: vi.fn(),
}));

vi.mock('@/lib/api', () => apiMocks);

function makeDraft(overrides: Partial<AgencyNoticeDraft> = {}): AgencyNoticeDraft {
  const draft: AgencyNoticeDraft = {
    id: 'agency-fixture',
    organization_id: '00000000-0000-4000-8000-000000000001',
    title: '2026년 지역 AI 전환 지원사업 참여기업 모집 공고',
    status: 'draft',
    brief: {
      organization_id: '00000000-0000-4000-8000-000000000001',
      author_id: 'fixture-staff',
      author_name: '사업 담당자',
      agency_name: '가상산업진흥원',
      title: '2026년 지역 AI 전환 지원사업 참여기업 모집 공고',
      program_type: 'support_program',
      program_purpose: '지역 중소기업의 AI 활용 역량을 높입니다.',
      budget: '총 900,000,000원',
      program_period: '2026. 3. 1. ~ 2026. 11. 30.',
      eligibility_rules: '지역 중소기업',
      support_details: 'AI 진단과 PoC 개발',
      evaluation_criteria: '수행 가능성',
      submission_method: '온라인 접수',
      required_documents: ['참여신청서'],
      contact: 'AI전환팀',
      legal_basis: '지역산업진흥 조례',
      privacy_policy: '개인정보 수집 및 이용 동의',
      fair_competition_clause: '허위자료 제출 시 선정 취소',
      appeal_process: '',
      references: [],
    },
    sections: [
      {
        id: 'overview',
        title: '사업개요',
        content_markdown: '### 사업개요\n- 사업 목적: 지역 중소기업의 AI 활용 역량을 높입니다.',
        order: 1,
        source_evidence_ids: ['brief:program_purpose'],
        source_traces: [
          {
            evidence_id: 'brief:program_purpose',
            label: '사업 목적',
            quote: '지역 중소기업의 AI 활용 역량을 높입니다.',
            source_type: 'brief',
            field_name: 'program_purpose',
            reference_id: null,
            confidence: 0.95,
          },
        ],
        confirmation_required: [],
        updated_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'eligibility',
        title: '신청자격',
        content_markdown: '### 신청자격\n- 신청 자격: 지역 중소기업',
        order: 2,
        source_evidence_ids: ['brief:eligibility_rules'],
        source_traces: [
          {
            evidence_id: 'brief:eligibility_rules',
            label: '신청 자격',
            quote: '지역 중소기업',
            source_type: 'brief',
            field_name: 'eligibility_rules',
            reference_id: null,
            confidence: 0.95,
          },
        ],
        confirmation_required: ['신청자격의 세부 제한을 확인해 주세요.'],
        updated_at: '2026-07-01T00:00:00Z',
      },
    ],
    mandatory_clause_checks: [
      {
        id: 'legal_basis',
        label: '법적 근거',
        status: 'satisfied',
        note: '법적 근거가 확인되었습니다.',
        source_evidence_ids: ['brief:legal_basis'],
        source_traces: [],
        confirmation_required: [],
      },
    ],
    source_evidence: [],
    confirmation_required: [],
    versions: [
      {
        id: 'version-1',
        draft_id: 'agency-fixture',
        version_number: 1,
        created_by: 'fixture-staff',
        change_summary: '기관 공고 초안이 생성되었습니다.',
        sections_snapshot: [],
        mandatory_clause_checks: [],
        created_at: '2026-07-01T00:00:00Z',
      },
    ],
    approval_workflow: {
      status: 'draft',
      current_step_order: 1,
      steps: [
        {
          id: 'step-1',
          draft_id: 'agency-fixture',
          step_order: 1,
          title: '담당자 검토',
          role: 'staff',
          assigned_to: null,
          status: 'active',
          decided_at: null,
          decision_note: '',
        },
      ],
    },
    comments: [],
    audit_events: [],
    current_version_id: 'version-1',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
  return { ...draft, ...overrides };
}

describe('AgencyStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listIrisNotices.mockResolvedValue({
      success: true,
      data: { items: [], page: 1, total_pages: 0, total_count: 0, has_more: false },
    });
  });

  it('starts with notice type selection before loading IRIS references', () => {
    render(<AgencyStudio />);

    expect(screen.getByTestId('studio-stage-type')).toBeInTheDocument();
    expect(screen.getByTestId('studio-recipe-lab_recruitment')).toBeInTheDocument();
    expect(screen.queryByTestId('iris-notice-feed')).not.toBeInTheDocument();
    expect(screen.getByTestId('studio-stage-edit')).toBeDisabled();
    expect(apiMocks.listIrisNotices).not.toHaveBeenCalled();
  });

  it('shows lab recruitment fields and hides support-program-only fields', async () => {
    render(<AgencyStudio />);

    fireEvent.click(screen.getByTestId('studio-recipe-lab_recruitment'));
    fireEvent.click(screen.getByTestId('studio-direction-friendly_recruitment'));

    expect(await screen.findByTestId('brief-field-lab_name')).toBeInTheDocument();
    expect(screen.getByTestId('brief-field-target_applicants')).toBeInTheDocument();
    expect(screen.queryByTestId('brief-field-budget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('brief-field-legal_basis')).not.toBeInTheDocument();
    expect(screen.queryByTestId('brief-field-appeal_process')).not.toBeInTheDocument();
  });

  it('shows structure chips and loads IRIS references after type and direction', async () => {
    render(<AgencyStudio />);

    fireEvent.click(screen.getByTestId('studio-recipe-lab_recruitment'));
    fireEvent.click(screen.getByTestId('studio-direction-friendly_recruitment'));
    fireEvent.click(screen.getByTestId('studio-next-references'));

    expect(await screen.findByTestId('iris-notice-feed')).toBeInTheDocument();
    expect(screen.getByTestId('iris-structure-chip-eligibilityTable')).toBeInTheDocument();
    expect(screen.getByTestId('iris-structure-chip-scheduleTable')).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.listIrisNotices).toHaveBeenCalledWith(1, expect.stringContaining('연구실'), 'ancmIng'));
  });

  it('generates a draft from the brief and lands in the document editor', async () => {
    const fixtureDraft = makeDraft();
    apiMocks.createAgencyNoticeDraft.mockResolvedValue({ success: true, data: fixtureDraft });
    render(<AgencyStudio />);

    fireEvent.click(screen.getByTestId('studio-recipe-rnd_support'));
    fireEvent.click(screen.getByTestId('studio-direction-iris_official'));
    fireEvent.change(screen.getByTestId('brief-field-title'), { target: { value: '2026 테스트 공고' } });
    fireEvent.click(screen.getByTestId('brief-generate'));

    await waitFor(() => expect(screen.getByTestId('editor-paper')).toBeInTheDocument());
    expect(apiMocks.createAgencyNoticeDraft).toHaveBeenCalled();
    expect(screen.getByText('사업개요')).toBeInTheDocument();
  });

  it('renders recipe blocks as tables and notice boxes in the paper preview', async () => {
    const labDraft = makeDraft({
      title: 'CVR 연구실 학부연구생 모집공고',
      blocks: [
        {
          id: 'overview',
          type: 'infoTable',
          title: '모집 개요',
          role: 'infoTable',
          body: '',
          rows: [
            ['항목', '내용'],
            ['연구실/팀', 'CVR 연구실'],
            ['모집 대상', '컴퓨터공학 전공 학부생'],
          ],
          source_evidence_ids: [],
          source_traces: [],
          confirmation_required: [],
        },
        {
          id: 'lab-intro',
          type: 'noticeBox',
          title: '연구실 소개',
          role: 'noticeBox',
          body: '컴퓨터 비전과 로보틱스 지능을 연구합니다.',
          rows: [],
          source_evidence_ids: [],
          source_traces: [],
          confirmation_required: [],
        },
      ],
    } as Partial<AgencyNoticeDraft>);

    render(<AgencyStudio initialDraft={labDraft} />);

    expect(await screen.findByTestId('editor-block-overview')).toBeInTheDocument();
    expect(screen.getByText('연구실/팀')).toBeInTheDocument();
    expect(screen.getByText('CVR 연구실')).toBeInTheDocument();
    expect(screen.getByTestId('editor-block-lab-intro')).toHaveTextContent('컴퓨터 비전과 로보틱스 지능을 연구합니다.');
  });

  it('lets the user click a section on the paper, edit it, and save a new version', async () => {
    const fixtureDraft = makeDraft();
    const updated = {
      ...fixtureDraft,
      sections: fixtureDraft.sections.map((section) =>
        section.id === 'overview' ? { ...section, content_markdown: '### 사업개요\n- 수정된 목적' } : section,
      ),
    };
    apiMocks.updateAgencyNoticeSection.mockResolvedValue({ success: true, data: updated });

    render(<AgencyStudio initialDraft={fixtureDraft} />);

    fireEvent.click(screen.getByTestId('editor-section-overview'));
    const textarea = await screen.findByTestId('editor-section-textarea');
    fireEvent.change(textarea, { target: { value: '### 사업개요\n- 수정된 목적' } });
    fireEvent.click(screen.getByTestId('editor-save-section'));

    await waitFor(() => {
      expect(apiMocks.updateAgencyNoticeSection).toHaveBeenCalledWith('agency-fixture', 'overview', '### 사업개요\n- 수정된 목적');
    });
    await waitFor(() => expect(screen.getByText('수정된 목적')).toBeInTheDocument());
  });

  it('shows the source trace panel for the selected section', async () => {
    render(<AgencyStudio initialDraft={makeDraft()} />);

    fireEvent.click(screen.getByTestId('editor-section-eligibility'));
    await waitFor(() => expect(screen.getByTestId('editor-source-traces')).toBeInTheDocument());
    expect(screen.getByText('지역 중소기업')).toBeInTheDocument();
    expect(screen.getByText(/신청자격의 세부 제한/)).toBeInTheDocument();
  });

  it('runs AI revise from the section edit toolbar', async () => {
    const fixtureDraft = makeDraft();
    apiMocks.updateAgencyNoticeSection.mockResolvedValue({ success: true, data: fixtureDraft });
    apiMocks.aiReviseAgencyNoticeSection.mockResolvedValue({ success: true, data: fixtureDraft });

    render(<AgencyStudio initialDraft={fixtureDraft} />);

    fireEvent.click(screen.getByTestId('editor-section-overview'));
    await screen.findByTestId('editor-section-textarea');
    fireEvent.click(screen.getByTestId('editor-ai-revise'));

    await waitFor(() => {
      expect(apiMocks.aiReviseAgencyNoticeSection).toHaveBeenCalledWith('agency-fixture', 'overview');
    });
  });

  it('keeps approval actions state-aware in the review stage', async () => {
    render(<AgencyStudio initialDraft={makeDraft()} />);

    fireEvent.click(screen.getByTestId('studio-stage-review'));
    await waitFor(() => expect(screen.getByTestId('approval-submit-review')).toBeInTheDocument());

    expect(screen.getByTestId('approval-submit-review')).not.toBeDisabled();
    expect(screen.getByTestId('approval-approve')).toBeDisabled();
  });
});
