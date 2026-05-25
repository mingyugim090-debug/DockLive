import html
import json
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path

from core.errors import AnalysisError, InvalidFileTypeError, PDFParseError
from models.schemas import ParsedDocument, ParsedDocumentBlock, ParsedTable, ParsedTableCell
from services.drafting_service import _hwpx_subprocess_env, _require_hwpx_scripts
from services.hwpx_template_analysis import analyze_hwpx_template_bytes
from services.pdf_parser import extract_text_from_pdf

PDF_MAGIC = b"%PDF"
ZIP_MAGIC = b"PK"
OLE_MAGIC = bytes.fromhex("D0CF11E0A1B11AE1")


@dataclass(frozen=True)
class IngestedDocument:
    text: str
    source_type: str
    source_name: str
    warnings: list[str]
    parsed: ParsedDocument


def ingest_uploaded_document(content: bytes, filename: str) -> IngestedDocument:
    """Extract analyzable text from supported uploaded announcement files."""
    source_name = filename or "uploaded_document"
    detected_type, detection_warnings = detect_uploaded_document_type(content, source_name)
    if detected_type == "pdf":
        text = extract_text_from_pdf(content, source_name)
        parsed = _parsed_text_document(text, "pdf", source_name, detection_warnings)
        return IngestedDocument(text=parsed.text, source_type="pdf", source_name=source_name, warnings=parsed.warnings, parsed=parsed)
    if detected_type == "hwpx":
        parsed = parse_hwpx_document(content, source_name, source_type="hwpx", extra_warnings=detection_warnings)
        return IngestedDocument(text=parsed.text, source_type="hwpx", source_name=source_name, warnings=parsed.warnings, parsed=parsed)
    if detected_type == "hwp":
        parsed = parse_hwp_document(content, source_name, extra_warnings=detection_warnings)
        return IngestedDocument(text=parsed.text, source_type="hwp", source_name=source_name, warnings=parsed.warnings, parsed=parsed)
    raise InvalidFileTypeError("지원하지 않는 파일 형식입니다. PDF, HWPX, HWP 파일을 업로드해 주세요.")


def detect_uploaded_document_type(content: bytes, filename: str) -> tuple[str, list[str]]:
    """Classify supported uploads by extension and file magic.

    HWPX is a ZIP package and legacy HWP is an OLE compound binary. Extension
    mismatch is tolerated when the magic number is clear, because users often
    download public forms with inconsistent MIME metadata.
    """
    suffix = Path(filename or "").suffix.lower()
    warnings: list[str] = []
    header = content[:16]

    if header.startswith(PDF_MAGIC):
        if suffix and suffix != ".pdf":
            warnings.append(f"확장자는 {suffix}이지만 PDF 매직 넘버가 감지되어 PDF로 처리했습니다.")
        return "pdf", warnings
    if header.startswith(ZIP_MAGIC):
        if suffix == ".hwp":
            warnings.append("확장자는 .hwp이지만 ZIP 기반 HWPX 패키지로 감지되어 HWPX로 처리했습니다.")
        elif suffix and suffix != ".hwpx":
            warnings.append(f"확장자는 {suffix}이지만 ZIP 기반 HWPX 패키지로 감지되어 HWPX로 처리했습니다.")
        return "hwpx", warnings
    if header.startswith(OLE_MAGIC):
        if suffix == ".hwpx":
            warnings.append("확장자는 .hwpx이지만 OLE 기반 레거시 HWP로 감지되어 HWP로 처리했습니다.")
        return "hwp", warnings

    if suffix in {".pdf", ".hwpx", ".hwp"}:
        warnings.append("파일 매직 넘버를 확인하지 못해 확장자 기준으로 처리합니다.")
        return suffix.lstrip("."), warnings
    return "unsupported", warnings


def parse_hwpx_document(
    content: bytes,
    filename: str,
    *,
    source_type: str = "hwpx",
    extra_warnings: list[str] | None = None,
    metadata: dict | None = None,
) -> ParsedDocument:
    """Parse a HWPX package into LiveDock's normalized document shape."""
    warnings = list(extra_warnings or [])
    try:
        analysis = analyze_hwpx_template_bytes(content, filename)
    except ValueError as exc:
        raise AnalysisError(str(exc)) from exc

    warnings.extend(str(item) for item in analysis.get("warnings", []) if str(item).strip())
    text = ""
    try:
        text, text_warnings = extract_text_from_hwpx(content)
        warnings.extend(text_warnings)
    except Exception as exc:
        warnings.append(f"HWPX 텍스트 추출기를 사용하지 못해 구조 분석 결과로 본문을 구성했습니다: {exc}")

    return _parsed_document_from_hwpx_analysis(
        analysis,
        source_type=source_type,
        source_name=filename,
        text=text,
        warnings=warnings,
        metadata=metadata,
    )


def parse_hwp_document(content: bytes, filename: str, extra_warnings: list[str] | None = None) -> ParsedDocument:
    """Parse legacy HWP through the pure-Python HWP→HWPX path, then normalize."""
    converted, conversion_warnings = convert_hwp_to_hwpx(content, filename)
    metadata = {
        "original_source_type": "hwp",
        "canonical_format": "hwpx",
        "canonical_source_name": f"{Path(filename or 'input.hwp').stem}.hwpx",
        "parser": "pyhwp/hwp2hwpx-python-refactor",
    }
    return parse_hwpx_document(
        converted,
        filename,
        source_type="hwp",
        extra_warnings=[*(extra_warnings or []), *conversion_warnings],
        metadata=metadata,
    )


def extract_text_from_hwpx(content: bytes) -> tuple[str, list[str]]:
    """Extract text from HWPX with the toolchain script, falling back to ZIP XML parsing."""
    if not content.startswith(b"PK"):
        raise AnalysisError("업로드한 HWPX 파일이 ZIP 패키지 형식이 아닙니다.")

    warnings: list[str] = []
    tmpdir = _make_tmp_dir()
    try:
        path = tmpdir / "input.hwpx"
        path.write_bytes(content)

        try:
            scripts = _require_hwpx_scripts("text_extract.py")
            completed = subprocess.run(
                [sys.executable or "python", str(scripts["text_extract.py"]), str(path), "--include-tables"],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            text = completed.stdout.strip()
            if len(text) < 20:
                warnings.append("text_extract.py 결과가 비어 있어 ZIP XML fallback을 사용했습니다.")
                text = _extract_text_from_hwpx_zip(path)
        except Exception as exc:
            warnings.append(f"text_extract.py 실패로 ZIP XML fallback을 사용했습니다: {exc}")
            text = _extract_text_from_hwpx_zip(path)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if len(text.strip()) < 20:
        raise PDFParseError("HWPX에서 분석할 만한 텍스트를 추출하지 못했습니다. 스캔 이미지 기반 문서라면 OCR 처리가 필요합니다.")
    return text, warnings


def convert_hwp_to_hwpx(content: bytes, filename: str) -> tuple[bytes, list[str]]:
    """Convert HWP bytes to HWPX through the configured HWPX toolchain."""
    warnings: list[str] = []
    scripts = _require_hwpx_scripts("convert_hwp.py", "fix_namespaces.py", "validate.py", "verify_hwpx.py")

    tmpdir = _make_tmp_dir()
    try:
        input_path = tmpdir / (Path(filename or "input.hwp").name or "input.hwp")
        output_path = tmpdir / f"{input_path.stem}.hwpx"
        verify_path = tmpdir / "verify.json"
        input_path.write_bytes(content)

        try:
            convert_result = subprocess.run(
                [
                    sys.executable or "python",
                    str(scripts["convert_hwp.py"]),
                    str(input_path),
                    "-o",
                    str(output_path),
                    "--json",
                ],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            conversion_payload = _conversion_payload_from_stdout(convert_result.stdout)
            conversion_method = str(conversion_payload.get("conversion_method") or "")
            if "fallback" in conversion_method.lower():
                raise AnalysisError(
                    "HWP 변환기가 텍스트 fallback 결과를 반환했습니다. 원본 표/서식 보존을 위해 fallback 출력은 사용할 수 없습니다."
                )
            warnings.extend(_conversion_warnings_from_payload(conversion_payload))
            subprocess.run(
                [sys.executable or "python", str(scripts["fix_namespaces.py"]), str(output_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            subprocess.run(
                [sys.executable or "python", str(scripts["validate.py"]), str(output_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            verify_result = subprocess.run(
                [
                    sys.executable or "python",
                    str(scripts["verify_hwpx.py"]),
                    "--result",
                    str(output_path),
                    "--json",
                    str(verify_path),
                ],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            if verify_path.exists():
                try:
                    verify_payload = json.loads(verify_path.read_text(encoding="utf-8"))
                    if verify_payload.get("status") not in {"PASS", "WARN"}:
                        raise AnalysisError("HWPX 구조 검증에 실패했습니다: " + "; ".join(verify_payload.get("issues", [])))
                    for item in verify_payload.get("warnings", []):
                        warnings.append(str(item))
                except json.JSONDecodeError:
                    warnings.append(f"verify_hwpx.py JSON 결과를 해석하지 못했습니다: {verify_result.stdout[:300]}")
        except subprocess.CalledProcessError as exc:
            detail = "\n".join(part for part in [exc.stdout, exc.stderr] if part).strip()
            raise AnalysisError(
                "HWP를 HWPX로 변환하지 못했습니다. 변환 도구와 의존성이 설치되어 있는지 확인해 주세요."
                + (f" 상세: {detail[:1000]}" if detail else "")
            ) from exc

        if not output_path.exists():
            raise AnalysisError("HWP 변환은 완료되었지만 출력 HWPX 파일을 찾지 못했습니다.")
        warnings.append("HWP 원본을 구조 보존 HWPX로 변환한 뒤 텍스트를 추출했습니다.")
        return output_path.read_bytes(), warnings
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _conversion_payload_from_stdout(stdout: str) -> dict:
    if not stdout.strip():
        return {}
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}\s*$", stdout.strip())
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def _conversion_warnings_from_payload(payload: dict) -> list[str]:
    warnings = payload.get("warnings", []) if isinstance(payload, dict) else []
    if not isinstance(warnings, list):
        return []
    return [str(item).strip() for item in warnings if str(item).strip()]


def _conversion_warnings_from_stdout(stdout: str) -> list[str]:
    return _conversion_warnings_from_payload(_conversion_payload_from_stdout(stdout))


def _parsed_document_from_hwpx_analysis(
    analysis: dict,
    *,
    source_type: str,
    source_name: str,
    text: str,
    warnings: list[str],
    metadata: dict | None = None,
) -> ParsedDocument:
    paragraphs: list[str] = []
    tables: list[ParsedTable] = []
    blocks: list[ParsedDocumentBlock] = []

    for index, raw_block in enumerate(analysis.get("blocks", [])):
        block_id = str(raw_block.get("id") or f"block-{index}")
        block_type = str(raw_block.get("type") or "paragraph")
        block_text = str(raw_block.get("text") or "").strip()
        source_ref = raw_block.get("source_ref") if isinstance(raw_block.get("source_ref"), dict) else {}
        section_index = int(raw_block.get("section_index") or 0)

        if block_type == "table":
            rows = _parsed_table_rows(raw_block.get("rows") or [])
            table = ParsedTable(
                id=block_id,
                rows=rows,
                text=block_text or _table_rows_to_text(rows),
                source_ref=source_ref,
            )
            tables.append(table)
            blocks.append(
                ParsedDocumentBlock(
                    id=block_id,
                    type="table",
                    text=table.text,
                    rows=rows,
                    section_index=section_index,
                    source_ref=source_ref,
                )
            )
            continue

        if block_text:
            paragraphs.append(block_text)
        safe_block_type = block_type if block_type in {"paragraph", "checkboxGroup", "heading", "spacer", "signature"} else "paragraph"
        blocks.append(
            ParsedDocumentBlock(
                id=block_id,
                type=safe_block_type,
                text=block_text,
                section_index=section_index,
                source_ref=source_ref,
            )
        )

    normalized_text = text.strip() or _blocks_to_text(blocks)
    merged_warnings = list(dict.fromkeys(item for item in warnings if item))
    return ParsedDocument(
        source_type=source_type,
        source_name=source_name,
        text=normalized_text,
        paragraphs=paragraphs or _text_to_paragraphs(normalized_text),
        tables=tables,
        blocks=blocks,
        metadata={
            "title": analysis.get("title", ""),
            "organization": analysis.get("organization", ""),
            "summary": analysis.get("summary", ""),
            "stats": analysis.get("stats", {}),
            **(metadata or {}),
        },
        warnings=merged_warnings,
    )


def _parsed_table_rows(raw_rows: list) -> list[list[ParsedTableCell]]:
    rows: list[list[ParsedTableCell]] = []
    for row_index, raw_row in enumerate(raw_rows):
        row: list[ParsedTableCell] = []
        for col_index, raw_cell in enumerate(raw_row or []):
            cell = raw_cell if isinstance(raw_cell, dict) else {}
            row.append(
                ParsedTableCell(
                    text=str(cell.get("text") or ""),
                    row_index=row_index,
                    col_index=col_index,
                    row_span=int(cell.get("row_span") or 1),
                    col_span=int(cell.get("col_span") or 1),
                    source_ref=cell.get("source_ref") if isinstance(cell.get("source_ref"), dict) else {},
                )
            )
        if row:
            rows.append(row)
    return rows


def _table_rows_to_text(rows: list[list[ParsedTableCell]]) -> str:
    return "\n".join(" | ".join(cell.text for cell in row).strip() for row in rows if row).strip()


def _blocks_to_text(blocks: list[ParsedDocumentBlock]) -> str:
    parts: list[str] = []
    for block in blocks:
        if block.type == "table" and block.rows:
            table_text = _table_rows_to_text(block.rows)
            if table_text:
                parts.append(table_text)
        elif block.text.strip():
            parts.append(block.text.strip())
    return "\n\n".join(parts)


def _text_to_paragraphs(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"\n{2,}|\r?\n", text) if part.strip()]


def _parsed_text_document(text: str, source_type: str, source_name: str, warnings: list[str]) -> ParsedDocument:
    paragraphs = _text_to_paragraphs(text)
    blocks = [
        ParsedDocumentBlock(id=f"p-{index}", type="paragraph", text=paragraph)
        for index, paragraph in enumerate(paragraphs)
    ]
    return ParsedDocument(
        source_type=source_type,
        source_name=source_name,
        text=text,
        paragraphs=paragraphs,
        blocks=blocks,
        warnings=list(dict.fromkeys(item for item in warnings if item)),
    )


def _extract_text_from_hwpx_zip(path: Path) -> str:
    texts: list[str] = []
    try:
        with zipfile.ZipFile(path, "r") as zf:
            for name in zf.namelist():
                if name.startswith("Contents/") and name.endswith(".xml"):
                    data = zf.read(name).decode("utf-8", errors="replace")
                    for match in re.finditer(r"<hp:t[^>]*>(.*?)</hp:t>", data, re.DOTALL):
                        clean = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                        if clean:
                            texts.append(html.unescape(clean))
    except zipfile.BadZipFile as exc:
        raise AnalysisError("올바른 HWPX ZIP 파일이 아닙니다.") from exc
    return "\n".join(texts)


def _workspace_tmp_root() -> Path:
    root = Path(__file__).resolve().parents[1] / ".tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _make_tmp_dir() -> Path:
    path = _workspace_tmp_root() / f"livedock_{uuid.uuid4().hex}"
    path.mkdir(parents=False, exist_ok=False)
    return path
