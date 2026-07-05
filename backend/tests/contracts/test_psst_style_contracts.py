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
    from models.schemas import AnalysisResult  # noqa: E402
    from services.analyzer import build_analysis_result  # noqa: E402
    from services.drafting_service import create_workflow_session, generate_drafts, update_inputs  # noqa: E402
    from services.mock_data import get_mock_result  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    AnalysisResult = None
    build_analysis_result = None
    create_workflow_session = None
    generate_drafts = None
    update_inputs = None
    get_mock_result = None


class PsstStyleContractTests(unittest.TestCase):
    def test_startup_notice_sections_are_tagged_with_psst_axis(self):
        if build_analysis_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        self.assertEqual(result.doc_type, "startup")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
        workflow = generate_drafts(update_inputs(workflow, updates))

        self.assertTrue(all(draft.content_markdown for draft in workflow.draft_sections))
        self.assertTrue(any(draft.psst_axis != "none" for draft in workflow.draft_sections))
        for draft in workflow.draft_sections:
            self.assertIn(draft.psst_axis, {"problem", "solution", "scaleup", "team", "none"})

    def test_non_business_plan_notice_keeps_psst_axis_none(self):
        if build_analysis_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        raw = {
            "doc_type": "scholarship",
            "title": "국가 우수 장학생 선발 안내",
            "organization": "한국장학재단",
            "document_sections": [
                {"title": "신청서", "hint": "신청자 기본 정보", "order": 1},
                {"title": "성적 증명 자료", "hint": "성적 근거 자료", "order": 2},
            ],
        }
        result = build_analysis_result(raw, source_type="text", source_name="scholarship-fixture")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
        workflow = generate_drafts(update_inputs(workflow, updates))

        self.assertTrue(all(draft.psst_axis == "none" for draft in workflow.draft_sections))


if __name__ == "__main__":
    unittest.main()
