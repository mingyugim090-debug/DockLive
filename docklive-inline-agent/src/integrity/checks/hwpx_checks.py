from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def check_zip_valid(path: Path) -> tuple[bool, str]:
    try:
        with zipfile.ZipFile(path) as package:
            infos = package.infolist()
            if not infos:
                return False, "empty zip package"
            first = infos[0]
            if first.filename != "mimetype":
                return False, "mimetype is not the first zip entry"
            if first.compress_type != zipfile.ZIP_STORED:
                return False, "mimetype is compressed instead of stored"
            mimetype = package.read("mimetype").decode("utf-8").strip()
            if mimetype != "application/hwp+zip":
                return False, f"unexpected mimetype: {mimetype}"
    except zipfile.BadZipFile:
        return False, "not a valid zip package"
    except Exception as exc:
        return False, f"zip validation failed: {exc}"
    return True, "zip and mimetype are valid"


def check_xml_wellformed(path: Path) -> tuple[bool, str]:
    broken: list[str] = []
    try:
        with zipfile.ZipFile(path) as package:
            for name in package.namelist():
                if not (name.endswith(".xml") or name.endswith(".hpf")):
                    continue
                try:
                    ET.fromstring(package.read(name))
                except ET.ParseError as exc:
                    broken.append(f"{name}: {exc}")
    except Exception as exc:
        return False, f"XML validation failed: {exc}"
    if broken:
        return False, "; ".join(broken[:5])
    return True, "all XML files are well formed"


def check_structure_preserved(original: Path, filled: Path) -> tuple[bool, str]:
    try:
        with zipfile.ZipFile(original) as original_zip, zipfile.ZipFile(filled) as filled_zip:
            original_names = set(original_zip.namelist())
            filled_names = set(filled_zip.namelist())
            if original_names != filled_names:
                added = sorted(filled_names - original_names)
                removed = sorted(original_names - filled_names)
                return False, f"package entries changed; added={added}, removed={removed}"
            changed: list[str] = []
            for name in sorted(original_names):
                if not name.endswith(".xml"):
                    continue
                if _signature(original_zip.read(name)) != _signature(filled_zip.read(name)):
                    changed.append(name)
    except Exception as exc:
        return False, f"structure comparison failed: {exc}"
    if changed:
        return False, f"XML structure changed: {changed[:5]}"
    return True, "XML tag structure is preserved"


def check_styles_untouched(original: Path, filled: Path) -> tuple[bool, str]:
    try:
        with zipfile.ZipFile(original) as original_zip, zipfile.ZipFile(filled) as filled_zip:
            style_names = [name for name in original_zip.namelist() if name.endswith("header.xml")]
            for name in style_names:
                if original_zip.read(name) != filled_zip.read(name):
                    return False, f"{name} changed"
    except Exception as exc:
        return False, f"style comparison failed: {exc}"
    return True, "style/header XML is unchanged"


def check_no_placeholder_left(filled: Path) -> tuple[bool, str]:
    leftovers: list[str] = []
    try:
        with zipfile.ZipFile(filled) as package:
            for name in package.namelist():
                if name.startswith("Contents/section") and name.endswith(".xml"):
                    text = package.read(name).decode("utf-8", errors="ignore")
                    leftovers.extend(re.findall(r"\{\{[^{}]+\}\}", text))
    except Exception as exc:
        return False, f"placeholder scan failed: {exc}"
    if leftovers:
        return False, f"leftover placeholders: {sorted(set(leftovers))[:5]}"
    return True, "no placeholders remain"


def _signature(xml_bytes: bytes) -> tuple:
    root = ET.fromstring(xml_bytes)

    def walk(element: ET.Element) -> tuple:
        return (element.tag, tuple(sorted(element.attrib.items())), tuple(walk(child) for child in list(element)))

    return walk(root)
