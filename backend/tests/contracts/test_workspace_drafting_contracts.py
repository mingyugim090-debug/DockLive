import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from models.schemas import DocumentWorkspace, GeneratedDocument, VisualBlock  # noqa: E402
    from services import workspace_drafting  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name not in {"pydantic", "httpx", "fitz"}:
        raise
    workspace_drafting = None


def _document() -> "GeneratedDocument":
    return GeneratedDocument(
        id="doc-1",
        title="테스트 문서",
        blocks=[
            VisualBlock(id="blk-1", section_id="bs-1", kind="heading", markdown="사업 개요"),
            VisualBlock(id="blk-2", section_id="bs-1", kind="paragraph", markdown="지역 소상공인 지원 사업."),
            VisualBlock(
                id="blk-3",
                section_id="bs-2",
                kind="paragraph",
                markdown="이 섹션의 내용을 입력해 주세요. (업로드 자료에 관련 근거 없음)",
                status="needs_input",
            ),
            VisualBlock(id="blk-4", section_id="bs-3", kind="table", markdown=""),
        ],
    )


def _workspace() -> "DocumentWorkspace":
    return DocumentWorkspace(id="ws-1", title="t")


class WorkspaceDraftingContractTests(unittest.TestCase):
    def setUp(self):
        if workspace_drafting is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

    def test_mock_mode_returns_document_unchanged(self):
        document = _document()
        original = [block.markdown for block in document.blocks]
        result = workspace_drafting.synthesize_paragraphs(_workspace(), document)
        self.assertIs(result, document)
        self.assertEqual([block.markdown for block in result.blocks], original)

    def test_llm_output_only_replaces_existing_paragraphs(self):
        document = _document()
        fake_response = {
            "blocks": [
                {"block_id": "blk-2", "markdown": "○ 지역 소상공인의 디지털 전환을 지원함"},
                {"block_id": "blk-3", "markdown": "지어낸 내용"},  # needs_input — must be ignored
                {"block_id": "blk-4", "markdown": "표를 덮어쓰기 시도"},  # table — must be ignored
                {"block_id": "blk-99", "markdown": "없는 블록"},  # unknown — must be ignored
            ]
        }
        with patch.object(workspace_drafting, "should_use_mock_ai", return_value=False), patch.object(
            workspace_drafting, "call_json", return_value=fake_response
        ):
            result = workspace_drafting.synthesize_paragraphs(_workspace(), document)

        blocks = {block.id: block for block in result.blocks}
        self.assertEqual(blocks["blk-2"].markdown, "○ 지역 소상공인의 디지털 전환을 지원함")
        self.assertIn("입력해 주세요", blocks["blk-3"].markdown)
        self.assertEqual(blocks["blk-3"].status, "needs_input")
        self.assertEqual(blocks["blk-4"].markdown, "")

    def test_empty_llm_markdown_keeps_rule_based_content(self):
        document = _document()
        with patch.object(workspace_drafting, "should_use_mock_ai", return_value=False), patch.object(
            workspace_drafting, "call_json", return_value={"blocks": [{"block_id": "blk-2", "markdown": "  "}]}
        ):
            result = workspace_drafting.synthesize_paragraphs(_workspace(), document)
        self.assertEqual(result.blocks[1].markdown, "지역 소상공인 지원 사업.")

    def test_llm_failure_falls_back_to_rule_based_document(self):
        document = _document()
        with patch.object(workspace_drafting, "should_use_mock_ai", return_value=False), patch.object(
            workspace_drafting, "call_json", side_effect=RuntimeError("provider down")
        ):
            result = workspace_drafting.synthesize_paragraphs(_workspace(), document)
        self.assertEqual(result.blocks[1].markdown, "지역 소상공인 지원 사업.")

    def test_rewrite_falls_back_to_original_on_failure(self):
        with patch.object(workspace_drafting, "call_json", side_effect=RuntimeError("provider down")):
            result = workspace_drafting.ai_rewrite_paragraph("원본 문단입니다.")
        self.assertEqual(result, "원본 문단입니다.")

    def test_rewrite_returns_llm_markdown_when_present(self):
        with patch.object(
            workspace_drafting, "call_json", return_value={"markdown": "○ 다듬어진 문단"}
        ):
            result = workspace_drafting.ai_rewrite_paragraph("원본 문단입니다.")
        self.assertEqual(result, "○ 다듬어진 문단")


if __name__ == "__main__":
    unittest.main()
