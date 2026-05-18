import base64
import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.errors import AnalysisError
from models.schemas import ExportResponse, NoticeExportRequest, NoticeGenerateRequest, NoticeGenerateResponse
from services.notice_service import (
    export_notice_docx,
    export_notice_hwpx,
    export_notice_pdf,
    extract_reference_text,
    generate_notice_document,
    render_notice_markdown,
)

router = APIRouter()
logger = logging.getLogger(__name__)

HWPX_MEDIA_TYPE = "application/vnd.hancom.hwpx"
DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@router.post("/notices/generate", response_model=NoticeGenerateResponse)
async def generate_notice(
    payload_json: str = Form(...),
    files: list[UploadFile] | None = File(default=None),
):
    try:
        payload = NoticeGenerateRequest.model_validate(json.loads(payload_json))
    except json.JSONDecodeError as exc:
        raise AnalysisError(f"공고문 생성 요청 JSON 형식이 올바르지 않습니다: {exc}") from exc

    references: list[dict[str, str]] = []
    warnings: list[str] = []
    for upload in files or []:
        if not upload.filename:
            continue
        try:
            text, file_warnings = extract_reference_text(await upload.read(), upload.filename)
        except HTTPException as exc:
            warnings.append(f"{upload.filename} 참고자료를 읽지 못해 제외했습니다: {exc.detail}")
            continue
        except Exception as exc:
            logger.warning("Failed to extract reference text from %s: %s", upload.filename, exc, exc_info=True)
            warnings.append(f"{upload.filename} 참고자료를 읽지 못해 제외했습니다.")
            continue
        warnings.extend(file_warnings)
        references.append({"filename": upload.filename, "text": text})

    document, generation_warnings = generate_notice_document(
        payload.template_id,
        payload.inputs,
        reference_documents=references,
    )
    return NoticeGenerateResponse(
        success=True,
        data=document,
        preview_markdown=render_notice_markdown(document),
        warnings=warnings + generation_warnings,
    )


@router.post("/notices/export/hwpx", response_model=ExportResponse)
async def export_notice_as_hwpx(payload: NoticeExportRequest):
    filename, content, validation_summary = export_notice_hwpx(payload.document)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=HWPX_MEDIA_TYPE,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=validation_summary.get("warnings", []),
        validation_summary=validation_summary,
    )


@router.post("/notices/export/pdf", response_model=ExportResponse)
async def export_notice_as_pdf(payload: NoticeExportRequest):
    filename, content, validation_summary = export_notice_pdf(payload.document)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type="application/pdf",
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=validation_summary.get("pdf_validation", {}).get("pdf_warnings", []),
        validation_summary=validation_summary,
    )


@router.post("/notices/export/docx", response_model=ExportResponse)
async def export_notice_as_docx(payload: NoticeExportRequest):
    filename, content, validation_summary = export_notice_docx(payload.document)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=DOCX_MEDIA_TYPE,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=[],
        validation_summary=validation_summary,
    )
