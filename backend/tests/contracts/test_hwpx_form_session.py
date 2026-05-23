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
    from services.hwpx_form_session import create_form_session, export_form_session, update_region  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover
    if exc.name not in {"pydantic", "fitz", "lxml"}:
        raise
    create_form_session = None
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

        first_region = session["regions"][0]
        update_region(session["id"], first_region["id"], "테스트 입력값", "")
        filename, content, summary = export_form_session(session["id"])

        self.assertTrue(filename.endswith(".hwpx"))
        self.assertEqual(content[:2], b"PK")
        self.assertTrue(summary["validation_passed"])
        self.assertTrue(summary["structure_preserved"])


if __name__ == "__main__":
    unittest.main()
