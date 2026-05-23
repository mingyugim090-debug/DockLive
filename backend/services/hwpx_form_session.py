from __future__ import annotations

import base64
import json
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from copy import deepcopy
from pathlib import Path
from typing import Any

from core.errors import AnalysisError
from models.schemas import utc_now_iso
from services import storage
from services.ai_provider import call_json, should_use_mock_ai
from services.document_ingestion import convert_hwp_to_hwpx
from services.drafting_service import _require_hwpx_scripts, _run_hwpx_command, _safe_title
from services.hwpx_template_analysis import analyze_hwpx_template_bytes
from services.pdf_export_service import convert_hwpx_bytes_to_pdf

HWPX_MEDIA_TYPE = "application/vnd.hancom.hwpx"


def create_form_session(raw_content: bytes, filename: str) -> dict[str, Any]:
    if not filename or not re.search(r"\.(hwp|hwpx)$", filename, re.I):
        raise AnalysisError("HWP 또는 HWPX 파일만 업로드할 수 있습니다.")

    warnings: list[str] = []
    source_filename = filename
    hwpx_content = raw_content
    if filename.lower().endswith(".hwp") and not filename.lower().endswith(".hwpx"):
        hwpx_content, conversion_warnings = convert_hwp_to_hwpx(raw_content, filename)
        warnings.extend(conversion_warnings)
        source_filename = f"{Path(filename).stem}.hwpx"

    if not hwpx_content.startswith(b"PK"):
        raise AnalysisError("업로드한 파일이 올바른 HWPX ZIP 패키지가 아닙니다.")

    session_id = f"hwpx-{uuid.uuid4().hex}"
    analysis = analyze_hwpx_template_bytes(hwpx_content, source_filename)
    pages, text_boxes, render_warnings = _render_hwpx_pages(hwpx_content, source_filename, analysis.get("preview_image"))
    warnings.extend(render_warnings)
    regions = _extract_editable_regions(hwpx_content, max(1, len(pages)))
    if not regions:
        warnings.append("편집 가능한 입력 영역을 자동으로 찾지 못했습니다. 문서 전체 요약 영역을 대신 제공합니다.")
        regions = [_fallback_region()]
    position_warnings = _assign_region_bboxes(regions, text_boxes, max(1, len(pages)))
    warnings.extend(position_warnings)

    stored = storage.save_source_file(session_id, source_filename, hwpx_content, HWPX_MEDIA_TYPE)
    now = utc_now_iso()
    session = {
        "id": session_id,
        "source_filename": source_filename,
        "canonical_hwpx_storage_path": (stored or {}).get("storage_path"),
        "source_hwpx_base64": base64.b64encode(hwpx_content).decode("ascii"),
        "analysis": {
            "id": session_id,
            "title": analysis.get("title") or Path(source_filename).stem,
            "organization": analysis.get("organization") or "",
            "summary": analysis.get("summary") or "",
            "stats": analysis.get("stats") or {},
            "blocks": analysis.get("blocks") or [],
            "fields": analysis.get("fields") or [],
            "sections": analysis.get("sections") or [],
            "attachments": analysis.get("attachments") or [],
            "preview_image": analysis.get("preview_image"),
        },
        "pages": pages,
        "regions": regions,
        "status": "analyzed",
        "warnings": list(dict.fromkeys(warnings + analysis.get("warnings", []))),
        "created_at": now,
        "updated_at": now,
    }
    _save_session(session)
    return _public_session(session)


def get_form_session(session_id: str) -> dict[str, Any]:
    return _public_session(_load_session(session_id))


def update_region(session_id: str, region_id: str, value: str = "", prompt: str = "") -> dict[str, Any]:
    session = _load_session(session_id)
    region = _find_region(session, region_id)
    region["value"] = value
    region["prompt"] = prompt
    region["draft_status"] = "revised" if value.strip() else "empty"
    session["status"] = "editing"
    session["updated_at"] = utc_now_iso()
    _save_session(session)
    return _public_session(session)


def add_component(session_id: str, kind: str = "textarea", label: str = "", value: str = "") -> dict[str, Any]:
    session = _load_session(session_id)
    component_kind = kind if kind in {"text", "textarea", "signature", "table"} else "textarea"
    label = (label or _default_component_label(component_kind)).strip()
    region = {
        "id": f"component-{uuid.uuid4().hex[:16]}",
        "kind": component_kind,
        "label": label,
        "display_order": len(session.get("regions", [])) + 1,
        "page_index": max(0, len(session.get("pages") or []) - 1),
        "bbox": {"x": 1.0, "y": 92.0, "width": 98.0, "height": 5.0},
        "value": (value or _default_component_value(component_kind)).strip(),
        "prompt": "",
        "draft_status": "revised" if value.strip() else "empty",
        "source_ref": {
            "type": "append_block",
            "component": component_kind,
            "section_path": "Contents/section0.xml",
        },
    }
    session.setdefault("regions", []).append(region)
    _normalize_region_layout(session["regions"], max(1, len(session.get("pages") or [])))
    session["status"] = "editing"
    session["updated_at"] = utc_now_iso()
    _save_session(session)
    return _public_session(session)


def draft_region(session_id: str, region_id: str, base_input: str = "", prompt: str = "") -> dict[str, Any]:
    session = _load_session(session_id)
    region = _find_region(session, region_id)
    generated = _generate_region_text(session, region, base_input, prompt)
    region["value"] = generated
    region["prompt"] = prompt
    region["draft_status"] = "drafted"
    session["status"] = "editing"
    session["updated_at"] = utc_now_iso()
    _save_session(session)
    return _public_session(session)


def draft_session(
    session_id: str,
    brief: str = "",
    facts: str = "",
    tone: str = "",
    constraints: str = "",
) -> dict[str, Any]:
    session = _load_session(session_id)
    request = {
        "brief": brief.strip(),
        "facts": facts.strip(),
        "tone": tone.strip(),
        "constraints": constraints.strip(),
    }
    regions = session.get("regions", [])
    targets = [region for region in regions if _should_ai_fill_region(region)]
    if not targets:
        targets = [region for region in regions if not str(region.get("value") or "").strip()]

    generated, ai_summary, confirmation_required = _generate_session_region_values(session, targets, request)
    filled_count = 0
    for region in regions:
        value = str(generated.get(region.get("id"), "")).strip()
        if not value:
            continue
        if value == str(region.get("value") or "").strip():
            continue
        region["value"] = value
        region["prompt"] = _session_prompt_text(request)
        region["draft_status"] = "drafted"
        filled_count += 1

    confirmation_required.extend(_session_confirmation_items(session, targets))
    session["status"] = "editing"
    session["updated_at"] = utc_now_iso()
    _save_session(session)
    return {
        "success": True,
        "data": _public_session(session),
        "filled_region_count": filled_count,
        "confirmation_required": list(dict.fromkeys(item for item in confirmation_required if item)),
        "ai_summary": ai_summary or f"{filled_count}개 입력 영역을 요청사항 기준으로 채웠습니다.",
    }


def export_form_session(session_id: str) -> tuple[str, bytes, dict[str, Any]]:
    session = _load_session(session_id)
    source = base64.b64decode(session.get("source_hwpx_base64") or "")
    if not source.startswith(b"PK"):
        raise AnalysisError("원본 HWPX 파일을 세션에서 찾지 못했습니다.")

    scripts = _require_hwpx_scripts("fix_namespaces.py", "validate.py", "verify_hwpx.py", "text_extract.py")
    tmpdir = _tmp_root() / f"form_export_{uuid.uuid4().hex}"
    tmpdir.mkdir(parents=True, exist_ok=False)
    try:
        source_path = tmpdir / "source.hwpx"
        output_path = tmpdir / "result.hwpx"
        verify_path = tmpdir / "verify.json"
        source_path.write_bytes(source)
        _clone_with_region_replacements(source_path, output_path, session["regions"])

        python_bin = sys.executable or "python"
        _run_hwpx_command([python_bin, str(scripts["fix_namespaces.py"]), str(output_path)])
        _run_hwpx_command([python_bin, str(scripts["validate.py"]), str(output_path)])
        verify_report: dict[str, Any] = {}
        try:
            _run_hwpx_command(
                [
                    python_bin,
                    str(scripts["verify_hwpx.py"]),
                    "--source",
                    str(source_path),
                    "--result",
                    str(output_path),
                    "--json",
                    str(verify_path),
                ]
            )
            if verify_path.exists():
                verify_report = json.loads(verify_path.read_text(encoding="utf-8"))
        except subprocess.CalledProcessError as exc:
            raise AnalysisError(f"HWPX 구조 검증 실패: {(exc.stderr or exc.stdout or str(exc))[:700]}") from exc
        if verify_report.get("status") == "FAIL":
            issues = verify_report.get("issues") or verify_report.get("errors") or []
            detail = "; ".join(str(item) for item in issues[:5]) if isinstance(issues, list) else str(issues)
            raise AnalysisError(f"HWPX 구조 검증 실패: {detail or '원본 대비 구조 보존 검증을 통과하지 못했습니다.'}")

        extracted = ""
        try:
            text_result = _run_hwpx_command([python_bin, str(scripts["text_extract.py"]), str(output_path), "--include-tables"])
            extracted = text_result.stdout or ""
        except Exception:
            extracted = _zip_text_excerpt(output_path)

        inserted = [
            r.get("value", "").strip()
            for r in session["regions"]
            if r.get("value", "").strip() and r.get("draft_status") in {"drafted", "revised"}
        ]
        missing = [text[:40] for text in inserted if not _contains_loose(extracted, text)]
        if missing:
            detail = ", ".join(missing[:3])
            raise AnalysisError(f"다운로드 검증 실패: 입력한 내용 일부를 HWPX에서 확인하지 못했습니다. ({detail})")

        filename = f"{_safe_title(session.get('analysis', {}).get('title') or session['source_filename'])}_completed.hwpx"
        content = output_path.read_bytes()
        summary = {
            "validation_passed": True,
            "structure_preserved": verify_report.get("status") in {"PASS", "WARN", None},
            "verify_report": verify_report,
            "text_chars": len(extracted),
            "warnings": verify_report.get("warnings", []),
            "generation_method": "source-clone-region-replacement",
        }
        storage.save_export_file(session_id, filename, content, HWPX_MEDIA_TYPE, "hwpx_form_session", validation_summary=summary)
        session["status"] = "exported"
        session["updated_at"] = utc_now_iso()
        _save_session(session)
        return filename, content, summary
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _render_hwpx_pages(content: bytes, filename: str, preview_image: str | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    try:
        _, pdf_content, _ = convert_hwpx_bytes_to_pdf(content, Path(filename).stem, filename)
        import fitz

        doc = fitz.open(stream=pdf_content, filetype="pdf")
        pages: list[dict[str, Any]] = []
        text_boxes: list[dict[str, Any]] = []
        for index, page in enumerate(doc):
            text_boxes.extend(_extract_pdf_text_boxes(page, index))
            pix = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
            image = base64.b64encode(pix.tobytes("png")).decode("ascii")
            pages.append({"page_index": index, "image_base64": f"data:image/png;base64,{image}", "width": pix.width, "height": pix.height})
        if pages:
            return pages, text_boxes, warnings
    except Exception as exc:
        warnings.append(f"HWPX 페이지 렌더링은 PDF 변환기를 사용할 수 없어 preview 이미지로 대체했습니다: {str(exc)[:180]}")

    if preview_image:
        return [{"page_index": 0, "image_base64": preview_image, "width": 900, "height": 1200}], [], warnings

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">'
        '<rect width="100%" height="100%" fill="#fff"/>'
        '<text x="450" y="560" text-anchor="middle" font-size="28" fill="#334155">HWPX preview unavailable</text>'
        '<text x="450" y="610" text-anchor="middle" font-size="18" fill="#64748b">Edit regions are available in the side panel.</text>'
        "</svg>"
    )
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return [{"page_index": 0, "image_base64": f"data:image/svg+xml;base64,{encoded}", "width": 900, "height": 1200}], [], warnings


def _extract_pdf_text_boxes(page: Any, page_index: int) -> list[dict[str, Any]]:
    page_width = max(float(page.rect.width), 1.0)
    page_height = max(float(page.rect.height), 1.0)
    boxes: list[dict[str, Any]] = []
    order = 0
    raw = page.get_text("dict") or {}
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        block_text_parts: list[str] = []
        block_bbox: list[float] | None = None
        for line in block.get("lines", []):
            line_text = "".join(str(span.get("text") or "") for span in line.get("spans", [])).strip()
            if not line_text:
                continue
            line_bbox = _union_bbox([span.get("bbox") for span in line.get("spans", [])])
            if line_bbox:
                boxes.append(_pdf_box(page_index, order, line_text, line_bbox, page_width, page_height, "line"))
                order += 1
                block_bbox = _merge_bbox(block_bbox, line_bbox)
            block_text_parts.append(line_text)
            for span in line.get("spans", []):
                span_text = str(span.get("text") or "").strip()
                if not span_text or span_text == line_text:
                    continue
                bbox = span.get("bbox")
                if bbox:
                    boxes.append(_pdf_box(page_index, order, span_text, bbox, page_width, page_height, "span"))
                    order += 1
        block_text = " ".join(block_text_parts).strip()
        if block_text and block_bbox:
            boxes.append(_pdf_box(page_index, order, block_text, block_bbox, page_width, page_height, "block"))
            order += 1
    return boxes


def _pdf_box(page_index: int, order: int, text: str, bbox: Any, page_width: float, page_height: float, kind: str) -> dict[str, Any]:
    x0, y0, x1, y1 = [float(value) for value in bbox]
    return {
        "page_index": page_index,
        "order": order,
        "kind": kind,
        "text": _clean_label(text),
        "norm": _match_key(text),
        "bbox": {
            "x": max(0.0, min(99.0, (x0 / page_width) * 100)),
            "y": max(0.0, min(99.0, (y0 / page_height) * 100)),
            "width": max(0.5, min(100.0, ((x1 - x0) / page_width) * 100)),
            "height": max(0.4, min(100.0, ((y1 - y0) / page_height) * 100)),
        },
    }


def _union_bbox(items: list[Any]) -> list[float] | None:
    bbox: list[float] | None = None
    for item in items:
        if not item:
            continue
        bbox = _merge_bbox(bbox, item)
    return bbox


def _merge_bbox(left: list[float] | None, right: Any) -> list[float]:
    values = [float(value) for value in right]
    if left is None:
        return values
    return [
        min(left[0], values[0]),
        min(left[1], values[1]),
        max(left[2], values[2]),
        max(left[3], values[3]),
    ]


def _extract_editable_regions(content: bytes, page_count: int) -> list[dict[str, Any]]:
    regions: list[dict[str, Any]] = []
    with zipfile.ZipFile(_Bytes(content), "r") as zf:
        section_names = sorted(name for name in zf.namelist() if name.startswith("Contents/section") and name.endswith(".xml"))
        for section_path in section_names:
            root = _xml_root(zf.read(section_path))
            table_index = 0
            paragraph_index = 0
            for para in _children(root, "p"):
                current_paragraph_index = paragraph_index
                paragraph_index += 1
                tables = [node for node in para.iter() if _local(node.tag) == "tbl"]
                if tables:
                    for table in tables:
                        regions.extend(_table_regions(section_path, table, table_index, len(regions), page_count))
                        table_index += 1
                    continue
                text = _node_text(para)
                if _should_expose_paragraph(text):
                    kind = "textarea" if len(text) > 80 or _is_long_text_label(text) else "text"
                    regions.append(
                        _region(
                            section_path,
                            kind,
                            len(regions),
                            page_count,
                            _paragraph_label(text, current_paragraph_index),
                            text,
                            {
                                "type": "paragraph",
                                "section_path": section_path,
                                "paragraph_index": current_paragraph_index,
                            },
                        )
                    )
    return regions


def _table_regions(section_path: str, table: Any, table_index: int, start_order: int, page_count: int) -> list[dict[str, Any]]:
    rows = _children(table, "tr")
    regions: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows):
        cells = _children(row, "tc")
        texts = [_node_text(cell) for cell in cells]
        for cell_index, cell in enumerate(cells):
            text = texts[cell_index].strip()
            prev = texts[cell_index - 1].strip() if cell_index > 0 else ""
            next_text = texts[cell_index + 1].strip() if cell_index + 1 < len(texts) else ""
            label = _label_for_cell(prev, text, row_index, cell_index)
            kind = "textarea" if _is_long_text_label(label) else "text"
            order = start_order + len(regions)
            source_ref = {
                "type": "table_cell",
                "section_path": section_path,
                "table_index": table_index,
                "row": _int_attr(_first_child(cell, "cellAddr"), "rowAddr", row_index),
                "col": _int_attr(_first_child(cell, "cellAddr"), "colAddr", cell_index),
                "row_span": _int_attr(_first_child(cell, "cellSpan"), "rowSpan", 1),
                "col_span": _int_attr(_first_child(cell, "cellSpan"), "colSpan", 1),
                "cell_width": _int_attr(_first_child(cell, "cellSz"), "width", 0),
                "cell_height": _int_attr(_first_child(cell, "cellSz"), "height", 0),
                "original_text": text,
            }
            regions.append(_region(section_path, kind, order, page_count, label, text, source_ref))
    return regions


def _region(section_path: str, kind: str, order: int, page_count: int, label: str, value: str, source_ref: dict[str, Any]) -> dict[str, Any]:
    page_index = min(page_count - 1, order // 14)
    slot = order % 14
    return {
        "id": f"region-{uuid.uuid5(uuid.NAMESPACE_URL, section_path + json.dumps(source_ref, sort_keys=True)).hex[:16]}",
        "kind": kind,
        "label": _clean_label(label) or f"입력 영역 {order + 1}",
        "display_order": order + 1,
        "page_index": page_index,
        "bbox": {"x": 7.0, "y": 7.0 + slot * 6.2, "width": 86.0, "height": 5.4 if kind == "text" else 9.5},
        "value": value.strip(),
        "prompt": "",
        "draft_status": "empty",
        "source_ref": source_ref,
    }


def _assign_region_bboxes(regions: list[dict[str, Any]], text_boxes: list[dict[str, Any]], page_count: int) -> list[str]:
    if not text_boxes:
        _normalize_region_layout(regions, page_count)
        for region in regions:
            region.setdefault("source_ref", {})["bbox_status"] = "fallback"
        return ["원본 페이지 좌표를 추출하지 못해 입력 영역을 목록형 오버레이로 배치했습니다."]

    by_key: dict[str, list[dict[str, Any]]] = {}
    for box in sorted(text_boxes, key=lambda item: (item.get("page_index", 0), item.get("order", 0))):
        key = str(box.get("norm") or "")
        if key:
            by_key.setdefault(key, []).append(box)

    used: set[tuple[int, int]] = set()
    unmatched: list[dict[str, Any]] = []
    for region in sorted(regions, key=lambda item: int(item.get("display_order") or 0)):
        candidates = _region_match_keys(region)
        matched = _consume_text_box(by_key, candidates, used)
        if matched:
            padded = _pad_bbox(matched["bbox"], region)
            region["page_index"] = int(matched.get("page_index") or 0)
            region["bbox"] = padded
            source_ref = region.setdefault("source_ref", {})
            source_ref["bbox_status"] = "matched"
            source_ref["bbox_text"] = matched.get("text", "")
            source_ref["bbox_kind"] = matched.get("kind", "")
        else:
            region.setdefault("source_ref", {})["bbox_status"] = "unmatched"
            unmatched.append(region)

    _layout_unmatched_regions(unmatched, page_count)
    if unmatched:
        return [f"{len(unmatched)}개 입력 영역은 원본 위치를 확정하지 못해 위치 확인 필요 목록에 표시했습니다."]
    return []


def _region_match_keys(region: dict[str, Any]) -> list[str]:
    raw_values = [
        region.get("value", ""),
        region.get("label", ""),
        (region.get("source_ref") or {}).get("original_text", ""),
    ]
    keys: list[str] = []
    for value in raw_values:
        key = _match_key(str(value or ""))
        if key and key not in keys:
            keys.append(key)
    return keys


def _consume_text_box(by_key: dict[str, list[dict[str, Any]]], candidates: list[str], used: set[tuple[int, int]]) -> dict[str, Any] | None:
    for key in candidates:
        for box in by_key.get(key, []):
            marker = (int(box.get("page_index") or 0), int(box.get("order") or 0))
            if marker not in used:
                used.add(marker)
                return box
    for key in candidates:
        if len(key) < 3:
            continue
        for box_key, boxes in by_key.items():
            if key not in box_key and box_key not in key:
                continue
            for box in boxes:
                marker = (int(box.get("page_index") or 0), int(box.get("order") or 0))
                if marker not in used:
                    used.add(marker)
                    return box
    return None


def _pad_bbox(bbox: dict[str, float], region: dict[str, Any]) -> dict[str, float]:
    kind = region.get("kind")
    text = str(region.get("value") or "")
    x = float(bbox.get("x") or 0)
    y = float(bbox.get("y") or 0)
    width = float(bbox.get("width") or 1)
    height = float(bbox.get("height") or 1)
    pad_x = 1.2
    pad_y = 0.6
    if (region.get("source_ref") or {}).get("type") == "table_cell":
        pad_x = 2.0
        pad_y = 0.9
    if kind == "textarea" or len(text) > 50:
        height = max(height, 3.2)
    return {
        "x": max(0.0, x - pad_x),
        "y": max(0.0, y - pad_y),
        "width": min(100.0 - max(0.0, x - pad_x), max(width + pad_x * 2, 3.0)),
        "height": min(100.0 - max(0.0, y - pad_y), max(height + pad_y * 2, 2.0)),
    }


def _layout_unmatched_regions(regions: list[dict[str, Any]], page_count: int) -> None:
    if not regions:
        return
    page_count = max(1, page_count)
    for index, region in enumerate(regions):
        page_index = min(page_count - 1, index // 12)
        slot = index % 12
        region["page_index"] = page_index
        region["bbox"] = {"x": 2.0, "y": 3.0 + slot * 4.8, "width": 20.0, "height": 3.4}


def _match_key(value: str) -> str:
    return re.sub(r"\s+", "", html_unescape(value)).strip()


def _contains_loose(haystack: str, needle: str) -> bool:
    cleaned = _match_key(needle)
    if not cleaned:
        return True
    return cleaned[: min(20, len(cleaned))] in _match_key(haystack)


def html_unescape(value: str) -> str:
    import html

    return html.unescape(value or "")


def _normalize_region_layout(regions: list[dict[str, Any]], page_count: int) -> None:
    if not regions:
        return
    page_count = max(1, page_count)
    if page_count <= 1:
        page_size = len(regions)
    else:
        page_size = max(1, (len(regions) + page_count - 1) // page_count)

    for index, region in enumerate(regions):
        page_index = min(page_count - 1, index // page_size)
        page_position = index % page_size
        current_page_count = min(page_size, len(regions) - page_index * page_size)
        denominator = max(current_page_count - 1, 1)
        y = 4.0 + (page_position / denominator) * 88.0
        height = 3.6 if region.get("kind") == "text" else 5.2
        region["display_order"] = index + 1
        region["page_index"] = page_index
        region["bbox"] = {
            "x": 1.0,
            "y": min(93.0, y),
            "width": 98.0,
            "height": height,
        }


def _default_component_label(kind: str) -> str:
    return {
        "table": "추가 표",
        "signature": "서명란",
        "text": "추가 문구",
        "textarea": "추가 작성 영역",
    }.get(kind, "추가 작성 영역")


def _default_component_value(kind: str) -> str:
    if kind == "table":
        return "항목 | 내용\n--- | ---\n"
    if kind == "signature":
        return "2026년    월    일\n성명:                 (서명 또는 인)"
    if kind == "text":
        return "추가 문구를 입력하세요."
    return ""


def _fallback_draft_text(session: dict[str, Any], region: dict[str, Any], base_input: str, prompt: str) -> str:
    label = str(region.get("label") or "해당 항목").strip()
    current = str(region.get("value") or "").strip()
    facts = base_input.strip() or current
    request = prompt.strip()
    if region.get("kind") in {"text", "checkbox", "signature"}:
        return facts or current or request or f"{label} 입력값"

    title = str(session.get("analysis", {}).get("title") or "신청서").strip()
    lines = [
        f"{title}의 {label} 항목에 맞춰 작성한 초안입니다.",
        facts or "사용자가 제공한 기본 정보를 바탕으로 목적과 필요성을 구체적으로 정리합니다.",
    ]
    if request:
        lines.append(f"요청사항을 반영하여 {request} 방향으로 문장을 다듬었습니다.")
    lines.append("제출 전 실제 경험, 일정, 금액, 성명처럼 사실 확인이 필요한 내용은 한 번 더 확인해 주세요.")
    return "\n".join(lines)


def _generate_region_text(session: dict[str, Any], region: dict[str, Any], base_input: str, prompt: str) -> str:
    fallback = _fallback_draft_text(session, region, base_input, prompt)
    if should_use_mock_ai():
        return fallback
    system_prompt = "You write concise Korean application-form content. Return JSON only."
    user_prompt = json.dumps(
        {
            "document": session.get("analysis", {}),
            "field_label": region.get("label"),
            "current_value": region.get("value", ""),
            "base_input": base_input,
            "user_prompt": prompt,
            "rules": ["Do not invent personal data, dates, amounts, or signatures.", "Write only content for this field."],
        },
        ensure_ascii=False,
    )
    try:
        data = call_json("draft", system_prompt, user_prompt, max_tokens=1400)
        return str(data.get("content") or data.get("text") or fallback).strip()
    except Exception:
        return fallback


def _generate_session_region_values(
    session: dict[str, Any],
    targets: list[dict[str, Any]],
    request: dict[str, str],
) -> tuple[dict[str, str], str, list[str]]:
    if should_use_mock_ai():
        values = {
            str(region.get("id")): _session_fallback_value(session, region, request)
            for region in targets
            if _session_fallback_value(session, region, request)
        }
        return values, f"{len(values)}개 입력 영역을 로컬 작성 규칙으로 채웠습니다.", _request_confirmation_items(request)

    schema = {
        "type": "object",
        "properties": {
            "fields": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "region_id": {"type": "string"},
                        "value": {"type": "string"},
                    },
                    "required": ["region_id", "value"],
                    "additionalProperties": False,
                },
            },
            "ai_summary": {"type": "string"},
            "confirmation_required": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["fields", "ai_summary", "confirmation_required"],
        "additionalProperties": False,
    }
    system_prompt = (
        "당신은 한국 공공기관 공고문/HWPX 양식 작성 전문가입니다. "
        "사용자가 제공한 사실만 사용해 업로드된 양식의 입력칸을 채웁니다. "
        "기관명, 날짜, 금액, 서명, 연락처처럼 확인이 필요한 값은 임의로 만들지 말고 제공된 정보가 없으면 빈 문자열을 반환합니다. "
        "응답은 JSON만 반환합니다."
    )
    user_prompt = json.dumps(
        {
            "document": session.get("analysis", {}),
            "request": request,
            "regions": [
                {
                    "region_id": region.get("id"),
                    "label": region.get("label"),
                    "kind": region.get("kind"),
                    "current_value": region.get("value"),
                    "source_ref": region.get("source_ref"),
                }
                for region in targets[:80]
            ],
            "rules": [
                "각 value에는 해당 region에 들어갈 내용만 작성",
                "라벨/표 머리글은 다시 쓰지 않음",
                "공고문 문체는 간결하고 공식적으로 작성",
                "확인 불가한 사실은 confirmation_required에 적고 value는 비워 둠",
            ],
        },
        ensure_ascii=False,
    )
    try:
        data = call_json("draft", system_prompt, user_prompt, max_tokens=4096, json_schema=schema, schema_name="hwpx_session_draft")
    except Exception:
        values = {
            str(region.get("id")): _session_fallback_value(session, region, request)
            for region in targets
            if _session_fallback_value(session, region, request)
        }
        return values, f"{len(values)}개 입력 영역을 로컬 작성 규칙으로 채웠습니다.", _request_confirmation_items(request)

    values: dict[str, str] = {}
    target_ids = {str(region.get("id")) for region in targets}
    for item in data.get("fields") or []:
        if not isinstance(item, dict):
            continue
        region_id = str(item.get("region_id") or "")
        value = str(item.get("value") or "").strip()
        if region_id in target_ids and value:
            values[region_id] = value
    return (
        values,
        str(data.get("ai_summary") or "").strip(),
        [str(item).strip() for item in data.get("confirmation_required") or [] if str(item).strip()],
    )


def _should_ai_fill_region(region: dict[str, Any]) -> bool:
    label = str(region.get("label") or "")
    value = str(region.get("value") or "")
    source_ref = region.get("source_ref") or {}
    if source_ref.get("type") == "append_block":
        return False
    if _looks_like_title_label(label):
        return False
    if _is_placeholder(value):
        return True
    if not value.strip():
        return True
    if region.get("kind") == "textarea" and _is_long_text_label(label):
        return True
    if source_ref.get("type") == "paragraph" and _is_long_text_label(value):
        return True
    return False


def _session_fallback_value(session: dict[str, Any], region: dict[str, Any], request: dict[str, str]) -> str:
    label = str(region.get("label") or "입력 영역").strip()
    combined = "\n".join(value for value in request.values() if value).strip()
    if not combined:
        current = str(region.get("value") or "").strip()
        return "" if _is_placeholder(current) else current
    if any(token in label for token in ("기관", "소속", "담당")):
        return _extract_fact_line(request, ("기관", "부서", "소속")) or ""
    if any(token in label for token in ("일정", "기간", "일시", "월")):
        return _extract_fact_line(request, ("기간", "일정", "일시", "마감")) or ""
    if any(token in label for token in ("연락처", "전화", "이메일", "메일")):
        return _extract_fact_line(request, ("연락처", "전화", "이메일", "메일")) or ""
    if any(token in label for token in ("서명", "성명", "대표")):
        return ""
    if region.get("kind") == "text":
        first = next((line.strip() for line in combined.splitlines() if line.strip()), "")
        return first[:120]
    title = str(session.get("analysis", {}).get("title") or "공고문").strip()
    tone = request.get("tone") or "공식적이고 간결한 문체"
    return (
        f"{title}의 {label} 항목은 사용자가 제공한 요청사항을 기준으로 작성합니다.\n"
        f"{combined[:700]}\n"
        f"문체: {tone}"
    ).strip()


def _extract_fact_line(request: dict[str, str], keywords: tuple[str, ...]) -> str:
    for value in request.values():
        for line in value.splitlines():
            if any(keyword in line for keyword in keywords):
                return line.strip()[:160]
    return ""


def _session_prompt_text(request: dict[str, str]) -> str:
    return "\n".join(
        f"{label}: {value}"
        for label, value in [
            ("공고 목적", request.get("brief", "")),
            ("핵심 정보", request.get("facts", "")),
            ("문체", request.get("tone", "")),
            ("제약사항", request.get("constraints", "")),
        ]
        if value
    )


def _request_confirmation_items(request: dict[str, str]) -> list[str]:
    missing = []
    if not request.get("brief"):
        missing.append("공고 목적")
    if not request.get("facts"):
        missing.append("대상, 일정, 제출방법 등 핵심 정보")
    return [f"확인 필요: {', '.join(missing)}"] if missing else []


def _session_confirmation_items(session: dict[str, Any], targets: list[dict[str, Any]]) -> list[str]:
    items: list[str] = []
    empty_targets = [region for region in targets if not str(region.get("value") or "").strip()]
    if empty_targets:
        labels = ", ".join(str(region.get("label") or "입력 영역") for region in empty_targets[:6])
        items.append(f"값이 비어 있어 직접 확인이 필요한 칸: {labels}")
    unmatched = [region for region in session.get("regions", []) if (region.get("source_ref") or {}).get("bbox_status") == "unmatched"]
    if unmatched:
        items.append(f"원본 위치 확인이 필요한 입력 영역 {len(unmatched)}개")
    return items


def _clone_with_region_replacements(source_path: Path, output_path: Path, regions: list[dict[str, Any]]) -> None:
    replacements_by_section: dict[str, list[dict[str, Any]]] = {}
    appends_by_section: dict[str, list[dict[str, Any]]] = {}
    for region in regions:
        value = str(region.get("value") or "").strip()
        source_ref = region.get("source_ref") or {}
        section_path = source_ref.get("section_path")
        if source_ref.get("type") == "append_block" and (value or region.get("label")):
            appends_by_section.setdefault(section_path or "Contents/section0.xml", []).append(region)
        elif section_path:
            replacements_by_section.setdefault(section_path, []).append(region)

    with zipfile.ZipFile(source_path, "r") as zin:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename in replacements_by_section:
                    data = _replace_section_xml(data, replacements_by_section[item.filename])
                if item.filename in appends_by_section:
                    data = _append_regions_to_section_xml(data, appends_by_section[item.filename])
                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data)


def _replace_section_xml(data: bytes, regions: list[dict[str, Any]]) -> bytes:
    root = _xml_root(data)
    for region in regions:
        source_ref = region.get("source_ref") or {}
        value = str(region.get("value") or "")
        if source_ref.get("type") == "table_cell":
            _replace_table_cell(root, source_ref, value)
        elif source_ref.get("type") == "paragraph":
            _replace_paragraph(root, source_ref, value)
    from lxml import etree

    return etree.tostring(root, encoding="utf-8", xml_declaration=True, standalone=True)


def _append_regions_to_section_xml(data: bytes, regions: list[dict[str, Any]]) -> bytes:
    root = _xml_root(data)
    template = _paragraph_template(root)
    next_id = _next_paragraph_id(root)
    for region in regions:
        for line in _append_component_lines(region):
            para = deepcopy(template) if template is not None else _make_simple_paragraph(next_id)
            next_id += 1
            para.set("id", str(next_id))
            _remove_section_properties(para)
            _set_first_text(para, line)
            root.append(para)
    from lxml import etree

    return etree.tostring(root, encoding="utf-8", xml_declaration=True, standalone=True)


def _paragraph_template(root: Any) -> Any | None:
    paragraphs = _children(root, "p")
    for para in reversed(paragraphs):
        if not any(_local(node.tag) == "tbl" for node in para.iter()):
            return para
    return paragraphs[-1] if paragraphs else None


def _next_paragraph_id(root: Any) -> int:
    ids: list[int] = []
    for para in _children(root, "p"):
        try:
            ids.append(int(para.get("id") or 0))
        except ValueError:
            continue
    return max(ids or [899000])


def _append_component_lines(region: dict[str, Any]) -> list[str]:
    label = str(region.get("label") or "추가 영역").strip()
    value = str(region.get("value") or "").strip()
    kind = str(region.get("kind") or "textarea")
    if kind == "table":
        rows = [line.strip() for line in value.splitlines() if line.strip() and set(line.strip()) != {"-"}]
        return [f"{label}:"] + rows if rows else [label]
    if kind == "signature":
        return [label] + ([value] if value else ["성명:                 (서명 또는 인)"])
    if value:
        return [f"{label}: {value}"]
    return [label]


def _remove_section_properties(node: Any) -> None:
    for child in list(node.iter()):
        if _local(child.tag) in {"secPr", "colPr"}:
            parent = child.getparent()
            if parent is not None:
                parent.remove(child)


def _make_simple_paragraph(paragraph_id: int) -> Any:
    from lxml import etree

    hp_ns = "http://www.hancom.co.kr/hwpml/2011/paragraph"
    para = etree.Element(
        f"{{{hp_ns}}}p",
        id=str(paragraph_id),
        paraPrIDRef="1",
        styleIDRef="0",
        pageBreak="0",
        columnBreak="0",
        merged="0",
    )
    run = etree.SubElement(para, f"{{{hp_ns}}}run", charPrIDRef="0")
    etree.SubElement(run, f"{{{hp_ns}}}t")
    return para


def _replace_table_cell(root: Any, source_ref: dict[str, Any], value: str) -> None:
    tables = [node for node in root.iter() if _local(node.tag) == "tbl"]
    table_index = int(source_ref.get("table_index") or 0)
    if table_index >= len(tables):
        return
    target_row = int(source_ref.get("row") or 0)
    target_col = int(source_ref.get("col") or 0)
    for row in _children(tables[table_index], "tr"):
        for cell in _children(row, "tc"):
            addr = _first_child(cell, "cellAddr")
            if _int_attr(addr, "rowAddr", -1) == target_row and _int_attr(addr, "colAddr", -1) == target_col:
                _set_first_text(cell, value)
                return


def _replace_paragraph(root: Any, source_ref: dict[str, Any], value: str) -> None:
    index = int(source_ref.get("paragraph_index") or 0)
    paragraphs = _children(root, "p")
    if index < len(paragraphs):
        _set_first_text(paragraphs[index], value)


def _set_first_text(node: Any, value: str) -> None:
    text_nodes = [child for child in node.iter() if _local(child.tag) == "t"]
    if text_nodes:
        text_nodes[0].text = value
        for extra in text_nodes[1:]:
            extra.text = ""
        return
    from lxml import etree

    hp_ns = "http://www.hancom.co.kr/hwpml/2011/paragraph"
    run = next((child for child in node.iter() if _local(child.tag) == "run"), None)
    if run is not None:
        text_node = etree.SubElement(run, f"{{{hp_ns}}}t")
        text_node.text = value


def _public_session(session: dict[str, Any]) -> dict[str, Any]:
    public = deepcopy(session)
    public.pop("source_hwpx_base64", None)
    return public


def _save_session(session: dict[str, Any]) -> None:
    storage.save_workflow(session["id"], session)


def _load_session(session_id: str) -> dict[str, Any]:
    session = storage.load_workflow(session_id)
    if not session:
        raise AnalysisError("HWPX 편집 세션을 찾지 못했습니다.")
    return session


def _find_region(session: dict[str, Any], region_id: str) -> dict[str, Any]:
    for region in session.get("regions", []):
        if region.get("id") == region_id:
            return region
    raise AnalysisError("선택한 HWPX 입력 영역을 찾지 못했습니다.")


def _tmp_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "outputs" / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


class _Bytes:
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


def _xml_root(data: bytes) -> Any:
    from lxml import etree

    return etree.fromstring(data, parser=etree.XMLParser(remove_blank_text=False, recover=False))


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _children(node: Any, name: str) -> list[Any]:
    return [child for child in list(node) if _local(child.tag) == name]


def _first_child(node: Any, name: str) -> Any | None:
    for child in list(node):
        if _local(child.tag) == name:
            return child
    return None


def _node_text(node: Any) -> str:
    return re.sub(r"\s+", " ", "".join(child.text or "" for child in node.iter() if _local(child.tag) == "t")).strip()


def _int_attr(node: Any | None, name: str, fallback: int) -> int:
    if node is None:
        return fallback
    try:
        return int(node.get(name) or fallback)
    except (TypeError, ValueError):
        return fallback


def _looks_editable_cell(text: str, prev: str, cell_index: int, next_text: str = "") -> bool:
    if cell_index == 0 and text and not _is_placeholder(text):
        return False
    if not text or _is_placeholder(text):
        return bool(prev and _looks_like_cell_label(prev) and not _looks_like_title_label(prev))
    if text.strip().endswith((":", "：")):
        return False
    if _looks_like_cell_label(text) and next_text:
        return False
    if prev and _looks_like_cell_label(prev) and not _looks_like_title_label(prev):
        return True
    return _is_long_text_label(prev)


def _is_placeholder(text: str) -> bool:
    value = text.strip()
    return (
        not value
        or value in {"입력 필요", "작성 필요", "기재", "해당 없음"}
        or "입력" in value
        or "작성" in value
        or value.startswith(("예)", "예시", "OO", "○○"))
    )


def _looks_like_cell_label(text: str) -> bool:
    value = re.sub(r"\s+", "", text.strip().rstrip(":："))
    if not value or len(value) > 35:
        return False
    if any(token in value for token in ("성명", "이름", "학과", "학번", "사번", "소속", "연락처", "이메일", "동아리명", "구분", "목표", "방법", "계획", "내용", "월")):
        return True
    return bool(re.fullmatch(r"[가-힣A-Za-z0-9/()·]+", value)) and len(value) <= 12


def _looks_like_title_label(text: str) -> bool:
    value = text.strip()
    return any(token in value for token in ("서식", "신청서", "계획서", "동의서", "공고", "안내"))


def _label_for_cell(prev: str, text: str, row: int, col: int) -> str:
    if prev and len(prev) <= 80:
        return prev
    if text and not _is_placeholder(text):
        return text[:40]
    return f"{row + 1}행 {col + 1}열"


def _is_long_text_label(label: str) -> bool:
    return any(token in label for token in ("소개", "동기", "계획", "내용", "목표", "방법", "사유", "자기", "활동"))


def _looks_like_writing_paragraph(text: str) -> bool:
    if any(token in text for token in ("LiveDock", "DockLive", "자동화 예시", "자동작성")):
        return False
    return 8 <= len(text) <= 120 and _is_long_text_label(text)


def _should_expose_paragraph(text: str) -> bool:
    value = text.strip()
    if not value:
        return False
    if any(token in value for token in ("LiveDock", "DockLive", "자동화 예시", "자동작성")):
        return False
    return True


def _paragraph_label(text: str, paragraph_index: int) -> str:
    value = re.sub(r"\s+", " ", text).strip()
    if len(value) <= 42:
        return value
    return f"{paragraph_index + 1}번 문단"


def _clean_label(label: str) -> str:
    return re.sub(r"[:：\s]+$", "", re.sub(r"\s+", " ", label)).strip()


def _fallback_region() -> dict[str, Any]:
    return {
        "id": "region-document-summary",
        "kind": "textarea",
        "label": "문서 입력 내용",
        "display_order": 1,
        "page_index": 0,
        "bbox": {"x": 8.0, "y": 10.0, "width": 84.0, "height": 12.0},
        "value": "",
        "prompt": "",
        "draft_status": "empty",
        "source_ref": {},
    }


def _zip_text_excerpt(path: Path) -> str:
    texts: list[str] = []
    with zipfile.ZipFile(path, "r") as zf:
        for name in zf.namelist():
            if name.startswith("Contents/") and name.endswith(".xml"):
                texts.append(re.sub(r"<[^>]+>", " ", zf.read(name).decode("utf-8", errors="replace")))
    return "\n".join(texts)[:200000]
