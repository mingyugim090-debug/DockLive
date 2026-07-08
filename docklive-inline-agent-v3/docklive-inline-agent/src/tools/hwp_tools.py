"""한글(HWP) COM 도구 구현. 규약: docs/HWP_COM_GUIDE.md + src/tools/AGENTS.md

모든 함수는 {"ok": True, "data": ...} 또는 {"ok": False, "error": "..."} 반환.
"""
from __future__ import annotations

import atexit
import sys
from pathlib import Path

from executor import backup

try:
    import win32com.client as win32
except ImportError:  # 비Windows 개발 환경
    win32 = None


class HwpSession:
    """한글 앱 핸들의 유일한 소유자. 좀비 프로세스 방지."""

    _instance: "HwpSession | None" = None

    def __init__(self) -> None:
        self.hwp = None
        self.original_path: str | None = None
        self.backup_path: str | None = None

    @classmethod
    def get(cls) -> "HwpSession":
        if cls._instance is None:
            cls._instance = HwpSession()
            atexit.register(cls._instance.quit)
        return cls._instance

    def quit(self) -> None:
        try:
            if self.hwp is not None:
                self.hwp.Quit()
        except Exception:
            pass
        finally:
            self.hwp = None
            self.original_path = None


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


def _ok(data) -> dict:
    return {"ok": True, "data": data}


def _require_doc():
    s = HwpSession.get()
    if s.hwp is None:
        return None, _err("열린 한글 문서가 없음. hwp_open을 먼저 호출할 것.")
    return s, None


def _field_list(hwp) -> list[str]:
    """문서의 누름틀 이름 목록. GetFieldList는 0x02 구분자로 연결된 문자열 반환."""
    raw = hwp.GetFieldList(0, 0x01)  # WINDOWS-VERIFY: 옵션 플래그 (누름틀만)
    if not raw:
        return []
    return [f for f in raw.split("\x02") if f]


def hwp_open(path: str) -> dict:
    if win32 is None or sys.platform != "win32":
        return _err(
            "비Windows 또는 pywin32 미설치. 한글 실시간 제어는 Windows + 한컴오피스 필요. "
            "헤드리스 대안: read_document(HWPX 직접 파싱)."
        )
    s = HwpSession.get()
    if s.hwp is not None:
        return _err(f"이미 '{s.original_path}' 가 열려 있음. 먼저 hwp_close 할 것.")
    p = Path(path)
    if not p.exists():
        return _err(f"파일이 없음: {path}")
    if p.suffix.lower() not in (".hwp", ".hwpx"):
        return _err(f"지원하지 않는 형식: {p.suffix} (.hwp/.hwpx만 가능)")
    try:
        s.backup_path = str(backup.ensure_backup(path))  # 불변 규칙 #1
        hwp = win32.gencache.EnsureDispatch("HWPFrame.HwpObject")
        # 보안 팝업 억제 — scripts/register_hwp_module.py 선행 필요 (HWP_COM_GUIDE §1)
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
        hwp.XHwpWindows.Item(0).Visible = True  # 실시간으로 창이 보이는 스위치
        if not hwp.Open(str(p)):
            hwp.Quit()
            return _err(f"열기 실패 (파일 잠김/버전 확인): {path}")
        s.hwp = hwp
        s.original_path = str(p)
        fields = _field_list(hwp)
        return _ok({
            "opened": p.name,
            "backup": s.backup_path,
            "fields": fields,
            "hint": "필드가 있으면 hwp_fill_field, 없으면 hwp_replace_text 사용",
        })
    except Exception as e:
        s.quit()
        return _err(
            f"한글 접속 실패: {e}. 한컴오피스 설치 및 "
            "scripts/register_hwp_module.py 실행 여부 확인."
        )


def hwp_list_fields() -> dict:
    s, e = _require_doc()
    if e:
        return e
    try:
        return _ok(_field_list(s.hwp))
    except Exception as ex:
        return _err(f"필드 목록 조회 실패: {ex}")


def hwp_fill_field(field_name: str, text: str) -> dict:
    s, e = _require_doc()
    if e:
        return e
    try:
        fields = _field_list(s.hwp)
        if field_name not in fields:
            return _err(f"누름틀 '{field_name}' 없음. 존재하는 필드: {fields}")
        s.hwp.PutFieldText(field_name, text)
        return _ok(f"필드 '{field_name}' ← '{text[:40]}' 입력 완료")
    except Exception as ex:
        return _err(f"필드 입력 실패: {ex}")


def hwp_replace_text(find: str, replace: str) -> dict:
    s, e = _require_doc()
    if e:
        return e
    try:
        hwp = s.hwp
        # WINDOWS-VERIFY: AllReplace 파라미터셋 (한컴 버전별 확인)
        act = hwp.HAction
        pset = hwp.HParameterSet.HFindReplace
        act.GetDefault("AllReplace", pset.HSet)
        pset.FindString = find
        pset.ReplaceString = replace
        pset.IgnoreMessage = 1
        act.Execute("AllReplace", pset.HSet)
        return _ok(f"'{find}' → '{replace}' 전체 치환 완료")
    except Exception as ex:
        return _err(f"찾아바꾸기 실패: {ex}")


def hwp_insert_text(text: str) -> dict:
    s, e = _require_doc()
    if e:
        return e
    try:
        hwp = s.hwp
        act = hwp.HAction
        pset = hwp.HParameterSet.HInsertText
        act.GetDefault("InsertText", pset.HSet)
        pset.Text = text.replace("\\n", "\r\n")
        act.Execute("InsertText", pset.HSet)
        return _ok(f"{len(text)}자 삽입 완료")
    except Exception as ex:
        return _err(f"텍스트 삽입 실패: {ex}")


def hwp_insert_table(rows: int, cols: int, data: list[list]) -> dict:
    s, e = _require_doc()
    if e:
        return e
    if len(data) != rows or any(len(r) != cols for r in data):
        return _err(f"크기 불일치: 표는 {rows}x{cols}, data는 "
                    f"{len(data)}x{len(data[0]) if data else 0}. 정확히 맞출 것.")
    try:
        hwp = s.hwp
        act = hwp.HAction
        pset = hwp.HParameterSet.HTableCreation
        act.GetDefault("TableCreate", pset.HSet)
        pset.Rows = rows
        pset.Cols = cols
        pset.WidthType = 2   # WINDOWS-VERIFY: 2 = 문단 폭에 맞춤
        pset.HeightType = 0  # 자동 높이
        act.Execute("TableCreate", pset.HSet)
        # 생성 직후 커서는 첫 셀 → 행 우선 순회하며 채움 (HWP_COM_GUIDE §3)
        for i, row in enumerate(data):
            for j, cell in enumerate(row):
                _type_in_cell(hwp, str(cell))
                if not (i == rows - 1 and j == cols - 1):
                    hwp.HAction.Run("TableRightCell")
        hwp.HAction.Run("Cancel")  # 표 밖으로 커서 이동
        return _ok(f"{rows}x{cols} 표 생성 및 채움 완료")
    except Exception as ex:
        return _err(f"표 생성 실패: {ex}")


def _type_in_cell(hwp, text: str) -> None:
    act = hwp.HAction
    pset = hwp.HParameterSet.HInsertText
    act.GetDefault("InsertText", pset.HSet)
    pset.Text = text
    act.Execute("InsertText", pset.HSet)


def hwp_insert_image(image_path: str, width_mm: int = 120) -> dict:
    s, e = _require_doc()
    if e:
        return e
    p = Path(image_path)
    if not p.exists():
        return _err(f"이미지가 없음: {image_path}. render_chart_image를 먼저 호출했는지 확인.")
    try:
        # WINDOWS-VERIFY: InsertPicture(path, Embedded, sizeoption, reverse, watermark, effect, w, h)
        # sizeoption=1 → 지정 크기, 단위 HwpUnit(1mm ≈ 283.465)
        w = int(width_mm * 283.465)
        s.hwp.InsertPicture(str(p), True, 1, False, False, 0, w, 0)
        return _ok(f"이미지 삽입 완료 ({p.name}, 가로 {width_mm}mm)")
    except Exception as ex:
        return _err(f"이미지 삽입 실패: {ex}")


def hwp_save(path: str | None = None) -> dict:
    s, e = _require_doc()
    if e:
        return e
    try:
        if path is None:
            orig = Path(s.original_path)
            path = str(orig.with_name(f"{orig.stem}_완성본.hwpx"))
        fmt = "HWPX" if path.lower().endswith(".hwpx") else "HWP"
        s.hwp.SaveAs(path, fmt)
        return _ok({"saved": path, "format": fmt})
    except Exception as ex:
        return _err(f"저장 실패: {ex}")


def hwp_close(save: bool = False) -> dict:
    s = HwpSession.get()
    if s.hwp is None:
        return _ok("이미 닫혀 있음")
    try:
        if save:
            s.hwp.Save()
        original = s.original_path
        s.quit()
        return _ok(f"'{original}' 닫기 완료 (save={save})")
    except Exception as ex:
        return _err(f"닫기 실패: {ex}")
