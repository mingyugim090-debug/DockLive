import html
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


SECTION_RE = re.compile(r"^(\d+[\.\)]|[가-하]\.|[IVX]+\.)\s+")
TITLE_KEYWORDS = ("신청서", "계획서", "제안서", "공고", "안내문", "보고서", "동의서")
ORG_KEYWORDS = ("대학교", "대학", "재단", "기관", "센터", "지원단", "협회", "협의회", "연구원", "진흥원")
FIELD_LABEL_KEYWORDS = (
    "성명",
    "이름",
    "기관",
    "소속",
    "학과",
    "연락처",
    "이메일",
    "주소",
    "기간",
    "일정",
    "방법",
    "자격",
    "서류",
    "제목",
    "내용",
    "목적",
    "계획",
    "예산",
    "붙임",
    "문의",
)

FORBIDDEN_TERMS = (
    "LiveDock 자동작성 내용",
    "LiveDock: 자동작성 내용",
    "DockLive: 자동작성 내용",
    "자동작성 초안",
    "요약",
    "추가 입력 필요",
    "문서 제목:",
    "JSON 문자열",
    "{'",
    "'학과'",
    "'개인정보 수집",
    "documentType",
    "sections",
    "contact",
    "metadata",
)


def analyze_hwpx_template_bytes(content: bytes, source_filename: str) -> dict:
    """Return a screen-friendly representation of an uploaded HWPX form.

    The analysis intentionally stays read-only. It extracts paragraph and table
    order from HWPX XML so the frontend can render the user's actual form before
    any AI filling or download step happens.
    """
    if not content.startswith(b"PK"):
        raise ValueError("업로드한 파일이 HWPX ZIP 패키지 형식이 아닙니다.")

    blocks: list[dict] = []
    warnings: list[str] = []
    with zipfile.ZipFile(PathLikeBytes(content), "r") as zf:
        names = zf.namelist()
        section_names = sorted(
            name
            for name in names
            if name.startswith("Contents/section") and name.endswith(".xml")
        )
        if not section_names and "Contents/section0.xml" in names:
            section_names = ["Contents/section0.xml"]
        if not section_names:
            raise ValueError("HWPX 본문 XML(Contents/section*.xml)을 찾을 수 없습니다.")

        for section_index, name in enumerate(section_names):
            try:
                root = ElementTree.fromstring(zf.read(name))
            except ElementTree.ParseError as exc:
                warnings.append(f"{name} XML을 해석하지 못했습니다: {exc}")
                continue
            blocks.extend(_parse_section(root, section_index))

    _assign_roles(blocks)
    fields = _extract_fields(blocks)
    sections = _extract_sections(blocks)
    all_text = "\n".join(block.get("text", "") for block in blocks if block.get("text"))
    title = _guess_title(blocks, source_filename)
    organization = _guess_organization(all_text)

    return {
        "success": True,
        "source_filename": source_filename,
        "title": title,
        "organization": organization,
        "summary": _compact(all_text, 700),
        "blocks": blocks[:180],
        "fields": fields[:80],
        "sections": sections[:40],
        "attachments": _guess_attachments(all_text, fields),
        "stats": {
            "paragraphs": sum(1 for block in blocks if block["type"] == "paragraph"),
            "tables": sum(1 for block in blocks if block["type"] == "table"),
            "fields": len(fields),
            "sections": len(sections),
        },
        "warnings": warnings,
    }


class PathLikeBytes:
    """Small file-like wrapper so ZipFile can read in-memory bytes without tempfile churn."""

    def __init__(self, content: bytes):
        from io import BytesIO

        self._buffer = BytesIO(content)

    def read(self, *args):
        return self._buffer.read(*args)

    def seek(self, *args):
        return self._buffer.seek(*args)

    def tell(self):
        return self._buffer.tell()

    def seekable(self):
        return True


def _parse_section(root: ElementTree.Element, section_index: int) -> list[dict]:
    blocks: list[dict] = []
    metadata_started = False
    for child in list(root):
        if _local(child.tag) != "p":
            continue
        tables = [node for node in child.iter() if _local(node.tag) == "tbl"]
        if tables:
            for table in tables:
                rows = _parse_table(table)
                table_text = _table_to_text(rows)
                if _is_forbidden_text(table_text):
                    metadata_started = True
                    continue
                if metadata_started:
                    continue
                if rows:
                    blocks.append(
                        {
                            "id": f"s{section_index}-b{len(blocks)}",
                            "type": "table",
                            "role": "table",
                            "section_index": section_index,
                            "text": table_text,
                            "rows": rows,
                            "style": {"width": "100%"},
                        }
                    )
            continue

        text = _paragraph_text(child)
        if _is_forbidden_text(text):
            metadata_started = True
            continue
        if metadata_started:
            continue
        if text:
            block_type = "checkboxGroup" if _looks_like_checkbox_line(text) else "paragraph"
            blocks.append(
                {
                    "id": f"s{section_index}-b{len(blocks)}",
                    "type": block_type,
                    "role": "body",
                    "section_index": section_index,
                    "text": text,
                    "rows": [],
                    "style": _paragraph_style(child),
                    "options": _checkbox_options(text) if block_type == "checkboxGroup" else [],
                }
            )
    return blocks


def _parse_table(table: ElementTree.Element) -> list[list[dict]]:
    rows: list[list[dict]] = []
    for tr in [node for node in table.iter() if _local(node.tag) == "tr"]:
        cells: list[dict] = []
        direct_cells = [child for child in list(tr) if _local(child.tag) == "tc"]
        for tc in direct_cells:
            text_parts = [_paragraph_text(p) for p in tc.iter() if _local(p.tag) == "p"]
            text = _normalize_text(" ".join(part for part in text_parts if part))
            if text or len(direct_cells) > 1:
                cells.append(
                    {
                        "id": f"cell-{len(rows)}-{len(cells)}",
                        "text": text,
                        "row_span": _int_attr(tc, "rowSpan", 1),
                        "col_span": _int_attr(tc, "colSpan", 1),
                        "align": _table_cell_align(tc),
                        "vertical_align": _table_cell_vertical_align(tc),
                        "editable": _looks_editable_cell(text, len(cells)),
                    }
                )
        if cells:
            rows.append(cells)
    return rows


def _paragraph_text(paragraph: ElementTree.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        if _local(node.tag) == "t" and node.text:
            parts.append(node.text)
    return _normalize_text("".join(parts))


def _assign_roles(blocks: list[dict]) -> None:
    title_assigned = False
    for block in blocks:
        text = block.get("text", "")
        if block["type"] == "table":
            title = _title_from_table(block)
            if not title_assigned and title:
                block["role"] = "title"
                title_assigned = True
            continue
        if block["type"] in {"paragraph", "checkboxGroup"}:
            if not title_assigned and _looks_like_title(text):
                block["role"] = "title"
                block["type"] = "heading"
                block["style"] = {**block.get("style", {}), "align": "center", "bold": True, "fontSize": 22}
                title_assigned = True
            elif SECTION_RE.match(text) or _looks_like_section_heading(text):
                block["role"] = "heading"
                block["type"] = "heading"
                block["style"] = {**block.get("style", {}), "bold": True, "fontSize": 16}
            elif len(text) <= 60 and any(keyword in text for keyword in ("붙임", "문의", "안내", "개요")):
                block["role"] = "heading"
                block["type"] = "heading"
                block["style"] = {**block.get("style", {}), "bold": True, "fontSize": 15}


def _extract_fields(blocks: list[dict]) -> list[dict]:
    fields: list[dict] = []
    for block in blocks:
        if block["type"] != "table":
            continue
        for row in block.get("rows", []):
            cells = [cell.get("text", "").strip() for cell in row]
            for left, right in ((0, 1), (2, 3), (4, 5)):
                if len(cells) <= right:
                    continue
                label = _clean_label(cells[left])
                value = cells[right]
                if _looks_like_field_label(label):
                    fields.append(
                        {
                            "id": f"field_{len(fields) + 1}",
                            "label": label,
                            "value": value,
                            "required": not value or "확인 필요" in value or "원본" in value,
                            "block_id": block["id"],
                        }
                    )
    return fields


def _extract_sections(blocks: list[dict]) -> list[dict]:
    sections: list[dict] = []
    current: dict | None = None

    def flush() -> None:
        nonlocal current
        if current and (current["heading"] or current["body"].strip()):
            current["body"] = current["body"].strip()
            sections.append(current)
        current = None

    for block in blocks:
        text = block.get("text", "")
        if not text:
            continue
        if block.get("role") in {"heading", "title"} and len(text) <= 120:
            flush()
            current = {"heading": text, "body": "", "block_ids": [block["id"]]}
            continue
        if current is None:
            current = {"heading": "원본 양식 내용", "body": "", "block_ids": []}
        current["block_ids"].append(block["id"])
        addition = _compact(text, 900)
        if addition:
            current["body"] = f"{current['body']}\n{addition}".strip()
    flush()
    return sections


def _guess_title(blocks: list[dict], source_filename: str) -> str:
    for block in blocks:
        if block.get("role") == "title":
            return _compact(_title_from_table(block) or block["text"], 120)
    for block in blocks:
        text = block.get("text", "")
        if _looks_like_title(text):
            return _compact(text, 120)
    return Path(source_filename).stem.replace("_", " ").strip() or "업로드한 HWPX 양식"


def _guess_organization(text: str) -> str:
    for raw in text.splitlines():
        line = raw.strip()
        if 2 <= len(line) <= 80 and any(keyword in line for keyword in ORG_KEYWORDS):
            return line
    return ""


def _title_from_table(block: dict) -> str:
    for row in block.get("rows", []):
        for cell in row:
            text = cell.get("text", "")
            if _looks_like_title(text):
                return text
    return ""


def _guess_attachments(text: str, fields: list[dict]) -> list[str]:
    candidates: list[str] = []
    for field in fields:
        label = field.get("label", "")
        value = field.get("value", "")
        if "서류" in label or "붙임" in label:
            candidates.extend(re.split(r"[,/\n]", value))
    for raw in text.splitlines():
        if "붙임" in raw or "첨부" in raw or "제출 서류" in raw:
            candidates.append(raw)
    cleaned = [_clean_attachment(item) for item in candidates]
    return list(dict.fromkeys(item for item in cleaned if item))[:12]


def _looks_like_title(text: str) -> bool:
    compact = text.strip()
    return 6 <= len(compact) <= 120 and any(keyword in compact for keyword in TITLE_KEYWORDS)


def _looks_like_section_heading(text: str) -> bool:
    compact = text.strip()
    if not (2 <= len(compact) <= 70):
        return False
    return any(keyword in compact for keyword in ("개요", "자격", "기준", "방법", "계획", "내용", "일정", "서류", "문의"))


def _looks_like_field_label(text: str) -> bool:
    if not text or len(text) > 45:
        return False
    if any(keyword in text for keyword in FIELD_LABEL_KEYWORDS):
        return True
    return bool(re.fullmatch(r"[\w가-힣\s·/()]{1,24}", text)) and len(text.split()) <= 4


def _clean_label(text: str) -> str:
    return re.sub(r"[:：\s]+$", "", text.strip())


def _clean_attachment(text: str) -> str:
    value = re.sub(r"^[\s\d\.\-\)\(]+", "", text.strip())
    value = re.sub(r"\s*1부\.?$", "", value)
    return _compact(value, 80)


def _table_to_text(rows: list[list[dict]]) -> str:
    lines = []
    for row in rows:
        values = [cell.get("text", "") for cell in row if cell.get("text", "")]
        if values:
            lines.append(" | ".join(values))
    return "\n".join(lines)


def _int_attr(node: ElementTree.Element, local_name: str, default: int) -> int:
    for key, value in node.attrib.items():
        if _local(key) == local_name:
            try:
                return max(1, int(value))
            except ValueError:
                return default
    return default


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def _compact(text: str, limit: int) -> str:
    value = _normalize_text(text)
    return value[:limit].rstrip()


def _is_forbidden_text(value: str) -> bool:
    if not value:
        return False
    if any(term in value for term in FORBIDDEN_TERMS):
        return True
    return bool(re.search(r"\{\s*['\"](?:documentType|sections|contact|metadata)['\"]", value))


def _looks_like_checkbox_line(value: str) -> bool:
    return bool(re.search(r"[□☐☑■]", value))


def _checkbox_options(value: str) -> list[dict]:
    parts = [part.strip() for part in re.split(r"(?=[□☐☑■])", value) if part.strip()]
    return [
        {
            "id": f"option-{idx}",
            "label": re.sub(r"^[□☐☑■]\s*", "", part).strip(),
            "checked": part.startswith(("☑", "■")),
        }
        for idx, part in enumerate(parts)
    ]


def _paragraph_style(paragraph: ElementTree.Element) -> dict:
    text = _paragraph_text(paragraph)
    style: dict = {"align": "left", "fontSize": 12, "bold": False}
    if len(text) <= 80 and _looks_like_title(text):
        style.update({"align": "center", "fontSize": 22, "bold": True})
    elif _looks_like_section_heading(text) or SECTION_RE.match(text):
        style.update({"fontSize": 15, "bold": True})
    return style


def _table_cell_align(cell: ElementTree.Element) -> str:
    text = " ".join(_paragraph_text(p) for p in cell.iter() if _local(p.tag) == "p")
    return "center" if len(text.strip()) <= 20 else "left"


def _table_cell_vertical_align(cell: ElementTree.Element) -> str:
    for key, value in cell.attrib.items():
        if _local(key).lower() == "vertalign":
            lowered = value.lower()
            if "bottom" in lowered:
                return "bottom"
            if "top" in lowered:
                return "top"
    return "middle"


def _looks_editable_cell(text: str, cell_index: int) -> bool:
    clean = text.strip()
    if not clean:
        return True
    if cell_index == 0 and len(clean) <= 30:
        return False
    return any(keyword in clean for keyword in ("입력", "작성", "확인 필요", "OO", "000")) or cell_index % 2 == 1
