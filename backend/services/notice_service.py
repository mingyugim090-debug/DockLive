import html
import json
import re
import shutil
import sys
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Any

from core.errors import AnalysisError
from models.schemas import NoticeDocument, NoticeSection
from services.ai_provider import call_json, should_use_mock_ai
from services.document_ingestion import convert_hwp_to_hwpx, extract_text_from_hwpx
from services.drafting_service import _make_tmp_dir, _require_hwpx_scripts, _run_hwpx_command, _safe_title
from services.pdf_export_service import convert_hwpx_bytes_to_pdf


FORBIDDEN_NOTICE_TERMS = [
    "LiveDock: 자동작성 내용",
    "DockLive: 자동작성 내용",
    "자동작성 초안",
    "generated_fields",
    "documentType",
    "template_id",
    "validation_summary",
]

NOTICE_TEMPLATES: dict[str, dict[str, Any]] = {
    "startup_camp_notice": {
        "name": "창업캠프 모집 공고문",
        "purpose": "창업캠프 참가자 모집",
        "sections": ["사업 개요", "모집 대상", "운영 일정", "신청 방법", "선정 및 안내"],
    },
    "business_support_notice": {
        "name": "지원사업 참여기업 모집 공고문",
        "purpose": "지원사업 참여기업 모집",
        "sections": ["사업 개요", "지원 대상", "지원 내용", "신청 방법", "평가 및 선정"],
    },
    "education_program_notice": {
        "name": "교육 프로그램 수강생 모집 공고문",
        "purpose": "교육 프로그램 수강생 모집",
        "sections": ["교육 개요", "모집 대상", "교육 일정", "신청 방법", "수료 및 안내"],
    },
    "event_participant_notice": {
        "name": "행사 참가자 모집 공고문",
        "purpose": "행사 참가자 모집",
        "sections": ["행사 개요", "모집 대상", "행사 일정", "참가 신청", "유의사항"],
    },
    "supporters_notice": {
        "name": "대외활동/서포터즈 모집 공고문",
        "purpose": "대외활동 또는 서포터즈 모집",
        "sections": ["활동 개요", "모집 대상", "활동 내용", "신청 방법", "선발 일정"],
    },
    "scholarship_notice": {
        "name": "장학생 모집 공고문",
        "purpose": "장학생 모집",
        "sections": ["장학사업 개요", "신청 자격", "지원 내용", "신청 방법", "선발 기준"],
    },
    "research_participant_notice": {
        "name": "연구과제 참여자 모집 공고문",
        "purpose": "연구과제 참여자 모집",
        "sections": ["연구 개요", "모집 대상", "참여 내용", "신청 방법", "연구 윤리 및 유의사항"],
    },
    "bid_rfp_notice": {
        "name": "입찰/제안요청 공고문",
        "purpose": "입찰 또는 제안서 접수",
        "sections": ["공고 개요", "과업 범위", "입찰 참가 자격", "제안서 제출", "평가 및 계약"],
    },
}


def generate_notice_document(
    template_id: str,
    inputs: dict[str, str],
    reference_documents: list[dict[str, str]] | None = None,
) -> tuple[NoticeDocument, list[str]]:
    template = NOTICE_TEMPLATES.get(template_id)
    if template is None:
        raise AnalysisError(f"알 수 없는 공고문 템플릿입니다: {template_id}")

    cleaned_inputs = {str(key): str(value).strip() for key, value in inputs.items() if str(value).strip()}
    references = reference_documents or []
    warnings: list[str] = []

    if should_use_mock_ai():
        data = _mock_notice_document(template_id, template, cleaned_inputs, references)
    else:
        data = _call_notice_ai(template_id, template, cleaned_inputs, references)

    document = _normalize_notice_document(template_id, template, data, cleaned_inputs)
    warnings.extend(_quality_warnings(document))
    _assert_clean_notice_text(render_notice_markdown(document), "공고문 미리보기")
    return document, warnings


def render_notice_markdown(document: NoticeDocument) -> str:
    rows = [
        ("기관명", document.organization),
        ("공고 유형", document.purpose),
        ("신청 기간", document.schedule.applicationPeriod),
        ("운영 기간", document.schedule.eventPeriod),
        ("접수 방법", document.applicationMethod),
    ]
    lines = [
        f"# {document.title}",
        "",
        "| 구분 | 내용 |",
        "| --- | --- |",
    ]
    lines.extend(f"| {label} | {_cell(value)} |" for label, value in rows if value)
    lines.append("")

    for index, section in enumerate(document.sections, start=1):
        heading = section.heading.strip()
        if not re.match(r"^\d+\.", heading):
            heading = f"{index}. {heading}"
        lines.extend([f"## {heading}", section.body.strip(), ""])

    lines.extend(
        [
            "## 문의처",
            "| 부서 | 연락처 | 이메일 |",
            "| --- | --- | --- |",
            f"| {_cell(document.contact.department)} | {_cell(document.contact.phone)} | {_cell(document.contact.email)} |",
            "",
            "## 붙임",
        ]
    )
    if document.attachments:
        lines.extend(f"{idx}. {item}" for idx, item in enumerate(document.attachments, start=1))
    else:
        lines.append("해당 없음")
    return "\n".join(lines).strip() + "\n"


def export_notice_hwpx(document: NoticeDocument) -> tuple[str, bytes, dict[str, Any]]:
    markdown = render_notice_markdown(document)
    _assert_clean_notice_text(markdown, "HWPX 입력")
    filename, content, summary = _export_notice_markdown_to_hwpx(markdown, document.title)
    excerpt = str(summary.get("extracted_text_excerpt") or "")
    _assert_clean_notice_text(excerpt or markdown, "HWPX 추출 텍스트")
    summary["renderer"] = "notice_document_renderer"
    summary["forbidden_terms_checked"] = FORBIDDEN_NOTICE_TERMS
    return filename, content, summary


def _export_notice_markdown_to_hwpx(markdown: str, title: str) -> tuple[str, bytes, dict[str, Any]]:
    scripts = _require_hwpx_scripts("md2hwpx.py", "fix_namespaces.py", "validate.py", "text_extract.py", "verify_hwpx.py")
    tmpdir = _make_tmp_dir()
    safe_title = _safe_title(title)
    summary: dict[str, Any] = {
        "validation_passed": False,
        "namespace_fixed": False,
        "warnings": [],
        "generation_method": "notice-md2hwpx.py",
    }
    try:
        markdown_path = tmpdir / "notice.md"
        output_path = tmpdir / f"{safe_title}.hwpx"
        verify_path = tmpdir / "verify.json"
        markdown_path.write_text(markdown, encoding="utf-8")

        python_bin = sys.executable or "python"
        _run_hwpx_command([python_bin, str(scripts["md2hwpx.py"]), str(markdown_path), "-o", str(output_path)])
        fix_result = _run_hwpx_command([python_bin, str(scripts["fix_namespaces.py"]), str(output_path)])
        summary["namespace_fixed"] = True
        summary["namespace_output"] = (fix_result.stdout or fix_result.stderr or "").strip()[:1000]
        validate_result = _run_hwpx_command([python_bin, str(scripts["validate.py"]), str(output_path)])
        summary["validation_passed"] = True
        summary["validation_output"] = (validate_result.stdout or validate_result.stderr or "").strip()[:1000]

        try:
            _run_hwpx_command(
                [
                    python_bin,
                    str(scripts["verify_hwpx.py"]),
                    "--result",
                    str(output_path),
                    "--json",
                    str(verify_path),
                ]
            )
            summary["verify_passed"] = True
            if verify_path.exists():
                summary["verify_report"] = json.loads(verify_path.read_text(encoding="utf-8"))
        except Exception as exc:
            summary["verify_passed"] = False
            summary["warnings"].append(f"verify_hwpx.py 확인을 완료하지 못했습니다: {str(exc)[:300]}")

        try:
            text_result = _run_hwpx_command([python_bin, str(scripts["text_extract.py"]), str(output_path), "--include-tables"])
            extracted = text_result.stdout or ""
            summary["text_extract_passed"] = True
            summary["text_chars"] = len(extracted)
            summary["title_found"] = bool(title and title[:20] in extracted)
            summary["extracted_text_excerpt"] = extracted[:1000]
        except Exception as exc:
            summary["text_extract_passed"] = False
            summary["text_chars"] = 0
            summary["warnings"].append(f"text_extract.py 확인을 완료하지 못했습니다: {str(exc)[:300]}")

        if not output_path.exists() or output_path.stat().st_size < 1000:
            raise AnalysisError("공고문 HWPX 파일이 정상적으로 생성되지 않았습니다.")
        return output_path.name, output_path.read_bytes(), summary
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def export_notice_pdf(document: NoticeDocument) -> tuple[str, bytes, dict[str, Any]]:
    hwpx_filename, hwpx_content, hwpx_summary = export_notice_hwpx(document)
    pdf_filename, pdf_content, pdf_summary = convert_hwpx_bytes_to_pdf(
        hwpx_content,
        document.title,
        source_filename=hwpx_filename,
    )
    return pdf_filename, pdf_content, {"hwpx_validation": hwpx_summary, "pdf_validation": pdf_summary}


def export_notice_docx(document: NoticeDocument) -> tuple[str, bytes, dict[str, Any]]:
    try:
        content = _build_docx_with_python_docx(document)
        method = "python-docx"
    except Exception as exc:
        content = _build_minimal_docx(document)
        method = f"minimal-openxml-fallback: {exc.__class__.__name__}"
    safe_title = _safe_filename(document.title)
    return f"{safe_title}.docx", content, {"renderer": "notice_document_renderer", "method": method}


def extract_reference_text(content: bytes, filename: str) -> tuple[str, list[str]]:
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".pdf":
        from services.pdf_parser import extract_text_from_pdf

        return extract_text_from_pdf(content, filename), []
    if suffix == ".hwpx":
        return extract_text_from_hwpx(content)
    if suffix == ".hwp":
        converted, warnings = convert_hwp_to_hwpx(content, filename)
        text, extract_warnings = extract_text_from_hwpx(converted)
        return text, warnings + extract_warnings
    if suffix in {".txt", ".md"}:
        return content.decode("utf-8", errors="replace"), []
    if suffix == ".docx":
        return _extract_text_from_docx(content), []
    raise AnalysisError("참고자료는 PDF, DOCX, HWP, HWPX, TXT, MD 파일만 업로드할 수 있습니다.")


def _call_notice_ai(
    template_id: str,
    template: dict[str, Any],
    inputs: dict[str, str],
    references: list[dict[str, str]],
) -> dict[str, Any]:
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "documentType": {"type": "string"},
            "title": {"type": "string"},
            "organization": {"type": "string"},
            "purpose": {"type": "string"},
            "applicationMethod": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "heading": {"type": "string"},
                        "body": {"type": "string"},
                    },
                    "required": ["heading", "body"],
                },
            },
            "schedule": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "applicationPeriod": {"type": "string"},
                    "eventPeriod": {"type": "string"},
                },
                "required": ["applicationPeriod", "eventPeriod"],
            },
            "contact": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "department": {"type": "string"},
                    "phone": {"type": "string"},
                    "email": {"type": "string"},
                },
                "required": ["department", "phone", "email"],
            },
            "attachments": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "documentType",
            "title",
            "organization",
            "purpose",
            "applicationMethod",
            "sections",
            "schedule",
            "contact",
            "attachments",
        ],
    }
    system_prompt = (
        "당신은 한국 공공기관 공고문을 작성하는 행정 문서 전문가입니다. "
        "내부 메타데이터, JSON 문자열, 자동작성 문구를 본문에 쓰지 말고 제출 가능한 공고문 내용만 작성하세요. "
        "불확실한 사실은 임의로 확정하지 말고 확인 필요 문장으로 완곡하게 작성하세요."
    )
    reference_excerpt = "\n\n".join(
        f"[{item.get('filename', '참고자료')}]\n{item.get('text', '')[:2500]}" for item in references
    )[:8000]
    payload = {
        "templateId": template_id,
        "templateName": template["name"],
        "purpose": template["purpose"],
        "requiredSections": template["sections"],
        "inputs": inputs,
        "referenceExcerpt": reference_excerpt,
    }
    user_prompt = "다음 정보를 공공기관 공고문 document JSON으로 작성하세요.\n" + json.dumps(payload, ensure_ascii=False)
    return call_json("draft", system_prompt, user_prompt, max_tokens=4096, json_schema=schema, schema_name="notice_document")


def _normalize_notice_document(
    template_id: str,
    template: dict[str, Any],
    raw: dict[str, Any],
    inputs: dict[str, str],
) -> NoticeDocument:
    document = NoticeDocument.model_validate(
        {
            "documentType": template_id,
            "title": raw.get("title") or inputs.get("title") or template["name"],
            "organization": raw.get("organization") or inputs.get("organization") or "기관명 확인 필요",
            "purpose": raw.get("purpose") or template["purpose"],
            "applicationMethod": raw.get("applicationMethod") or inputs.get("applicationMethod") or "온라인 또는 담당 부서 접수",
            "sections": raw.get("sections") or [],
            "schedule": raw.get("schedule") or {},
            "contact": raw.get("contact") or {},
            "attachments": raw.get("attachments") or [],
        }
    )
    if not document.sections:
        document.sections = [
            NoticeSection(heading=f"{index}. {heading}", body=_default_section_body(heading, inputs))
            for index, heading in enumerate(template["sections"], start=1)
        ]
    normalized_sections = []
    for index, section in enumerate(document.sections, start=1):
        heading = re.sub(r"^\d+\.\s*", "", section.heading.strip()) or template["sections"][min(index - 1, len(template["sections"]) - 1)]
        body = section.body.strip() or _default_section_body(heading, inputs)
        normalized_sections.append(NoticeSection(heading=f"{index}. {heading}", body=body))
    document.sections = normalized_sections
    if not document.attachments:
        document.attachments = ["신청서", "개인정보 수집 및 이용 동의서"]
    return document


def _mock_notice_document(
    template_id: str,
    template: dict[str, Any],
    inputs: dict[str, str],
    references: list[dict[str, str]],
) -> dict[str, Any]:
    title = inputs.get("title") or template["name"]
    organization = inputs.get("organization") or "서울과학기술대학교 창업지원단"
    target = inputs.get("target") or "해당 분야에 관심 있는 시민 및 기관 관계자"
    benefit = inputs.get("benefit") or "전문 교육, 네트워킹, 후속 지원 기회"
    reference_note = " 참고자료의 주요 내용을 반영하여 세부 일정과 운영 방식은 담당 부서 확인 후 확정합니다." if references else ""
    return {
        "documentType": template_id,
        "title": title,
        "organization": organization,
        "purpose": template["purpose"],
        "applicationMethod": inputs.get("applicationMethod") or "기관 누리집 공고문 확인 후 온라인 신청",
        "sections": [
            {
                "heading": f"{idx}. {heading}",
                "body": _default_section_body(heading, inputs, target=target, benefit=benefit) + reference_note,
            }
            for idx, heading in enumerate(template["sections"], start=1)
        ],
        "schedule": {
            "applicationPeriod": inputs.get("applicationPeriod") or "공고일로부터 2026. 6. 30.까지",
            "eventPeriod": inputs.get("eventPeriod") or inputs.get("operationPeriod") or "선정 후 별도 안내",
        },
        "contact": {
            "department": inputs.get("department") or "사업 담당 부서",
            "phone": inputs.get("phone") or "02-000-0000",
            "email": inputs.get("email") or "notice@example.go.kr",
        },
        "attachments": _split_attachments(inputs.get("attachments")) or ["신청서", "개인정보 수집 및 이용 동의서"],
    }


def _default_section_body(
    heading: str,
    inputs: dict[str, str],
    target: str = "공고 대상자",
    benefit: str = "세부 지원 내용",
) -> str:
    title = inputs.get("title") or "본 공고"
    organization = inputs.get("organization") or "주관 기관"
    if "개요" in heading:
        return f"{organization}은 {title}을 통해 사업 목적에 적합한 참여자를 모집하고, 원활한 운영을 위한 절차를 안내합니다."
    if "대상" in heading or "자격" in heading:
        return f"모집 대상은 {target}이며, 세부 자격 요건은 공고문과 제출 서류를 기준으로 확인합니다."
    if "내용" in heading or "지원" in heading:
        return f"주요 내용은 {benefit}이며, 선정 이후 세부 운영 기준에 따라 지원합니다."
    if "일정" in heading:
        return "신청 접수, 심사, 선정 안내, 프로그램 운영 순으로 진행하며 세부 일정은 기관 사정에 따라 조정될 수 있습니다."
    if "방법" in heading or "제출" in heading:
        return "신청자는 공고문에서 정한 제출 서류를 준비하여 접수 기간 내 지정된 방법으로 제출해야 합니다."
    return "세부 사항은 공고문 본문과 붙임 서류를 확인하여 주시기 바랍니다."


def _quality_warnings(document: NoticeDocument) -> list[str]:
    warnings = []
    if "확인 필요" in render_notice_markdown(document):
        warnings.append("일부 항목은 확인 필요로 표시되었습니다. 다운로드 전 실제 기관 정보를 확인해 주세요.")
    return warnings


def _assert_clean_notice_text(text: str, label: str) -> None:
    for term in FORBIDDEN_NOTICE_TERMS:
        if term in text:
            raise AnalysisError(f"{label}에 내부 문구가 포함되어 export를 중단했습니다: {term}")
    if re.search(r"\{\s*\"(?:documentType|sections|generated_fields)\"", text):
        raise AnalysisError(f"{label}에 JSON 문자열이 포함되어 export를 중단했습니다.")


def _cell(value: str) -> str:
    return (value or "확인 필요").replace("|", "/").replace("\n", "<br>")


def _split_attachments(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip(" -\t") for item in re.split(r"[\n,]+", value) if item.strip(" -\t")]


def _safe_filename(title: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]+', "_", title).strip().strip(".")
    return safe[:80] or "notice_document"


def _extract_text_from_docx(content: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(content), "r") as zf:
            xml = zf.read("word/document.xml").decode("utf-8", errors="replace")
    except Exception as exc:
        raise AnalysisError("DOCX 참고자료에서 텍스트를 추출하지 못했습니다.") from exc
    text = re.sub(r"<w:tab[^>]*/>", "\t", xml)
    text = re.sub(r"</w:p>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def _build_docx_with_python_docx(document: NoticeDocument) -> bytes:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()
    title = doc.add_heading(document.title, level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text = "구분"
    table.rows[0].cells[1].text = "내용"
    for label, value in [
        ("기관명", document.organization),
        ("공고 유형", document.purpose),
        ("신청 기간", document.schedule.applicationPeriod),
        ("운영 기간", document.schedule.eventPeriod),
        ("접수 방법", document.applicationMethod),
    ]:
        row = table.add_row().cells
        row[0].text = label
        row[1].text = value or "확인 필요"
    for section in document.sections:
        doc.add_heading(section.heading, level=1)
        doc.add_paragraph(section.body)
    doc.add_heading("문의처", level=1)
    contact = doc.add_table(rows=2, cols=3)
    contact.style = "Table Grid"
    contact.rows[0].cells[0].text = "부서"
    contact.rows[0].cells[1].text = "연락처"
    contact.rows[0].cells[2].text = "이메일"
    contact.rows[1].cells[0].text = document.contact.department or "확인 필요"
    contact.rows[1].cells[1].text = document.contact.phone or "확인 필요"
    contact.rows[1].cells[2].text = document.contact.email or "확인 필요"
    doc.add_heading("붙임", level=1)
    for item in document.attachments or ["해당 없음"]:
        doc.add_paragraph(item, style="List Number")
    output = BytesIO()
    doc.save(output)
    return output.getvalue()


def _build_minimal_docx(document: NoticeDocument) -> bytes:
    paragraphs = [document.title, document.organization, document.purpose]
    paragraphs.extend(f"{section.heading}\n{section.body}" for section in document.sections)
    paragraphs.append(f"문의처: {document.contact.department} / {document.contact.phone} / {document.contact.email}")
    paragraphs.append("붙임: " + ", ".join(document.attachments or ["해당 없음"]))
    body = "".join(f"<w:p><w:r><w:t>{html.escape(text)}</w:t></w:r></w:p>" for text in paragraphs)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body}<w:sectPr/></w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
    return output.getvalue()
