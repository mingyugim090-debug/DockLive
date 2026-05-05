import json
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
    from core.errors import AnalysisError  # noqa: E402
    from models.schemas import AnalysisResult  # noqa: E402
    from services.ai_provider import provider_name, should_use_mock_ai  # noqa: E402
    from services.analyzer import build_analysis_result  # noqa: E402
    from services.drafting_service import (  # noqa: E402
        build_template_replacements,
        clone_hwpx_template,
        confirm_workflow,
        create_workflow_session,
        finalize_document,
        generate_drafts,
        update_inputs,
    )
    from services.mock_data import get_mock_result  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    AnalysisError = None
    AnalysisResult = None
    provider_name = None
    should_use_mock_ai = None
    build_analysis_result = None
    build_template_replacements = None
    clone_hwpx_template = None
    confirm_workflow = None
    create_workflow_session = None
    finalize_document = None
    generate_drafts = None
    get_mock_result = None
    update_inputs = None


class AgentMvpContractTests(unittest.TestCase):
    def test_ai_provider_uses_mock_when_mock_mode_enabled(self):
        if should_use_mock_ai is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        self.assertIn(provider_name(), {"openai", "gemma"})
        self.assertTrue(should_use_mock_ai())

    def test_fixture_metadata_is_complete(self):
        fixture_dir = ROOT / "docs" / "evaluation" / "fixtures"
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
        self.assertIn("청년 창업", restored.title)
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

    def test_template_replacements_include_final_document_and_sections(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
        workflow = update_inputs(workflow, updates)
        workflow = finalize_document(generate_drafts(workflow))

        replacements = build_template_replacements(workflow, {"동아리명": "LiveDock"})
        self.assertIn("{{content}}", replacements)
        self.assertIn("청년 창업", replacements["{{announcement_title}}"])
        self.assertIn("LiveDock", replacements["동아리명"])
        self.assertTrue(any(key.startswith("{{section:") for key in replacements))

    def test_hwpx_clone_requires_enabled_toolchain(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = finalize_document(generate_drafts(update_inputs(create_workflow_session(result), {
            "applicant_name": "LiveDock",
            "applicant_profile": "문서 자동화 팀",
            "project_summary": "공고 분석과 제출 문서 자동화",
        })))

        with self.assertRaises(Exception) as ctx:
            clone_hwpx_template(b"PK\x03\x04", workflow)
        self.assertIn("HWPX", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
