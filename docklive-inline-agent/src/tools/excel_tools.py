"""Excel COM 도구 구현. 규약은 .claude/skills/excel-com-automation/SKILL.md 참조.

모든 함수는 {"ok": True, "data": ...} 또는 {"ok": False, "error": "..."} 를 반환한다.
"""
from __future__ import annotations

import atexit
import sys
from datetime import date, datetime
from pathlib import Path

from executor import backup

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
    """Excel SaveAs가 허용하지 않는 문자를 정리한다.

    대괄호는 Excel 저장 파일명 금지 문자다 (예: '[서울]_목록.xlsx' → SaveAs 실패).
    가독성을 위해 괄호로 바꾸고, 나머지 금지 문자는 밑줄로 바꾼다.
    """
    candidate = (name or default_name).strip()
    candidate = candidate.replace("[", "(").replace("]", ")")
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
        safe_name = _safe_filename(target.name, default_name)
        if Path(safe_name).suffix.lower() not in _EXCEL_SUFFIXES:
            safe_name = f"{Path(safe_name).stem or 'workbook'}.xlsx"
        return str(target.parent / safe_name)

    if not output_dir:
        raise ValueError("output_dir is required when path is not provided")

    output = Path(output_dir).expanduser()
    output.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_filename(filename, default_name)
    if Path(safe_name).suffix.lower() not in _EXCEL_SUFFIXES:
        safe_name = f"{Path(safe_name).stem or 'workbook'}.xlsx"
    return str(output / safe_name)


def _book_is_alive(s: ExcelSession) -> bool:
    """사용자가 Excel을 직접 닫는 등으로 핸들이 죽었으면 False."""
    if s.book is None:
        return False
    try:
        _ = s.book.sheets  # COM 핸들 생존 확인
        return True
    except Exception:
        return False


def _book_is_saved(s: ExcelSession) -> bool:
    try:
        return bool(s.book.api.Saved)
    except Exception:
        return True  # 확인 불가 시 저장된 것으로 간주 (fake/테스트 포함)


def _release_current_book() -> dict | None:
    """새 워크북을 열기 전 기존 세션 정리. 놓아줄 수 없으면 에러 dict 반환.

    - 죽은 핸들(사용자가 Excel을 직접 닫음) → 조용히 정리
    - 저장된 워크북 → 자동으로 닫고 진행 (자가 회복)
    - 저장 안 된 변경이 있는 워크북 → 에러 (모델이 close_workbook(save=...)로 결정)
    """
    s = ExcelSession.get()
    if s.book is None:
        return None
    if not _book_is_alive(s):
        s.book = None
        s.app = None
        return None
    if not _book_is_saved(s):
        return _err(
            f"'{s.original_path}' 에 저장하지 않은 변경이 있음. "
            "close_workbook(save=true) 또는 close_workbook(save=false)로 먼저 정리할 것."
        )
    s.quit()
    return None


def open_workbook(path: str, visible: bool = True) -> dict:
    if xw is None:
        return _err("xlwings 미설치 또는 비Windows 환경. 이 도구는 Windows + Excel 필요.")
    s = ExcelSession.get()
    p = Path(path)
    if s.book is not None and _book_is_alive(s):
        # 같은 파일이면 다시 열 필요 없음 — 그대로 사용
        if s.original_path and Path(s.original_path).resolve() == p.resolve():
            return _ok({"opened": p.name, "backup": s.backup_path, "note": "이미 열려 있어 그대로 사용",
                        "sheets": [sh.name for sh in s.book.sheets]})
    release_error = _release_current_book()
    if release_error:
        return release_error
    if not p.exists():
        return _err(f"파일이 없음: {path}")
    try:
        s.backup_path = str(backup.ensure_backup(path))  # 불변 규칙 #1: 열기 전 백업
        s.app = xw.App(visible=visible, add_book=False)
        s.book = s.app.books.open(str(p))
        s.original_path = str(p)
        return _ok({"opened": p.name, "backup": s.backup_path,
                    "sheets": [sh.name for sh in s.book.sheets]})
    except Exception as e:
        s.quit()
        return _err(f"열기 실패 (파일 잠김/권한 확인): {e}")


def create_workbook(path: str = "", visible: bool = True) -> dict:
    if xw is None:
        return _err("xlwings 미설치 또는 비Windows 환경. 이 도구는 Windows + Excel 필요.")
    release_error = _release_current_book()
    if release_error:
        return release_error
    s = ExcelSession.get()
    try:
        s.app = xw.App(visible=visible, add_book=False)
        s.book = s.app.books.add()
        s.original_path = ""
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


_MAX_READ_CELLS = 1200


def read_range(sheet: str, range: str) -> dict:  # noqa: A002 (스키마 name과 일치 우선)
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    try:
        values = _read_range_2d(sh.range(range))
        cells = len(values) * (len(values[0]) if values else 0)
        if cells > _MAX_READ_CELLS:
            return _err(
                f"범위가 너무 큼 ({len(values)}행 x {len(values[0])}열 = {cells}셀 > {_MAX_READ_CELLS}). "
                "sheet_overview로 구조를 파악하고, 집계가 목적이면 aggregate_column을 사용할 것. "
                "원본 확인이 필요하면 더 좁은 범위로 나눠 읽을 것."
            )
        return _ok(values)
    except Exception as ex:
        return _err(f"범위 '{range}' 읽기 실패: {ex}")


def sheet_overview(sheet: str, sample_rows: int = 5) -> dict:
    """대용량 시트를 통째로 읽지 않고 구조(크기·헤더 후보·샘플)를 파악한다."""
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    try:
        used = sh.used_range
        values = _normalize_2d(used.value)
        rows = len(values)
        cols = len(values[0]) if values else 0
        max_cols = 30
        sample = [row[:max_cols] for row in values[: max(1, min(sample_rows, 10))]]
        return _ok({
            "address": getattr(used, "address", ""),
            "rows": rows,
            "cols": cols,
            "sample_rows": sample,
            "note": "sample_rows는 상단 일부다. 집계는 aggregate_column, 좁은 확인은 read_range 사용.",
        })
    except Exception as ex:
        return _err(f"시트 개요 파악 실패: {ex}")


_MAX_AGG_ROWS = 50000


def _read_range_2d(rng) -> list[list]:
    """세로 한 열도 행 단위 2차원으로 읽는다 (xlwings는 기본이 flat list)."""
    try:
        return _normalize_2d(rng.options(ndim=2).value)
    except Exception:
        return _normalize_2d(rng.value)


def _parse_number(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None
    text = str(value).strip().replace(",", "").replace("원", "").replace("%", "")
    try:
        return float(text)
    except ValueError:
        return None


def aggregate_column(
    sheet: str,
    key_range: str,
    value_range: str = "",
    agg: str = "count",
    top: int = 30,
) -> dict:
    """key_range의 값별로 count 또는 value_range 합계를 집계한다 (차트 데이터 산출용).

    반환 값은 전부 원본 셀에서만 나온다 — 지어내는 값 없음.
    """
    s, e = _require_book()
    if e:
        return e
    sh, e = _get_sheet(s, sheet)
    if e:
        return e
    if agg not in {"count", "sum"}:
        return _err("agg는 count 또는 sum 이어야 함.")
    try:
        keys_2d = _read_range_2d(sh.range(key_range))
        keys = [row[0] for row in keys_2d]
        if len(keys) > _MAX_AGG_ROWS:
            return _err(f"집계 범위가 너무 큼 ({len(keys)}행 > {_MAX_AGG_ROWS}).")
        numbers: list[float | None] = []
        if agg == "sum":
            if not value_range:
                return _err("agg=sum 이면 value_range가 필요함.")
            values_2d = _read_range_2d(sh.range(value_range))
            numbers = [_parse_number(row[0]) for row in values_2d]
            if len(numbers) != len(keys):
                return _err(f"key_range({len(keys)}행)와 value_range({len(numbers)}행) 길이가 다름.")

        totals: dict[str, float] = {}
        skipped = 0
        for index, key in enumerate(keys):
            label = str(key).strip() if key is not None else ""
            if not label:
                skipped += 1
                continue
            if agg == "count":
                totals[label] = totals.get(label, 0) + 1
            else:
                number = numbers[index]
                if number is None:
                    skipped += 1
                    continue
                totals[label] = totals.get(label, 0.0) + number

        ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)
        top = max(1, min(int(top), 100))
        result = {
            "agg": agg,
            "groups": [[label, value] for label, value in ranked[:top]],
            "total_groups": len(ranked),
            "rows_scanned": len(keys),
            "rows_skipped": skipped,
        }
        if len(ranked) <= 1 and len(keys) > 1:
            result["note"] = (
                "그룹이 1개뿐이라 구분 기준으로 부적절할 수 있음. "
                "다른 열(예: 구/동/유형이 담긴 열)로 다시 집계해 의미 있는 구분을 찾을 것."
            )
        return _ok(result)
    except Exception as ex:
        return _err(f"집계 실패: {ex}")


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
                path = str(orig.with_name(_safe_filename(default_name, "workbook.xlsx")))
            else:
                return _err("새 워크북은 output_dir 또는 path를 지정해야 저장할 수 있음.")
        else:
            path = _resolve_save_path(path, "", filename, _default_save_name(s.original_path))
        last_error: Exception | None = None
        target = Path(path)
        for attempt in range(3):
            candidate = target if attempt == 0 else target.with_name(f"{target.stem}_{attempt + 1}{target.suffix}")
            try:
                s.book.save(str(candidate))
                result = {"saved": str(candidate), "saved_path": str(candidate)}
                if attempt:
                    result["note"] = f"'{target.name}'이 잠겨 있어 '{candidate.name}'으로 저장함."
                return _ok(result)
            except Exception as ex:  # 대상 파일이 다른 Excel에서 열려 잠긴 경우 등
                last_error = ex
        return _err(
            f"저장 실패: {last_error} — 같은 이름의 파일이 다른 창에서 열려 있으면 닫고 재시도할 것."
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
