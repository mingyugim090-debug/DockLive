"""소스 문서 파싱 도구 (Phase 4에서 본격 구현). HWPX 규약은 hwpx-pipeline 스킬 참조."""
from __future__ import annotations

import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def _ok(data) -> dict:
    return {"ok": True, "data": data}


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


def list_files(dir_path: str) -> dict:
    p = Path(dir_path)
    if not p.is_dir():
        return _err(f"폴더가 없음: {dir_path}")
    files = sorted(f.name for f in p.iterdir() if f.is_file())
    return _ok(files)


def read_document(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return _err(f"파일이 없음: {path}")
    suffix = p.suffix.lower()
    if suffix == ".hwpx":
        return _read_hwpx(p)
    if suffix == ".docx":
        return _err("DOCX 파싱은 Phase 4에서 구현 예정 (python-docx)")
    if suffix == ".pdf":
        return _err("PDF 파싱은 Phase 4에서 구현 예정 (pypdf)")
    return _err(f"지원하지 않는 형식: {suffix}")


def _read_hwpx(p: Path) -> dict:
    """HWPX(zip+xml)에서 본문 텍스트를 문단 단위로 추출."""
    try:
        paragraphs: list[str] = []
        with zipfile.ZipFile(p) as zf:
            sections = sorted(n for n in zf.namelist()
                              if n.startswith("Contents/section") and n.endswith(".xml"))
            for name in sections:
                root = ET.fromstring(zf.read(name))
                for para in root.iter():
                    if para.tag.endswith("}p"):
                        text = "".join(
                            t.text or "" for t in para.iter() if t.tag.endswith("}t")
                        )
                        if text.strip():
                            paragraphs.append(text.strip())
        return _ok({"file": p.name, "paragraphs": paragraphs[:500]})
    except Exception as ex:
        return _err(f"HWPX 파싱 실패: {ex}")
