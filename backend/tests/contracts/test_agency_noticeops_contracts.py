import json
import os
import sys
import unittest
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from core.errors import AnalysisError  # noqa: E402
    from models.schemas import (  # noqa: E402
        AgencyNoticeBrief,
        AgencyPriorNoticeCreateRequest,
        AgencyPriorNoticeRecallRequest,
        ClauseLibraryEntryRequest,
    )
    from services.agency_clause_library import create_clause_library_entry  # noqa: E402
    from services.agency_noticeops import (  # noqa: E402
        add_agency_notice_comment,
        create_agency_notice_draft,
        list_agency_notice_drafts,
        transition_agency_notice,
        update_agency_notice_section,
    )
    from services.prior_notice_recall import create_prior_notice, recall_prior_notices  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover
    if exc.name != "pydantic":
        raise
    AnalysisError = None
    AgencyNoticeBrief = None
    AgencyPriorNoticeCreateRequest = None
    AgencyPriorNoticeRecallRequest = None
    ClauseLibraryEntryRequest = None
    add_agency_notice_comment = None
    create_clause_library_entry = None
    create_agency_notice_draft = None
    create_prior_notice = None
    list_agency_notice_drafts = None
    recall_prior_notices = None
    transition_agency_notice = None
    update_agency_notice_section = None


class AgencyNoticeOpsContractTests(unittest.TestCase):
    def _fixture_brief(self) -> AgencyNoticeBrief:
        fixture_path = ROOT / "docs" / "evaluation" / "agency-fixtures" / "noticeops-support-program-2026.json"
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        return AgencyNoticeBrief.model_validate(fixture["brief"])

    def test_agency_notice_draft_preserves_grounding_and_clause_checks(self):
        if AgencyNoticeBrief is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        draft = create_agency_notice_draft(self._fixture_brief())

        self.assertEqual(draft.status, "draft")
        self.assertEqual(draft.organization_id, "00000000-0000-4000-8000-000000000001")
        section_titles = {section.title for section in draft.sections}
        for title in {"사업개요", "지원내용", "신청자격", "평가기준", "필수 조항 점검"}:
            self.assertIn(title, section_titles)
        clause_labels = {check.label for check in draft.mandatory_clause_checks}
        for label in {"법적 근거", "개인정보 처리방침", "공정경쟁 문구", "이의신청 절차"}:
            self.assertIn(label, clause_labels)
        self.assertNotIn("예산 규모를 확인해 주세요.", draft.confirmation_required)
        self.assertTrue(draft.source_evidence)
        self.assertEqual(len(draft.versions), 1)
        self.assertEqual(draft.current_version_id, draft.versions[0].id)

    def test_version_bound_comments_and_section_updates_are_audited(self):
        if AgencyNoticeBrief is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        draft = create_agency_notice_draft(self._fixture_brief())
        first_version = draft.current_version_id
        updated = update_agency_notice_section(
            draft.id,
            "overview",
            "### 사업개요\n- 사업 목적: 지역 기업 AI 실증 지원\n- 예산 규모: 총 900,000,000원",
            "사업개요 표현을 압축했습니다.",
            "fixture-staff",
        )
        commented = add_agency_notice_comment(
            updated.id,
            "예산 문구는 기준 문서 원문과 다시 대조해 주세요.",
            section_id="overview",
            author_id="fixture-lead",
            author_name="팀장",
        )

        self.assertNotEqual(first_version, updated.current_version_id)
        self.assertEqual(len(updated.versions), 2)
        self.assertEqual(commented.comments[-1].version_id, updated.current_version_id)
        self.assertEqual(commented.comments[-1].section_id, "overview")
        self.assertTrue(any(event.action == "section_updated" for event in commented.audit_events))

    def test_approval_state_machine_blocks_publish_before_approval(self):
        if AgencyNoticeBrief is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        draft = create_agency_notice_draft(self._fixture_brief())
        with self.assertRaises(AnalysisError):
            transition_agency_notice(draft.id, "published", "fixture-staff", "승인 전 게시 시도")

        reviewed = transition_agency_notice(draft.id, "under_review", "fixture-staff", "팀장 검토 요청")
        self.assertEqual(reviewed.status, "under_review")
        approving = transition_agency_notice(reviewed.id, "approving", "fixture-lead", "팀장 승인")
        self.assertEqual(approving.status, "approving")
        approved = transition_agency_notice(approving.id, "approved", "fixture-approver", "기관장 승인")
        self.assertEqual(approved.status, "approved")
        published = transition_agency_notice(approved.id, "published", "fixture-staff", "게시용 문서 확정")
        self.assertEqual(published.status, "published")

    def test_org_scoped_listing_keeps_drafts_separate(self):
        if AgencyNoticeBrief is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        first = self._fixture_brief()
        first.organization_id = "00000000-0000-4000-8000-0000000000aa"
        second = self._fixture_brief()
        second.organization_id = "00000000-0000-4000-8000-0000000000bb"
        alpha = create_agency_notice_draft(first)
        beta = create_agency_notice_draft(second)

        alpha_ids = {draft.id for draft in list_agency_notice_drafts("00000000-0000-4000-8000-0000000000aa")}
        beta_ids = {draft.id for draft in list_agency_notice_drafts("00000000-0000-4000-8000-0000000000bb")}
        self.assertIn(alpha.id, alpha_ids)
        self.assertNotIn(beta.id, alpha_ids)
        self.assertIn(beta.id, beta_ids)

    def test_prior_notice_recall_ranks_similar_notice_first(self):
        if AgencyPriorNoticeCreateRequest is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        org_id = str(uuid4())
        create_prior_notice(
            AgencyPriorNoticeCreateRequest(
                organization_id=org_id,
                title="2025년 지역 AI 전환 지원사업 공고",
                program_type="support_program",
                budget="총 850,000,000원",
                program_period="2025. 3. 1.부터 2025. 11. 30.까지",
                text="지역 중소기업 AI 진단, PoC 개발, 데이터 정비, 전문가 멘토링을 지원한다.",
            )
        )
        create_prior_notice(
            AgencyPriorNoticeCreateRequest(
                organization_id=org_id,
                title="2025년 지역 문화예술 축제 운영 공고",
                program_type="culture_event",
                budget="총 80,000,000원",
                program_period="2025. 5. 1.부터 2025. 8. 31.까지",
                text="지역 예술단체 공연, 전시, 축제 운영비를 지원한다.",
            )
        )

        brief = self._fixture_brief()
        brief.organization_id = org_id
        results = recall_prior_notices(AgencyPriorNoticeRecallRequest(organization_id=org_id, brief=brief))

        self.assertGreaterEqual(len(results), 2)
        self.assertIn("AI 전환", results[0].title)
        self.assertGreater(results[0].similarity, results[1].similarity)

    def test_prior_notice_recall_stays_inside_organization(self):
        if AgencyPriorNoticeCreateRequest is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        org_a = str(uuid4())
        org_b = str(uuid4())
        create_prior_notice(
            AgencyPriorNoticeCreateRequest(
                organization_id=org_a,
                title="타 기관 AI 전환 지원사업 공고",
                text="AI 전환 지원사업 예산과 멘토링을 안내한다.",
            )
        )
        brief = self._fixture_brief()
        brief.organization_id = org_b
        results = recall_prior_notices(AgencyPriorNoticeRecallRequest(organization_id=org_b, brief=brief))

        self.assertEqual(results, [])

    def test_missing_required_clause_blocks_review_submission(self):
        if ClauseLibraryEntryRequest is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        org_id = str(uuid4())
        create_clause_library_entry(
            ClauseLibraryEntryRequest(
                organization_id=org_id,
                clause_type="financial_disclosure",
                label="재정 집행 공개",
                required_for_program_types=["support_program"],
                template_text="",
                source="agency_supplied",
                active=True,
            )
        )
        brief = self._fixture_brief()
        brief.organization_id = org_id
        draft = create_agency_notice_draft(brief)

        missing_labels = {check.label for check in draft.mandatory_clause_checks if check.status == "missing"}
        self.assertIn("재정 집행 공개", missing_labels)
        with self.assertRaises(AnalysisError):
            transition_agency_notice(draft.id, "under_review", "fixture-staff", "팀장 검토 요청")

    def test_confirmation_required_clause_can_enter_review(self):
        if AgencyNoticeBrief is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        brief = self._fixture_brief()
        brief.organization_id = str(uuid4())
        brief.appeal_process = ""
        brief.references = []
        draft = create_agency_notice_draft(brief)
        appeal = next(check for check in draft.mandatory_clause_checks if check.id == "appeal_process")

        self.assertEqual(appeal.status, "needs_confirmation")
        reviewed = transition_agency_notice(draft.id, "under_review", "fixture-staff", "팀장 검토 요청")
        self.assertEqual(reviewed.status, "under_review")

    def test_section_source_traces_are_section_specific(self):
        if AgencyNoticeBrief is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        draft = create_agency_notice_draft(self._fixture_brief())
        overview = next(section for section in draft.sections if section.id == "overview")
        eligibility = next(section for section in draft.sections if section.id == "eligibility")

        self.assertIn("brief:program_purpose", overview.source_evidence_ids)
        self.assertIn("brief:budget", overview.source_evidence_ids)
        self.assertNotIn("brief:eligibility_rules", overview.source_evidence_ids)
        self.assertEqual(eligibility.source_evidence_ids, ["brief:eligibility_rules"])
        self.assertTrue(overview.source_traces)


if __name__ == "__main__":
    unittest.main()
