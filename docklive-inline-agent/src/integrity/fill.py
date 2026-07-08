from __future__ import annotations

import shutil
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import openpyxl


def dummy_value(slot: dict) -> str:
    base = f"[TEST:{slot['id']}]"
    max_chars = slot.get("max_chars")
    if isinstance(max_chars, int) and max_chars > 0:
        return base[:max_chars]
    return f"{base} deterministic fill value"


def fill_file(source: str | Path, target: str | Path, slots: list[dict]) -> dict:
    source_path = Path(source)
    target_path = Path(target)
    suffix = source_path.suffix.lower()
    if suffix == ".hwpx":
        return _fill_hwpx(source_path, target_path, slots)
    if suffix in {".xlsx", ".xlsm"}:
        return _fill_xlsx(source_path, target_path, slots)
    return {"ok": False, "error": f"unsupported form type: {suffix}"}


def _fill_hwpx(source: Path, target: Path, slots: list[dict]) -> dict:
    replacements = {
        f"{{{{{slot['id']}}}}}": escape(dummy_value(slot))
        for slot in slots
        if slot.get("kind") == "placeholder"
    }
    try:
        with zipfile.ZipFile(source) as original:
            names = original.namelist()
            items = {name: original.read(name) for name in names}

        for name in names:
            if not (name.startswith("Contents/section") and name.endswith(".xml")):
                continue
            text = items[name].decode("utf-8")
            for placeholder, value in replacements.items():
                text = text.replace(placeholder, value)
            items[name] = text.encode("utf-8")

        target.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as filled:
            if "mimetype" in items:
                info = zipfile.ZipInfo("mimetype")
                filled.writestr(info, items["mimetype"], compress_type=zipfile.ZIP_STORED)
            for name in names:
                if name == "mimetype":
                    continue
                filled.writestr(name, items[name])
    except Exception as exc:
        return {"ok": False, "error": f"failed to fill HWPX: {exc}"}
    return {"ok": True, "filled": len(replacements), "dst": str(target)}


def _fill_xlsx(source: Path, target: Path, slots: list[dict]) -> dict:
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        workbook = openpyxl.load_workbook(target)
        filled = 0
        for slot in slots:
            if slot.get("kind") != "cell":
                continue
            sheet_name, coord = str(slot["ref"]).split("!", 1)
            workbook[sheet_name][coord] = dummy_value(slot)
            filled += 1
        workbook.save(target)
    except Exception as exc:
        return {"ok": False, "error": f"failed to fill XLSX: {exc}"}
    return {"ok": True, "filled": filled, "dst": str(target)}
