import io
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


class FakeExcelAdapter:
    def __init__(self):
        self.opened = []

    def open_workbook(self, path: str) -> None:
        self.opened.append(path)


def _xlsx_bytes():
    import openpyxl

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "dashboard"
    sheet["A1"] = "notice title"
    sheet["B2"] = "493"
    buffer = io.BytesIO()
    workbook.save(buffer)
    workbook.close()
    return buffer.getvalue()


class ExcelHelperTests(unittest.TestCase):
    def test_open_workbook_uses_injected_adapter_and_records_state(self):
        from excel_helper.core import ExcelDesktopHelper

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "dashboard.xlsx"
            path.write_bytes(_xlsx_bytes())
            adapter = FakeExcelAdapter()
            helper = ExcelDesktopHelper(adapter=adapter)

            state = helper.open_workbook(path)

            self.assertEqual(adapter.opened, [str(path.resolve())])
            self.assertEqual(state.status, "opened")
            self.assertEqual(state.path, str(path.resolve()))
            self.assertGreater(state.last_mtime, 0)

    def test_sync_if_changed_reads_user_edit_snapshot(self):
        from excel_helper.core import ExcelDesktopHelper

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "dashboard.xlsx"
            path.write_bytes(_xlsx_bytes())
            helper = ExcelDesktopHelper(adapter=FakeExcelAdapter())
            helper.open_workbook(path)
            time.sleep(0.02)
            path.write_bytes(_xlsx_bytes())

            state = helper.sync_if_changed(path)

            self.assertEqual(state.status, "synced")
            self.assertEqual(state.snapshot["source"], "user_edit")
            self.assertIn("dashboard", state.snapshot["sheets"])
            self.assertEqual(state.snapshot["sheets"]["dashboard"][0][0], "notice title")


if __name__ == "__main__":
    unittest.main()
