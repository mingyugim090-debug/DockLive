import os
import sys
import unittest
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from core.config import settings  # noqa: E402
    from core.errors import AnalysisError  # noqa: E402
    from services.hwpx_form_session import _clean_ai_draft_content, create_form_session, draft_all_regions, draft_region, export_form_session, update_region  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover
    if exc.name not in {"pydantic", "fitz", "lxml"}:
        raise
    create_form_session = None
    update_region = None
    draft_all_regions = None
    draft_region = None
    export_form_session = None
    _clean_ai_draft_content = None


class HwpxFormSessionTests(unittest.TestCase):
    def test_hwpx_form_session_extracts_regions_and_exports_clone(self):
        if create_form_session is None:
            self.skipTest("backend document dependencies are not installed")

        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
        session = create_form_session(sample.read_bytes(), sample.name)

        self.assertTrue(session["id"].startswith("hwpx-"))
        self.assertGreaterEqual(len(session["pages"]), 1)
        self.assertGreaterEqual(len(session["regions"]), 10)
        self.assertTrue(any(region["source_ref"].get("type") == "table_cell" for region in session["regions"]))
        self.assertTrue(any(region["value"].strip() for region in session["regions"]))
        cells = [
            cell
            for block in session["analysis"].get("blocks", [])
            for row in block.get("rows", [])
            for cell in row
        ]
        self.assertTrue(any(cell.get("background") for cell in cells))
        self.assertTrue(any((cell.get("style") or {}).get("minHeight") for cell in cells))

        first_region = session["regions"][0]
        update_region(session["id"], first_region["id"], "테스트 입력값", "")
        filename, content, summary = export_form_session(session["id"])

        self.assertTrue(filename.endswith(".hwpx"))
        self.assertEqual(content[:2], b"PK")
        self.assertTrue(summary["validation_passed"])
        self.assertTrue(summary["structure_preserved"])

    def test_hwpx_form_session_batch_drafts_empty_long_regions_only(self):
        if create_form_session is None:
            self.skipTest("backend document dependencies are not installed")

        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
        session = create_form_session(sample.read_bytes(), sample.name)
        preserved = next(region for region in session["regions"] if region["label"] == "지원금 사용계획")
        before_value = preserved["value"]

        drafted = draft_all_regions(
            session["id"],
            base_input="DockLive는 HWPX 양식 자동완성 서비스입니다.",
            global_prompt="제출용 문체로 간결하게 작성",
            overwrite_existing=False,
        )

        by_label = {region["label"]: region for region in drafted["regions"]}
        self.assertIn("동아리목표", by_label)
        self.assertIn("운영방법", by_label)
        self.assertTrue(by_label["동아리목표"]["value"].strip())
        self.assertTrue(by_label["운영방법"]["value"].strip())
        self.assertEqual(by_label["지원금 사용계획"]["value"], before_value)

    def test_hwpx_region_draft_requires_real_ai_key_outside_mock_mode(self):
        if create_form_session is None:
            self.skipTest("backend document dependencies are not installed")

        old_mock = settings.MOCK_MODE
        old_provider = settings.AI_PROVIDER
        old_openai_key = settings.OPENAI_API_KEY
        old_gemini_key = settings.GEMINI_API_KEY
        try:
            settings.MOCK_MODE = False
            settings.AI_PROVIDER = "openai"
            settings.OPENAI_API_KEY = ""
            settings.GEMINI_API_KEY = ""

            sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
            session = create_form_session(sample.read_bytes(), sample.name)
            target = next(region for region in session["regions"] if region["kind"] == "textarea")

            with self.assertRaises(AnalysisError) as context:
                draft_region(session["id"], target["id"], "", "DockLive 서비스 방향에 맞게 작성")
            self.assertIn("외부 AI API 키", str(context.exception))
        finally:
            settings.MOCK_MODE = old_mock
            settings.AI_PROVIDER = old_provider
            settings.OPENAI_API_KEY = old_openai_key
            settings.GEMINI_API_KEY = old_gemini_key

    def test_ai_draft_cleaner_removes_repeated_field_label(self):
        if _clean_ai_draft_content is None:
            self.skipTest("backend document dependencies are not installed")

        cleaned = _clean_ai_draft_content(
            "동아리목표 | 본 동아리는 HWPX 문서 자동완성 역량을 중심으로 운영합니다.",
            {"label": "동아리목표"},
        )
        self.assertEqual(cleaned, "본 동아리는 HWPX 문서 자동완성 역량을 중심으로 운영합니다.")

    def test_template_analysis_keeps_summary_form_tables(self):
        from services.hwpx_template_analysis import analyze_hwpx_template_bytes  # noqa: E402

        hwpx = BytesIO()
        section_xml = """<?xml version="1.0" encoding="utf-8"?>
<section>
  <p><tbl>
    <tr><tc><cellAddr rowAddr="0" colAddr="0"/><p><run><t>요약 소개 (전체 1p 이내 작성)</t></run></p></tc></tr>
    <tr><tc><cellAddr rowAddr="1" colAddr="0"/><p><run><t>1. Problem(풀고자 하는 문제)</t></run></p></tc><tc><cellAddr rowAddr="1" colAddr="1"/><p><run><t>*250자 이내 작성</t></run></p></tc></tr>
  </tbl></p>
  <p><tbl>
    <tr><tc><cellAddr rowAddr="0" colAddr="0"/><p><run><t>상세 소개 (항목 별 2p 이내 작성)</t></run></p></tc></tr>
  </tbl></p>
</section>"""
        with zipfile.ZipFile(hwpx, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("Contents/section0.xml", section_xml)

        analysis = analyze_hwpx_template_bytes(hwpx.getvalue(), "kaist-summary.hwpx")
        texts = [block["text"] for block in analysis["blocks"]]

        self.assertEqual(analysis["stats"]["tables"], 2)
        self.assertTrue(any("요약 소개" in text for text in texts))
        self.assertTrue(any("상세 소개" in text for text in texts))

    def test_kaist_style_sections_map_labels_to_writing_cells(self):
        if create_form_session is None:
            self.skipTest("backend document dependencies are not installed")

        hwpx = BytesIO()
        section_xml = """<?xml version="1.0" encoding="utf-8"?>
<section>
  <p><tbl>
    <tr><tc><cellAddr rowAddr="0" colAddr="0"/><cellSpan colSpan="2" rowSpan="1"/><p><run><t>요약 소개 (전체 1p 이내 작성)</t></run></p></tc></tr>
    <tr><tc><cellAddr rowAddr="1" colAddr="0"/><p><run><t>1. Problem(풀고자 하는 문제)*250자 이내 작성</t></run></p></tc><tc><cellAddr rowAddr="1" colAddr="1"/><p><run><t>*시장 현황 및 문제점</t></run></p></tc></tr>
    <tr><tc><cellAddr rowAddr="2" colAddr="0"/><p><run><t>2. Solution(정의한 문제에 대한 나의 솔루션)*250자 이내 작성</t></run></p></tc><tc><cellAddr rowAddr="2" colAddr="1"/><p><run><t>*제품 차별성 중심 작성</t></run></p></tc></tr>
  </tbl></p>
  <p><tbl>
    <tr><tc><cellAddr rowAddr="0" colAddr="0"/><p><run><t>상세 소개 (항목 별 2p 이내 작성)</t></run></p></tc></tr>
    <tr><tc><cellAddr rowAddr="1" colAddr="0"/><p><run><t>1. Problem (풀고자 하는 문제)</t></run></p></tc></tr>
    <tr><tc><cellAddr rowAddr="2" colAddr="0"/><p><run><t>*창업 아이템의 필요성</t></run></p></tc></tr>
  </tbl></p>
</section>"""
        with zipfile.ZipFile(hwpx, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("Contents/section0.xml", section_xml)

        session = create_form_session(hwpx.getvalue(), "kaist-form.hwpx")
        regions = session["regions"]
        labels = [region["label"] for region in regions]

        self.assertEqual(len(regions), 3)
        self.assertNotIn("요약 소개", labels)
        self.assertEqual(regions[0]["label"], "1. Problem(풀고자 하는 문제)")
        self.assertEqual(regions[0]["section_heading"], "요약 소개 (전체 1p 이내 작성)")
        self.assertEqual(regions[0]["source_ref"]["col"], 1)
        self.assertEqual(regions[2]["label"], "1. Problem (풀고자 하는 문제)")
        self.assertEqual(regions[2]["section_heading"], "상세 소개 (항목 별 2p 이내 작성)")
        self.assertEqual(regions[2]["source_ref"]["row"], 2)


if __name__ == "__main__":
    unittest.main()
