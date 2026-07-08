"""HWPX 라운드트립 무결성 검사. 각 검사는 (통과여부, 상세) 튜플을 반환한다."""
from __future__ import annotations

import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def check_zip_valid(path: Path) -> tuple[bool, str]:
    """C1: zip이 열리고 mimetype이 첫 엔트리 + 무압축 + 올바른 내용인가."""
    try:
        with zipfile.ZipFile(path) as zf:
            infos = zf.infolist()
            if not infos or infos[0].filename != "mimetype":
                return False, "mimetype이 첫 엔트리가 아님 — 한컴이 열지 못함"
            if infos[0].compress_type != zipfile.ZIP_STORED:
                return False, "mimetype이 압축됨(STORED 아님) — 한컴이 열지 못함"
            if zf.read("mimetype").decode().strip() != "application/hwp+zip":
                return False, "mimetype 내용이 application/hwp+zip이 아님"
        return True, "zip/mimetype 정상"
    except zipfile.BadZipFile:
        return False, "손상된 zip"


def check_xml_wellformed(path: Path) -> tuple[bool, str]:
    """C2: 모든 XML이 파싱 가능한가."""
    bad = []
    with zipfile.ZipFile(path) as zf:
        for name in zf.namelist():
            if name.endswith(".xml") or name.endswith(".hpf"):
                try:
                    ET.fromstring(zf.read(name))
                except ET.ParseError as e:
                    bad.append(f"{name}: {e}")
    return (not bad, "XML 전부 well-formed" if not bad else "; ".join(bad[:3]))


def _structure_signature(xml_bytes: bytes) -> list:
    """텍스트를 제외한 태그 트리 시그니처 — 구조 diff의 기준."""
    def walk(el) -> tuple:
        return (el.tag, tuple(sorted(el.attrib)), tuple(walk(c) for c in el))
    return [walk(ET.fromstring(xml_bytes))]


def check_structure_preserved(original: Path, filled: Path) -> tuple[bool, str]:
    """C3: 채움 전후 XML 태그 구조가 동일한가 (텍스트 내용만 달라야 함)."""
    diffs = []
    with zipfile.ZipFile(original) as zo, zipfile.ZipFile(filled) as zfd:
        o_names = set(zo.namelist())
        f_names = set(zfd.namelist())
        if o_names != f_names:
            return False, f"파일 목록 변경: 추가 {sorted(f_names - o_names)}, 삭제 {sorted(o_names - f_names)}"
        for name in sorted(o_names):
            if not name.endswith(".xml"):
                continue
            try:
                if _structure_signature(zo.read(name)) != _structure_signature(zfd.read(name)):
                    diffs.append(name)
            except ET.ParseError:
                diffs.append(f"{name}(파싱불가)")
    return (not diffs, "태그 구조 보존" if not diffs else f"구조 변형: {diffs}")


def check_styles_untouched(original: Path, filled: Path) -> tuple[bool, str]:
    """C4: header.xml(스타일 정의)이 바이트 단위로 동일한가."""
    with zipfile.ZipFile(original) as zo, zipfile.ZipFile(filled) as zfd:
        names = [n for n in zo.namelist() if n.endswith("header.xml")]
        for name in names:
            if zo.read(name) != zfd.read(name):
                return False, f"{name} 변경됨 — 스타일 오염"
    return True, "스타일(header.xml) 무변경"


def check_no_placeholder_left(filled: Path) -> tuple[bool, str]:
    """C5: 채움 후 {{플레이스홀더}}가 남아있지 않은가 (미채움 칸 감지)."""
    left = []
    with zipfile.ZipFile(filled) as zf:
        for name in zf.namelist():
            if name.startswith("Contents/section") and name.endswith(".xml"):
                text = zf.read(name).decode("utf-8", errors="ignore")
                import re
                left += re.findall(r"\{\{[^{}]+\}\}", text)
    return (not left, "미채움 칸 없음" if not left else f"미채움: {sorted(set(left))[:5]}")
