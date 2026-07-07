"""Excel COM 도구 구현. 규약은 .claude/skills/excel-com-automation/SKILL.md 참조.

모든 함수는 {"ok": True, "data": ...} 또는 {"ok": False, "error": "..."} 를 반환한다.
"""
from __future__ import annotations

import atexit
import sys
from datetime import date, datetime
from pathlib import Path

from executor import backup
from tools import integrity_tools

try:
    import xlwings as xw
except ImportError:  # 비Windows 개발 환경에서도 import 에러로 죽지 않게
    xw = None


class ExcelSession:
    """App/Book 핸들의 유일한 소유자. 좀비 EXCEL.EXE 방지."""

    _instance: "ExcelSession | None" = None

    def __init__(self) -> None:
        self.app = None
        self.book = None
        self.original_path: str | None = None
        self.backup_path: str | None = None
        self.authored_ranges: list[str] = []

    @classmethod
    def get(cls) -> "ExcelSession":
        if cls._instance is None:
            cls._instance = ExcelSession()
            atexit.register(cls._instance.quit)
        return cls._instance

    def quit(self) -> None:
        try:
            if self.book is not None:
                self.book.close()
            if self.app is not None:
                self.app.quit()
        except Exception:
            pass
        finally:
            self.book = None
            self.app = None
            self.authored_ranges = []


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


def _ok(data) -> dict:
    return {"ok": True, "data": data}


_EXCEL_SUFFIXES = {".xlsx", ".xlsm", ".xls"}
_INVALID_FILENAME_CHARS = '<>:"/\\|?*'


def _require_book():
    s = ExcelSession.get()
    if s.book is None:
        return None, _err("열린 워크북이 없음. open_workbook을 먼저 호출할 것.")
    return s, None


def _get_sheet(s: ExcelSession, sheet: str):
    names = [sh.name for sh in s.book.sheets]
    if sheet not in names:
        return None, _err(f"시트 '{sheet}'가 없음. 존재하는 시트: {names}")
    return s.book.sheets[sheet], None


def _normalize_2d(value) -> list[list]:
    """xlwings 반환값(스칼라/1D/2D)을 항상 2차원 + JSON 직렬화 가능 형태로."""
    if not isinstance(value, list):
        value = [[value]]
    elif value and not isinstance(value[0], list):
        value = [value]
    out = []
    for row in value:
        out.append([v.isoformat() if isinstance(v, (datetime, date)) else v for v in row])
    return out


def _safe_filename(name: str, default_name: str) -> str:
    candidate = (name or default_name).strip()
    cleaned = "".join("_" if char in _INVALID_FILENAME_CHARS else char for char in candidate).strip(" .")
    return cleaned or default_name


def _default_save_name(original_path: str | None) -> str:
    if original_path:
        original = Path(original_path)
        return f"{original.stem}_완성본{original.suffix or '.xlsx'}"
    return "workbook.xlsx"


def _resolve_save_path(path: str | None, output_dir: str, filename: str, default_name: str) -> str:
    if path:
        target = Path(path).expanduser()
        if target.parent != Path("."):
            target.parent.mkdir(parents=True, exist_ok=True)
        return str(target)

    if not output_dir:
        raise ValueError("output_dir is required when path is not provided")

    output = Path(output_dir).expanduser()
    output.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_filename(filename, default_name)
    if Path(safe_name).suffix.lower() not in _EXCEL_SUFFIXES:
        safe_name = f"{Path(safe_name).stem or 'workbook'}.xlsx"
    return str(output / safe_name)


def _validation_summary(path: str, original_path: str | None, authored_ranges: list[str] | None = None) -> dict:
    try:
        result = integrity_tools.validate_document(
            path,
            original_path=original_path or "",
            authored_ranges=authored_ranges or [],
        )
    except Exception as exc:
        return {"validation_passed": False, "checks": [], "warnings": [f"validation failed: {exc}"]}
    if result.get("ok"):
        return result.get("data", {})
    return {"validation_passed": False, "checks": [], "warnings": [result.get("error", "validation failed")]}


def open_workbook(path: str, visible: bool = True) -> dict:
    if xw is None:
        return _err("xlwings 미설치 또는 비Windows 환경. 이 도구는 Windows + Excel 필요.")
    s = ExcelSession.get()
    if s.book is not None:
        return _err(f"이미 '{s.original_path}' 가 열려 있음. 먼저 close_workbook 할 것.")
    p = Path(path)
    if not p.exists():
        return _err(f"파일이 없음: {path}")
    try:
        s.backup_path = str(backup.ensure_backup(path))  # 불변 규칙 #1: 열기 전 백업
        s.app = xw.App(visible=visible, add_book=False)
        s.book = s.app.books.open(str(p))
        s.original_path = str(p)
        s.authored_ranges = []
        return _ok({"opened": p.name, "backup": s.backup_path,
                    "sheets": [sh.name for sh in s.book.sheets]})
    except Exception as e:
        s.quit()
        return _err(f"열기 실패 (파일 잠김/권한 확인): {e}")


def create_workbook(path: str = "", visible: bool = True) -> dict:
    if xw is None:
        return _err("xlwings 미설치 또는 비Windows 환경. 이 도구는 Windows + Excel 필요.")
    s = ExcelSession.get()
    if s.book is not None:
        return _err(f"이미 '{s.original_path}' 가 열려 있음. 먼저 close_workbook 할 것.")
    try:
        s.app = xw.App(visible=visible, add_book=False)
        s.book = s.app.books.add()
        s.original_path = ""
        s.authored_ranges = []
        if path:
            target = Path(path).expanduser()
            target.parent.mkdir(parents=True, exist_ok=True)
            s.book.save(str(target))
            s.original_path = str(target)
        return _ok(
            {
                "workbook": getattr(s.book, "name", "Book1"),
                "path": s.original_path,
                "sheets": [sh.name for sh in s.book.sheets],
            }
        )
    except Exception as e:
        s.quit()
        return _err(f"새 워크북 생성 실패: {e}")


def list_sheets() -> dict:
    s, e = _require_book()
    if e:
        return e
    return _ok([sh.name for sh in s.book.sheets])


def add_sheet(name: str) -> dict:
    s, e = _require_book()
    if e:
        return e
    sheet_name = (name or "").strip()
    if not sheet_name:
        return _err("sheet name is required")
    existing = [sh.name for sh in s.book.sheets]
    if sheet_name in existing:
        return _err(f"시트 '{sheet_name}'가 이미 있음. 기존 시트: {existing}")
    try:
        sheet = s.book.sheets.add(name=sheet_name)
        return _ok({"sheet": sheet.name})
    except Exception as ex:
        return _err(f"시트 추가 실패: {ex}")


def read_range(sheet: str, range: str) -> dict:  # noqa: A002 (스키마 name과 일치 우선)
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    try:
        return _ok(_normalize_2d(sh.range(range).value))
    except Exception as ex:
        return _err(f"범위 '{range}' 읽기 실패: {ex}")


def write_range(sheet: str, range: str, values: list[list]) -> dict:  # noqa: A002
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    if not values or not isinstance(values[0], list):
        return _err("values는 2차원 배열이어야 함. 예: [[1, 2], [3, 4]]")
    try:
        rng = sh.range(range)
        rows, cols = rng.shape
        if (rows, cols) != (len(values), len(values[0])):
            return _err(
                f"크기 불일치: range는 {rows}x{cols}, values는 "
                f"{len(values)}x{len(values[0])}. 정확히 맞춰서 재시도."
            )
        rng.value = values
        s.authored_ranges.append(f"{sheet}!{range}")
        return _ok(f"{rows}x{cols} 쓰기 완료 ({sheet}!{range})")
    except Exception as ex:
        return _err(f"쓰기 실패: {ex}")


def apply_formula(sheet: str, range: str, formula: str) -> dict:  # noqa: A002
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    if not formula.startswith("="):
        return _err("formula는 '='로 시작해야 함.")
    try:
        sh.range(range).formula = formula
        s.authored_ranges.append(f"{sheet}!{range}")
        return _ok(f"수식 적용 완료 ({sheet}!{range} = {formula})")
    except Exception as ex:
        return _err(f"수식 적용 실패: {ex}")


def insert_rows(sheet: str, at_row: int, count: int = 1) -> dict:
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    try:
        for _ in range(count):
            sh.range(f"{at_row}:{at_row}").insert(shift="down")
        return _ok(f"{at_row}행 위치에 {count}개 행 삽입 완료")
    except Exception as ex:
        return _err(f"행 삽입 실패: {ex}")


def format_range(sheet: str, range: str, bold: bool | None = None,  # noqa: A002
                 number_format: str | None = None, bg_color: str | None = None) -> dict:
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    try:
        rng = sh.range(range)
        applied = []
        if bold is not None:
            rng.font.bold = bold
            applied.append(f"bold={bold}")
        if number_format:
            rng.number_format = number_format
            applied.append(f"format={number_format}")
        if bg_color:
            rng.color = bg_color
            applied.append(f"bg={bg_color}")
        return _ok(f"서식 적용: {', '.join(applied) or '변경 없음'}")
    except Exception as ex:
        return _err(f"서식 적용 실패: {ex}")


def create_chart(
    sheet: str,
    source_range: str,
    position: str = "H2",
    chart_type: str = "bar",
    title: str = "",
) -> dict:
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    chart_types = {
        "bar": "column_clustered",
        "column": "column_clustered",
        "line": "line",
        "pie": "pie",
    }
    if chart_type not in chart_types:
        return _err("chart_type은 bar, column, line, pie 중 하나여야 함.")
    try:
        anchor = sh.range(position)
        chart = sh.charts.add(left=anchor.left, top=anchor.top, width=420, height=260)
        chart.set_source_data(sh.range(source_range))
        chart.chart_type = chart_types[chart_type]
        if title:
            chart.name = title
            try:
                chart.api[1].ChartTitle.Text = title
            except Exception:
                pass
        return _ok({"chart": title or chart_type, "sheet": sheet, "source_range": source_range, "position": position})
    except Exception as ex:
        return _err(f"차트 생성 실패: {ex}")


def save_workbook(path: str | None = None, output_dir: str = "", filename: str = "") -> dict:
    s, e = _require_book()
    if e:
        return e
    try:
        if path is None:
            default_name = _default_save_name(s.original_path)
            if output_dir:
                path = _resolve_save_path(None, output_dir, filename, default_name)
            elif s.original_path:
                orig = Path(s.original_path)
                path = str(orig.with_name(default_name))
            else:
                return _err("새 워크북은 output_dir 또는 path를 지정해야 저장할 수 있음.")
        else:
            path = _resolve_save_path(path, "", filename, _default_save_name(s.original_path))
        s.book.save(path)
        return _ok(
            {
                "saved": path,
                "saved_path": path,
                "validation_summary": _validation_summary(path, s.original_path, list(s.authored_ranges)),
            }
        )
    except Exception as ex:
        return _err(f"저장 실패: {ex}")


def close_workbook(save: bool = False) -> dict:
    s = ExcelSession.get()
    if s.book is None:
        return _ok("이미 닫혀 있음")
    try:
        if save:
            s.book.save()
        original = s.original_path
        s.quit()
        return _ok(f"'{original}' 닫기 완료 (save={save})")
    except Exception as ex:
        return _err(f"닫기 실패: {ex}")


if sys.platform != "win32" and xw is not None:
    # macOS xlwings는 동작이 달라 계약이 깨질 수 있음 — 명시적으로 알림
    print("[warn] 비Windows 환경: COM 통합 테스트는 Windows에서 수행할 것", file=sys.stderr)
