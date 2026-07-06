import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from models.schemas import AgencyNoticeBrief  # noqa: E402
    from services.agency_noticeops import create_agency_notice_draft  # noqa: E402
    from services.agency_section_ai import ai_revise_section  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    AgencyNoticeBrief = None
    create_agency_notice_draft = None
    ai_revise_section = None


def _fixture_brief() -> "AgencyNoticeBrief":
    return AgencyNoticeBrief(
        agency_name="가상지역산업진흥원",
        title="2026년 지역 AI 전환 지원사업 참여기업 모집 공고",
        program_purpose="지역 중소기업의 AI 활용 역량을 높인다.",
        budget="총 900,000,000원",
        program_period="2026. 3. 1.부터 2026. 11. 30.까지",
        eligibility_rules="지역 중소기업",
        support_details="AI 진단과 PoC 개발",
        evaluation_criteria="실행 가능성",
        submission_method="온라인 접수",
        legal_basis="지역산업진흥 조례 제12조",
    )


class AgencySectionAiContractTests(unittest.TestCase):
    def test_mock_ai_revise_creates_version_without_inventing_content(self):
        if ai_revise_section is None:
            self.skipTest("pydantic is not installed in this Python environment")

        draft = create_agency_notice_draft(_fixture_brief())
        section = draft.sections[0]
        original_content = section.content_markdown
        version_count = len(draft.versions)

        revised = ai_revise_section(draft.id, section.id, "개조식으로 다듬어 주세요")

        revised_section = next(item for item in revised.sections if item.id == section.id)
        # Mock mode must not fabricate: only whitespace normalization is allowed.
        self.assertEqual(
            "".join(revised_section.content_markdown.split()),
            "".join(original_content.split()),
        )
        self.assertEqual(len(revised.versions), version_count + 1)
        self.assertIn("AI 다듬기", revised.versions[-1].change_summary)
        self.assertEqual(revised.versions[-1].created_by, "ai-assistant")

    def test_ai_revise_rejects_unknown_section(self):
        if ai_revise_section is None:
            self.skipTest("pydantic is not installed in this Python environment")

        draft = create_agency_notice_draft(_fixture_brief())

        with self.assertRaises(Exception) as ctx:
            ai_revise_section(draft.id, "no-such-section")
        self.assertIn("섹션", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
