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
    from services.hwpx_form_session import create_form_session, draft_session, export_form_session, update_region  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover
    if exc.name not in {"pydantic", "fitz", "lxml"}:
        raise
    create_form_session = None
    draft_session = None
    update_region = None
    export_form_session = None


class HwpxFormSessionTests(unittest.TestCase):
    def test_hwpx_form_session_extracts_regions_and_exports_clone(self):
        if create_form_session is None:
            self.skipTest("backend document dependencies are not installed")

        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
        session = create_form_session(sample.read_bytes(), sample.name)

        self.assertTrue(session["id"].startswith("hwpx-"))
        self.assertGreaterEqual(len(session["pages"]), 1)
        self.assertGreaterEqual(len(session["regions"]), 50)
        self.assertTrue(any(region["source_ref"].get("type") == "table_cell" for region in session["regions"]))
        self.assertTrue(any("서명" in region["value"] or "귀하" in region["value"] for region in session["regions"]))
        self.assertTrue(
            all(
                {"x", "y", "width", "height"}.issubset(region["bbox"])
                and region["bbox"]["width"] > 0
                and region["bbox"]["height"] > 0
                for region in session["regions"]
            )
        )
        self.assertTrue(any(region["source_ref"].get("bbox_status") in {"matched", "fallback", "unmatched"} for region in session["regions"]))

        draft = draft_session(
            session["id"],
            brief="청년 창업 지원사업 참여자를 모집하는 공고문",
            facts="기관명: 테스트 기관\n신청 기간: 2026년 6월 1일~6월 30일\n지원 내용: 시제품 제작비 및 멘토링",
            tone="공공기관 공고문 문체",
            constraints="제공되지 않은 날짜와 연락처는 임의로 만들지 않기",
        )
        self.assertTrue(draft["success"])
        self.assertIn("filled_region_count", draft)
        self.assertIn("confirmation_required", draft)
        self.assertIn("ai_summary", draft)

        first_region = session["regions"][0]
        update_region(session["id"], first_region["id"], "테스트 입력값", "")
        filename, content, summary = export_form_session(session["id"])

        self.assertTrue(filename.endswith(".hwpx"))
        self.assertEqual(content[:2], b"PK")
        self.assertTrue(summary["validation_passed"])
        self.assertTrue(summary["structure_preserved"])


if __name__ == "__main__":
    unittest.main()
