"""excel_tools 단위 테스트 — COM 없이 가짜 xlwings로 {"ok", ...} 계약을 검증한다."""
import re
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from executor import backup  # noqa: E402
from tools import excel_tools  # noqa: E402
from tools.excel_tools import ExcelSession  # noqa: E402


def _addr_shape(addr: str) -> tuple[int, int]:
    """'B5:C6' → (2,2), 'B5' → (1,1), '5:5' → (1, 1)."""
    cell = re.compile(r"([A-Z]+)(\d+)")
    parts = addr.split(":")
    found = [cell.fullmatch(p) for p in parts]
    if len(parts) == 2 and all(found):
        (c1, r1), (c2, r2) = found[0].groups(), found[1].groups()
        cols = abs(_col_num(c2) - _col_num(c1)) + 1
        rows = abs(int(r2) - int(r1)) + 1
        return rows, cols
    return 1, 1


def _col_num(letters: str) -> int:
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n


class FakeFont:
    def __init__(self):
        self.bold = None


class FakeRange:
    def __init__(self, sheet: "FakeSheet", addr: str):
        self.sheet = sheet
        self.addr = addr
        self.shape = _addr_shape(addr)
        self.font = FakeFont()
        self.number_format = None
        self.color = None
        self.formula = None

    @property
    def value(self):
        return self.sheet.values.get(self.addr)

    @value.setter
    def value(self, v):
        self.sheet.values[self.addr] = v

    def insert(self, shift: str):
        self.sheet.inserted.append((self.addr, shift))


class FakeSheet:
    def __init__(self, name: str):
        self.name = name
        self.values: dict[str, object] = {}
        self.inserted: list[tuple[str, str]] = []
        self._ranges: dict[str, FakeRange] = {}

    def range(self, addr: str) -> FakeRange:
        if addr not in self._ranges:
            self._ranges[addr] = FakeRange(self, addr)
        return self._ranges[addr]


class FakeSheets:
    def __init__(self, names: list[str]):
        self._sheets = [FakeSheet(n) for n in names]

    def __iter__(self):
        return iter(self._sheets)

    def __getitem__(self, name: str) -> FakeSheet:
        return next(s for s in self._sheets if s.name == name)

    def add(self, name: str | None = None) -> FakeSheet:
        sheet = FakeSheet(name or f"Sheet{len(self._sheets) + 1}")
        self._sheets.append(sheet)
        return sheet


class FakeBook:
    def __init__(self, names: list[str], name: str = "Book1"):
        self.name = name
        self.sheets = FakeSheets(names)
        self.saved_paths: list[object] = []
        self.closed = False

    def save(self, path=None):
        self.saved_paths.append(path)

    def close(self):
        self.closed = True


class FakeBooks:
    def __init__(self):
        self.active: FakeBook | None = None

    def open(self, path: str) -> FakeBook:
        self.active = FakeBook(["견적서", "데이터"], name=Path(path).name)
        return self.active

    def add(self) -> FakeBook:
        self.active = FakeBook(["Sheet1"], name="Book1")
        return self.active


class FakeApp:
    def __init__(self, visible=True, add_book=False):
        self.visible = visible
        self.quit_called = False
        self.books = FakeBooks()

    def quit(self):
        self.quit_called = True


class FakeXw:
    App = FakeApp


@pytest.fixture(autouse=True)
def clean_session(monkeypatch, tmp_path):
    """싱글턴 초기화 + 백업 폴더를 tmp로 격리."""
    ExcelSession._instance = None
    monkeypatch.setattr(backup, "BACKUP_DIR", tmp_path / "backups")
    yield
    if ExcelSession._instance is not None:
        ExcelSession._instance.quit()
        ExcelSession._instance = None


@pytest.fixture
def xlsx(tmp_path) -> str:
    p = tmp_path / "견적서양식.xlsx"
    p.write_bytes(b"PK-fake-xlsx")
    return str(p)


@pytest.fixture
def opened(monkeypatch, xlsx):
    monkeypatch.setattr(excel_tools, "xw", FakeXw)
    out = excel_tools.open_workbook(xlsx)
    assert out["ok"], out
    return out


class TestOpenWorkbook:
    def test_open_creates_backup_and_lists_sheets(self, monkeypatch, xlsx, tmp_path):
        monkeypatch.setattr(excel_tools, "xw", FakeXw)
        out = excel_tools.open_workbook(xlsx)
        assert out["ok"] is True
        assert out["data"]["sheets"] == ["견적서", "데이터"]
        assert Path(out["data"]["backup"]).exists()
        assert Path(out["data"]["backup"]).parent == tmp_path / "backups"

    def test_missing_file_returns_error(self, monkeypatch):
        monkeypatch.setattr(excel_tools, "xw", FakeXw)
        out = excel_tools.open_workbook("C:/없는파일.xlsx")
        assert out["ok"] is False and "파일이 없음" in out["error"]

    def test_double_open_returns_error(self, opened, xlsx):
        out = excel_tools.open_workbook(xlsx)
        assert out["ok"] is False and "이미" in out["error"]

    def test_without_xlwings_returns_error(self, monkeypatch, xlsx):
        monkeypatch.setattr(excel_tools, "xw", None)
        out = excel_tools.open_workbook(xlsx)
        assert out["ok"] is False and "xlwings" in out["error"]


class TestCreateWorkbook:
    def test_create_workbook_opens_visible_blank_book(self, monkeypatch):
        fake_app = FakeApp()
        monkeypatch.setattr(excel_tools, "xw", FakeXw)
        monkeypatch.setattr(excel_tools.xw, "App", lambda visible=True, add_book=False: fake_app)

        out = excel_tools.create_workbook(visible=True)

        assert out["ok"] is True
        assert out["data"]["workbook"] == fake_app.books.active.name
        assert fake_app.visible is True
        assert ExcelSession.get().book is fake_app.books.active

    def test_add_sheet_creates_named_sheet(self, opened):
        out = excel_tools.add_sheet("Summary")

        assert out["ok"] is True
        assert out["data"]["sheet"] == "Summary"
        assert "Summary" in [sheet.name for sheet in ExcelSession.get().book.sheets]

    def test_add_sheet_rejects_duplicate_name(self, opened):
        out = excel_tools.add_sheet("견적서")

        assert out["ok"] is False
        assert "이미" in out["error"]


class TestReadWrite:
    def test_list_sheets_requires_open_book(self):
        out = excel_tools.list_sheets()
        assert out["ok"] is False and "open_workbook" in out["error"]

    def test_read_range_normalizes_scalar_and_dates(self, opened):
        sheet = ExcelSession.get().book.sheets["견적서"]
        sheet.range("A1").value = datetime(2026, 7, 7, 9, 0)
        out = excel_tools.read_range("견적서", "A1")
        assert out["ok"] is True
        assert out["data"] == [["2026-07-07T09:00:00"]]

    def test_read_missing_sheet_lists_existing(self, opened):
        out = excel_tools.read_range("없는시트", "A1")
        assert out["ok"] is False and "견적서" in out["error"]

    def test_write_range_rejects_non_2d_values(self, opened):
        out = excel_tools.write_range("견적서", "A1:B1", [1, 2])
        assert out["ok"] is False and "2차원" in out["error"]

    def test_write_range_rejects_shape_mismatch(self, opened):
        out = excel_tools.write_range("견적서", "A1:B2", [[1, 2]])
        assert out["ok"] is False and "크기 불일치" in out["error"]

    def test_write_range_writes_matching_shape(self, opened):
        out = excel_tools.write_range("견적서", "A1:B2", [[1, 2], [3, 4]])
        assert out["ok"] is True
        sheet = ExcelSession.get().book.sheets["견적서"]
        assert sheet.range("A1:B2").value == [[1, 2], [3, 4]]


class TestFormulaRowsFormat:
    def test_apply_formula_requires_equals_prefix(self, opened):
        out = excel_tools.apply_formula("견적서", "C10", "SUM(C5:C9)")
        assert out["ok"] is False and "=" in out["error"]

    def test_apply_formula_sets_formula(self, opened):
        out = excel_tools.apply_formula("견적서", "C10", "=SUM(C5:C9)")
        assert out["ok"] is True
        sheet = ExcelSession.get().book.sheets["견적서"]
        assert sheet.range("C10").formula == "=SUM(C5:C9)"

    def test_insert_rows_repeats_count_times(self, opened):
        out = excel_tools.insert_rows("견적서", at_row=5, count=3)
        assert out["ok"] is True
        sheet = ExcelSession.get().book.sheets["견적서"]
        assert sheet.inserted == [("5:5", "down")] * 3

    def test_format_range_applies_requested_attributes(self, opened):
        out = excel_tools.format_range("견적서", "A1:B1", bold=True, number_format="#,##0", bg_color="#FFF2CC")
        assert out["ok"] is True
        rng = ExcelSession.get().book.sheets["견적서"].range("A1:B1")
        assert rng.font.bold is True
        assert rng.number_format == "#,##0"
        assert rng.color == "#FFF2CC"

    def test_format_range_reports_no_change(self, opened):
        out = excel_tools.format_range("견적서", "A1")
        assert out["ok"] is True and "변경 없음" in out["data"]


class TestSaveClose:
    def test_save_defaults_to_wanseongbon_suffix(self, opened, xlsx):
        out = excel_tools.save_workbook()
        assert out["ok"] is True
        assert out["data"]["saved"].endswith("견적서양식_완성본.xlsx")

    def test_save_with_explicit_path(self, opened, tmp_path):
        target = str(tmp_path / "결과.xlsx")
        out = excel_tools.save_workbook(target)
        assert out["ok"] is True and out["data"]["saved"] == target

    def test_save_workbook_uses_output_dir_and_safe_filename(self, opened, tmp_path):
        output_dir = tmp_path / "done"

        out = excel_tools.save_workbook(output_dir=str(output_dir), filename="sales:summary.xlsx")

        assert out["ok"] is True
        assert out["data"]["saved_path"].endswith("sales_summary.xlsx")
        assert out["data"]["saved"] == out["data"]["saved_path"]
        assert str(output_dir) in out["data"]["saved_path"]

    def test_close_when_nothing_open_is_ok(self):
        out = excel_tools.close_workbook()
        assert out["ok"] is True and "이미" in out["data"]

    def test_close_resets_session(self, opened):
        out = excel_tools.close_workbook(save=True)
        assert out["ok"] is True
        assert ExcelSession.get().book is None
        assert ExcelSession.get().app is None
