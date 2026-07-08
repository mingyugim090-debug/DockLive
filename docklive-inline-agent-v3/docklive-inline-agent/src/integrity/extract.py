"""양식 구조 추출: 임의의 HWPX/XLSX에서 '채울 수 있는 슬롯'의 스키마를 뽑는다.

슬롯 종류:
- placeholder: 본문 텍스트의 {{이름}} 패턴
- field: HWPX 누름틀 (section xml의 fieldBegin name 속성)
- cell: XLSX에서 {{이름}} 이 들어있는 셀 주소
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import openpyxl

PLACEHOLDER = re.compile(r"\{\{([^{}]+)\}\}")


def extract_slots(path: str | Path) -> dict:
    p = Path(path)
    if p.suffix.lower() == ".hwpx":
        return _extract_hwpx(p)
    if p.suffix.lower() in (".xlsx", ".xlsm"):
        return _extract_xlsx(p)
    return {"ok": False, "error": f"지원하지 않는 형식: {p.suffix}"}


def _extract_hwpx(p: Path) -> dict:
    slots: list[dict] = []
    try:
        with zipfile.ZipFile(p) as zf:
            sections = sorted(n for n in zf.namelist()
                              if n.startswith("Contents/section") and n.endswith(".xml"))
            for name in sections:
                xml_text = zf.read(name).decode("utf-8")
                for m in PLACEHOLDER.finditer(xml_text):
                    slots.append({"id": m.group(1), "kind": "placeholder", "ref": name})
                # 누름틀: fieldBegin 요소의 name 속성
                root = ET.fromstring(xml_text)
                for el in root.iter():
                    if el.tag.endswith("}fieldBegin") and el.get("name"):
                        slots.append({"id": el.get("name"), "kind": "field", "ref": name})
        # 중복 제거 (같은 placeholder가 여러 번 등장 가능 — 첫 위치만)
        seen, unique = set(), []
        for s in slots:
            key = (s["id"], s["kind"])
            if key not in seen:
                seen.add(key)
                unique.append(s)
        return {"ok": True, "slots": unique}
    except Exception as e:
        return {"ok": False, "error": f"HWPX 슬롯 추출 실패: {e}"}


def _extract_xlsx(p: Path) -> dict:
    slots: list[dict] = []
    try:
        wb = openpyxl.load_workbook(p, data_only=False)
        for ws in wb.worksheets:
            for row in ws.iter_rows():
                for cell in row:
                    if isinstance(cell.value, str):
                        m = PLACEHOLDER.search(cell.value)
                        if m:
                            slots.append({"id": m.group(1), "kind": "cell",
                                          "ref": f"{ws.title}!{cell.coordinate}"})
        return {"ok": True, "slots": slots}
    except Exception as e:
        return {"ok": False, "error": f"XLSX 슬롯 추출 실패: {e}"}
