from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import openpyxl

PLACEHOLDER_RE = re.compile(r"\{\{([^{}]+)\}\}")


def extract_slots(path: str | Path) -> dict:
    source = Path(path)
    suffix = source.suffix.lower()
    if suffix == ".hwpx":
        return _extract_hwpx(source)
    if suffix in {".xlsx", ".xlsm"}:
        return _extract_xlsx(source)
    return {"ok": False, "error": f"unsupported form type: {suffix}"}


def _extract_hwpx(path: Path) -> dict:
    slots: list[dict] = []
    try:
        with zipfile.ZipFile(path) as package:
            section_names = sorted(
                name
                for name in package.namelist()
                if name.startswith("Contents/section") and name.endswith(".xml")
            )
            for section_name in section_names:
                xml_text = package.read(section_name).decode("utf-8")
                for match in PLACEHOLDER_RE.finditer(xml_text):
                    slots.append({"id": match.group(1).strip(), "kind": "placeholder", "ref": section_name})

                root = ET.fromstring(xml_text)
                for element in root.iter():
                    if element.tag.endswith("}fieldBegin") and element.get("name"):
                        slots.append({"id": element.get("name", "").strip(), "kind": "field", "ref": section_name})
    except Exception as exc:
        return {"ok": False, "error": f"failed to extract HWPX slots: {exc}"}
    return {"ok": True, "slots": _dedupe_slots(slots)}


def _extract_xlsx(path: Path) -> dict:
    slots: list[dict] = []
    try:
        workbook = openpyxl.load_workbook(path, data_only=False)
        for sheet in workbook.worksheets:
            for row in sheet.iter_rows():
                for cell in row:
                    if not isinstance(cell.value, str):
                        continue
                    for match in PLACEHOLDER_RE.finditer(cell.value):
                        slots.append(
                            {
                                "id": match.group(1).strip(),
                                "kind": "cell",
                                "ref": f"{sheet.title}!{cell.coordinate}",
                            }
                        )
    except Exception as exc:
        return {"ok": False, "error": f"failed to extract XLSX slots: {exc}"}
    return {"ok": True, "slots": _dedupe_slots(slots)}


def _dedupe_slots(slots: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict] = []
    for slot in slots:
        key = (str(slot.get("id", "")), str(slot.get("kind", "")), str(slot.get("ref", "")))
        if key in seen or not key[0]:
            continue
        seen.add(key)
        unique.append(slot)
    return unique
