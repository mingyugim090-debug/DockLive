import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AgencyControlRoom } from '@/components/agency/AgencyControlRoom';
import type { AgencyNoticeDraft } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  addAgencyNoticeComment: vi.fn(),
  createAgencyNoticeDraft: vi.fn(),
  createAgencyPriorNotice: vi.fn(),
  createClauseLibraryEntry: vi.fn(),
  exportAgencyNoticeDraft: vi.fn(),
  listClauseLibrary: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'default-legal_basis',
        organization_id: '00000000-0000-4000-8000-000000000001',
        clause_type: 'legal_basis',
        label: '법적 근거',
        required_for_program_types: ['support_program'],
        template_text: '기관 기준 문구 확인 필요',
        source: 'org_default',
        active: true,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      },
    ],
  }),
  recallAgencyPriorNotices: vi.fn().mockResolvedValue({ success: true, data: [] }),
  transitionAgencyNoticeDraft: vi.fn(),
  updateAgencyNoticeSection: vi.fn(),
}));

const initialDraft: AgencyNoticeDraft = {
  id: 'agency-fixture',
  organization_id: '00000000-0000-4000-8000-000000000001',
  title: '2026년 지역 AI 전환 지원사업 참여기업 모집 공고',
  status: 'draft',
  brief: {
    organization_id: '00000000-0000-4000-8000-000000000001',
    author_id: 'fixture-staff',
    author_name: '사업 담당자',
    agency_name: '가상지역산업진흥원',
    title: '2026년 지역 AI 전환 지원사업 참여기업 모집 공고',
    program_type: 'support_program',
    program_purpose: '지역 중소기업의 AI 활용 역량을 높인다.',
    budget: '총 900,000,000원',
    program_period: '2026. 3. 1.부터 2026. 11. 30.까지',
    eligibility_rules: '지역 중소기업',
    support_details: 'AI 진단과 PoC 개발',
    evaluation_criteria: '실행 가능성',
    submission_method: '온라인 접수',
    required_documents: ['참여신청서'],
    contact: 'AI전환팀',
    legal_basis: '지역산업진흥 조례 제12조',
    privacy_policy: '개인정보 수집 및 이용 동의',
    fair_competition_clause: '허위자료 제출 시 선정 취소',
    appeal_process: '',
    references: [],
  },
  sections: [
    {
      id: 'overview',
      title: '사업개요',
      content_markdown: '### 사업개요\n- 사업 목적: 지역 중소기업의 AI 활용 역량을 높인다.',
      order: 1,
      source_evidence_ids: ['brief:program_purpose'],
      source_traces: [
        {
          evidence_id: 'brief:program_purpose',
          label: '사업 목적',
          quote: '지역 중소기업의 AI 활용 역량을 높인다.',
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
      change_summary: '기관 공고 초안을 생성했습니다.',
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

describe('Agency NoticeOps control room', () => {
  it('renders the Ver2 approval control room entry surface', () => {
    render(<AgencyControlRoom />);

    expect(screen.getByRole('heading', { name: '승인 컨트롤룸' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '초안 생성' })).toBeInTheDocument();
    expect(screen.getByText('과거 공고 Recall')).toBeInTheDocument();
    expect(screen.getByText('사업 브리프')).toBeInTheDocument();
    expect(screen.getAllByText('필수 조항').length).toBeGreaterThan(0);
    expect(screen.getByText('근거 추적')).toBeInTheDocument();
    expect(screen.getByText('버전 기록')).toBeInTheDocument();
    expect(screen.getByText('승인 단계')).toBeInTheDocument();
  });

  it('shows source trace for the selected section', () => {
    render(<AgencyControlRoom initialDraft={initialDraft} />);

    expect(screen.getByText('지역 중소기업의 AI 활용 역량을 높인다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /신청자격/ }));

    expect(screen.getAllByText('신청 자격').length).toBeGreaterThan(0);
    expect(screen.getAllByText('지역 중소기업').length).toBeGreaterThan(0);
    expect(screen.getByText('신청자격의 세부 제한을 확인해 주세요.')).toBeInTheDocument();
  });

  it('keeps approval actions state-aware', () => {
    render(<AgencyControlRoom initialDraft={initialDraft} />);

    expect(screen.getByRole('button', { name: '검토 요청' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '승인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '수정 요청' })).toBeDisabled();
  });
});
