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
    from services.hwpx_form_session import create_form_session, draft_all_regions, export_form_session, update_region  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover
    if exc.name not in {"pydantic", "fitz", "lxml"}:
        raise
    create_form_session = None
    update_region = None
    draft_all_regions = None
    export_form_session = None


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
