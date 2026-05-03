import json
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from models.schemas import AnalysisResult  # noqa: E402
    from services.analyzer import build_analysis_result  # noqa: E402
    from services.drafting_service import confirm_workflow, create_workflow_session, finalize_document, generate_drafts, update_inputs  # noqa: E402
    from services.mock_data import get_mock_result  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    AnalysisResult = None
    build_analysis_result = None
    confirm_workflow = None
    create_workflow_session = None
    finalize_document = None
    generate_drafts = None
    get_mock_result = None
    update_inputs = None


class AgentMvpContractTests(unittest.TestCase):
    def test_fixture_metadata_is_complete(self):
        fixture_dir = ROOT / "docs" / "fixtures"
        fixtures = sorted(fixture_dir.glob("*.json"))
        self.assertEqual(len(fixtures), 5)

        for path in fixtures:
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertTrue(data["announcement_text"])
            self.assertIn("expected", data)
            self.assertIn("fail_if", data)
            self.assertIn("uncertainty_rule", data)

    def test_mock_analysis_result_validates_with_required_contracts(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        restored = AnalysisResult(**result.model_dump(mode="json"))

        self.assertEqual(restored.doc_type, "startup")
        self.assertTrue(restored.title)
        self.assertTrue(restored.organization)
        self.assertGreaterEqual(len(restored.checklist), 1)
        self.assertGreaterEqual(len(restored.document_template), 1)
        self.assertGreaterEqual(len(restored.source_evidence), 1)

    def test_mock_workflow_reaches_final_document(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}

        workflow = update_inputs(workflow, updates)
        workflow = generate_drafts(workflow)
        self.assertEqual(workflow.status, "reviewing")
        self.assertTrue(all(draft.content_markdown for draft in workflow.draft_sections))
        self.assertTrue(all(draft.confirmation_required is not None for draft in workflow.draft_sections))

        workflow = confirm_workflow(workflow)
        workflow = finalize_document(workflow)
        self.assertEqual(workflow.status, "finalized")
        self.assertIsNotNone(workflow.final_document)
        self.assertIn("제출 전 확인 필요", workflow.final_document.content_markdown)


if __name__ == "__main__":
    unittest.main()
