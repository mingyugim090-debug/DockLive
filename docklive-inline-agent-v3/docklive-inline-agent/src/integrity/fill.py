"""라운드트립용 헤드리스 채움. COM 없이 파일을 직접 조작한다.

핵심 규약 (hwpx-pipeline 스킬):
- HWPX 재압축 시 mimetype이 반드시 첫 엔트리 + 무압축(STORED)
- 텍스트 노드만 치환하고 XML 구조·스타일은 절대 건드리지 않는다
"""
from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

import openpyxl


def dummy_value(slot: dict) -> str:
    """슬롯별 결정적 더미 (재현 가능해야 diff 채점이 성립)."""
    base = f"[TEST:{slot['id']}]"
    limit = slot.get("max_chars")
    if limit:
        filler = base + "가" * max(0, limit - len(base))
        return filler[:limit]
    return base + " 검증용 더미 텍스트입니다."


def fill_file(src: str | Path, dst: str | Path, slots: list[dict]) -> dict:
    src, dst = Path(src), Path(dst)
    if src.suffix.lower() == ".hwpx":
        return _fill_hwpx(src, dst, slots)
    if src.suffix.lower() in (".xlsx", ".xlsm"):
        return _fill_xlsx(src, dst, slots)
    return {"ok": False, "error": f"지원하지 않는 형식: {src.suffix}"}


def _fill_hwpx(src: Path, dst: Path, slots: list[dict]) -> dict:
    try:
        replacements = {f"{{{{{s['id']}}}}}": dummy_value(s)
                        for s in slots if s["kind"] == "placeholder"}
        with zipfile.ZipFile(src) as zin:
            names = zin.namelist()
            items = {n: zin.read(n) for n in names}
        for name in list(items):
            if name.startswith("Contents/section") and name.endswith(".xml"):
                text = items[name].decode("utf-8")
                for find, rep in replacements.items():
                    text = text.replace(find, _xml_escape(rep))
                items[name] = text.encode("utf-8")
        # 재압축: mimetype 첫 엔트리 + STORED (어기면 한컴이 파일을 못 연다)
        dst.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
            if "mimetype" in items:
                zout.writestr(zipfile.ZipInfo("mimetype"), items.pop("mimetype"),
                              compress_type=zipfile.ZIP_STORED)
            for name in names:
                if name in items:
                    zout.writestr(name, items[name])
        return {"ok": True, "filled": len(replacements), "dst": str(dst)}
    except Exception as e:
        return {"ok": False, "error": f"HWPX 채움 실패: {e}"}


def _xml_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _fill_xlsx(src: Path, dst: Path, slots: list[dict]) -> dict:
    try:
        shutil.copy2(src, dst)
        wb = openpyxl.load_workbook(dst)
        count = 0
        for s in slots:
            if s["kind"] != "cell":
                continue
            sheet_name, coord = s["ref"].split("!")
            wb[sheet_name][coord] = dummy_value(s)
            count += 1
        wb.save(dst)
        return {"ok": True, "filled": count, "dst": str(dst)}
    except Exception as e:
        return {"ok": False, "error": f"XLSX 채움 실패: {e}"}
