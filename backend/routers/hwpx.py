import base64
import re
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.errors import AnalysisError
from models.schemas import (
    ExportResponse,
    HwpxComposeResponse,
    HwpxBatchDraftRequest,
    HwpxComponentCreateRequest,
    HwpxConvertResponse,
    HwpxFormSessionResponse,
    HwpxRegionDraftPreviewResponse,
    HwpxRegionDraftRequest,
    HwpxRegionUpdateRequest,
    HwpxStatusResponse,
    HwpxTemplateAnalysisResponse,
)
from services import storage
from services.document_ingestion import convert_hwp_to_hwpx
from services.drafting_service import export_markdown_to_hwpx_with_validation, get_hwpx_toolchain_status, hwpx_bytes_to_base64
from services.hwpx_compose_service import compose_hwpx
from services.hwpx_form_session import (
    add_component,
    create_form_session,
    draft_all_regions,
    draft_region,
    draft_region_preview,
    export_form_session,
    get_form_session,
    update_region,
)
from services.hwpx_template_analysis import analyze_hwpx_template_bytes
from services.pdf_export_service import PDF_MEDIA_TYPE, convert_hwpx_bytes_to_pdf

router = APIRouter()

EXPORT_ROOT = Path(__file__).resolve().parents[2] / "outputs" / "hwpx_exports"
PDF_EXPORT_ROOT = Path(__file__).resolve().parents[2] / "outputs" / "pdf_exports"
HWPX_MEDIA_TYPE = "application/vnd.hancom.hwpx"


class MarkdownHwpxRequest(BaseModel):
    title: str = "DockLive 결과 문서"
    markdown: str


class HwpxPdfRequest(BaseModel):
    filename: str = "livedock_hwpx_export.hwpx"
    content: str
    title: str = "livedock_pdf_export"


@router.get("/hwpx/status", response_model=HwpxStatusResponse)
async def get_hwpx_status():
    return HwpxStatusResponse(**get_hwpx_toolchain_status())


@router.post("/hwpx/analyze-template", response_model=HwpxTemplateAnalysisResponse)
async def analyze_hwpx_template(file: UploadFile = File(...)):
    """Extract a screen-friendly outline from an uploaded HWP/HWPX form."""
    if not file.filename:
        raise AnalysisError("HWP 또는 HWPX 양식 파일을 업로드해 주세요.")

    raw_template = await file.read()
    lower_name = file.filename.lower()
    warnings: list[str] = []
    if lower_name.endswith(".hwp") and not lower_name.endswith(".hwpx"):
        raw_template, warnings = convert_hwp_to_hwpx(raw_template, file.filename)
    elif not lower_name.endswith(".hwpx"):
        raise AnalysisError("HWP 또는 HWPX 양식 파일만 업로드할 수 있습니다.")

    try:
        analysis = analyze_hwpx_template_bytes(raw_template, file.filename)
    except ValueError as exc:
        raise AnalysisError(str(exc)) from exc
    analysis["warnings"] = warnings + analysis.get("warnings", [])
    return HwpxTemplateAnalysisResponse(**analysis)


@router.post("/hwpx/sessions", response_model=HwpxFormSessionResponse)
async def create_hwpx_form_session(file: UploadFile = File(...)):
    if not file.filename:
        raise AnalysisError("HWP 또는 HWPX 파일을 업로드해 주세요.")
    session = create_form_session(await file.read(), file.filename)
    return HwpxFormSessionResponse(data=session)


@router.get("/hwpx/sessions/{session_id}", response_model=HwpxFormSessionResponse)
async def read_hwpx_form_session(session_id: str):
    return HwpxFormSessionResponse(data=get_form_session(session_id))


@router.patch("/hwpx/sessions/{session_id}/regions/{region_id}", response_model=HwpxFormSessionResponse)
async def update_hwpx_form_region(session_id: str, region_id: str, payload: HwpxRegionUpdateRequest):
    session = update_region(session_id, region_id, payload.value, payload.prompt, payload.draft_status)
    return HwpxFormSessionResponse(data=session)


@router.post("/hwpx/sessions/{session_id}/regions/{region_id}/draft", response_model=HwpxFormSessionResponse)
async def draft_hwpx_form_region(session_id: str, region_id: str, payload: HwpxRegionDraftRequest):
    session = draft_region(session_id, region_id, payload.base_input, payload.prompt)
    return HwpxFormSessionResponse(data=session)


@router.post("/hwpx/sessions/{session_id}/regions/{region_id}/draft-preview", response_model=HwpxRegionDraftPreviewResponse)
async def preview_hwpx_form_region_draft(session_id: str, region_id: str, payload: HwpxRegionDraftRequest):
    preview = draft_region_preview(session_id, region_id, payload.base_input, payload.prompt)
    return HwpxRegionDraftPreviewResponse(**preview)


@router.post("/hwpx/sessions/{session_id}/draft-all", response_model=HwpxFormSessionResponse)
async def draft_hwpx_form_session(session_id: str, payload: HwpxBatchDraftRequest):
    session = draft_all_regions(
        session_id,
        base_input=payload.base_input,
        global_prompt=payload.global_prompt,
        overwrite_existing=payload.overwrite_existing,
    )
    return HwpxFormSessionResponse(data=session)


@router.post("/hwpx/sessions/{session_id}/components", response_model=HwpxFormSessionResponse)
async def add_hwpx_form_component(session_id: str, payload: HwpxComponentCreateRequest):
    session = add_component(session_id, payload.kind, payload.label, payload.value)
    return HwpxFormSessionResponse(data=session)


@router.post("/hwpx/sessions/{session_id}/export", response_model=ExportResponse)
async def export_hwpx_form_session(session_id: str):
    filename, content, validation_summary = export_form_session(session_id)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=HWPX_MEDIA_TYPE,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=validation_summary.get("warnings", []),
        validation_summary=validation_summary,
    )


@router.post("/hwpx/compose", response_model=HwpxComposeResponse)
async def compose_hwpx_document(
    template: UploadFile = File(...),
    request_text: str = Form(...),
    applicant_context: str = Form(""),
    title: str = Form(""),
):
    """Generate a filled HWPX from an uploaded HWP/HWPX form and natural-language request."""
    if not template.filename:
        raise AnalysisError("HWP 또는 HWPX 양식 파일을 업로드해 주세요.")

    raw_template = await template.read()
    lower_name = template.filename.lower()
    conversion_warnings: list[str] = []
    if lower_name.endswith(".hwp") and not lower_name.endswith(".hwpx"):
        raw_template, conversion_warnings = convert_hwp_to_hwpx(raw_template, template.filename)
    elif not lower_name.endswith(".hwpx"):
        raise AnalysisError("HWP 또는 HWPX 양식 파일만 업로드할 수 있습니다.")

    result = compose_hwpx(
        raw_template,
        request_text=request_text,
        applicant_context=applicant_context,
        title=title,
    )
    result["warnings"] = conversion_warnings + result.get("warnings", [])
    storage.save_export_file(
        "standalone",
        result["filename"],
        base64.b64decode(result["content"]),
        HWPX_MEDIA_TYPE,
        "hwpx_compose",
    )
    download_id = _persist_hwpx_export(result)
    result["download_id"] = download_id
    result["download_url"] = f"/api/hwpx/download/{download_id}?filename={quote(result['filename'], safe='')}"
    return HwpxComposeResponse(**result)


@router.post("/hwpx/from-markdown")
async def create_hwpx_from_markdown(payload: MarkdownHwpxRequest):
    """Create a validated HWPX file from Markdown content for frontend MVP exports."""
    markdown = payload.markdown.strip()
    if len(markdown) < 5:
        raise AnalysisError("HWPX로 변환할 Markdown 내용이 비어 있습니다.")

    filename, content, validation_summary = export_markdown_to_hwpx_with_validation(markdown, payload.title)
    result = {
        "success": True,
        "filename": filename,
        "content_type": HWPX_MEDIA_TYPE,
        "content": hwpx_bytes_to_base64(content),
        "encoding": "base64",
        "warnings": validation_summary.get("warnings", []),
        "validation_summary": validation_summary,
    }
    download_id = _persist_hwpx_export(result)
    storage.save_export_file("standalone", filename, content, HWPX_MEDIA_TYPE, "markdown_to_hwpx")
    result["download_id"] = download_id
    result["download_url"] = f"/api/hwpx/download/{download_id}?filename={quote(filename, safe='')}"
    return result


@router.post("/hwpx/convert-hwp", response_model=HwpxConvertResponse)
async def convert_hwp_document(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".hwp"):
        raise AnalysisError("HWP 파일만 변환할 수 있습니다.")

    content, warnings = convert_hwp_to_hwpx(await file.read(), file.filename)
    filename = f"{Path(file.filename).stem}.hwpx"
    result = {
        "success": True,
        "filename": filename,
        "content_type": HWPX_MEDIA_TYPE,
        "content": base64.b64encode(content).decode("ascii"),
        "encoding": "base64",
        "source_filename": file.filename,
        "conversion_method": "convert_hwp.py -> fix_namespaces.py -> validate.py",
        "warnings": warnings,
        "validation_summary": {"converted": True, "source_filename": file.filename},
    }
    download_id = _persist_hwpx_export(result)
    storage.save_export_file("standalone", filename, content, HWPX_MEDIA_TYPE, "hwp_to_hwpx")
    result["warnings"] = warnings + [f"download_id={download_id}"]
    return HwpxConvertResponse(**result)


@router.post("/hwpx/to-pdf", response_model=ExportResponse)
async def convert_hwpx_payload_to_pdf(payload: HwpxPdfRequest):
    try:
        hwpx_content = base64.b64decode(payload.content)
    except Exception as exc:
        raise AnalysisError("PDF로 변환할 HWPX content는 base64여야 합니다.") from exc

    filename, pdf_content, validation_summary = convert_hwpx_bytes_to_pdf(
        hwpx_content,
        payload.title or Path(payload.filename).stem,
        source_filename=payload.filename,
    )
    storage.save_export_file("standalone", filename, pdf_content, PDF_MEDIA_TYPE, "hwpx_to_pdf")
    download_id = _persist_pdf_export(filename, pdf_content)
    validation_summary["download_id"] = download_id
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=PDF_MEDIA_TYPE,
        content=hwpx_bytes_to_base64(pdf_content),
        encoding="base64",
        warnings=validation_summary.get("pdf_warnings", []),
        validation_summary=validation_summary,
    )


@router.get("/hwpx/download/{download_id}/pdf", response_model=ExportResponse)
async def convert_persisted_hwpx_to_pdf(download_id: str, filename: str = "livedock_hwpx_export.hwpx"):
    if not re.fullmatch(r"[a-f0-9]{32}", download_id):
        raise AnalysisError("올바르지 않은 HWPX 다운로드 ID입니다.")

    path = EXPORT_ROOT / f"{download_id}.hwpx"
    if not path.exists():
        raise AnalysisError("PDF로 변환할 HWPX 파일을 찾을 수 없습니다. 다시 생성해 주세요.")

    title = Path(filename).stem or path.stem
    pdf_filename, pdf_content, validation_summary = convert_hwpx_bytes_to_pdf(
        path.read_bytes(),
        title,
        source_filename=_safe_download_filename(filename),
    )
    storage.save_export_file("standalone", pdf_filename, pdf_content, PDF_MEDIA_TYPE, "hwpx_to_pdf")
    pdf_download_id = _persist_pdf_export(pdf_filename, pdf_content)
    validation_summary["download_id"] = pdf_download_id
    return ExportResponse(
        success=True,
        filename=pdf_filename,
        content_type=PDF_MEDIA_TYPE,
        content=hwpx_bytes_to_base64(pdf_content),
        encoding="base64",
        warnings=validation_summary.get("pdf_warnings", []),
        validation_summary=validation_summary,
    )


@router.get("/hwpx/download/{download_id}")
async def download_hwpx_file(download_id: str, filename: str = "livedock_hwpx_export.hwpx"):
    if not re.fullmatch(r"[a-f0-9]{32}", download_id):
        raise AnalysisError("올바르지 않은 HWPX 다운로드 ID입니다.")

    path = EXPORT_ROOT / f"{download_id}.hwpx"
    if not path.exists():
        raise AnalysisError("다운로드할 HWPX 파일을 찾을 수 없습니다. 다시 생성해 주세요.")

    return FileResponse(
        path,
        media_type=HWPX_MEDIA_TYPE,
        filename=_safe_download_filename(filename),
    )


def _persist_hwpx_export(result: dict) -> str:
    if result.get("encoding") != "base64" or not result.get("content"):
        raise AnalysisError("HWPX 생성 결과에 다운로드 가능한 파일 내용이 없습니다.")

    download_id = uuid.uuid4().hex
    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    (EXPORT_ROOT / f"{download_id}.hwpx").write_bytes(base64.b64decode(result["content"]))
    return download_id


def _persist_pdf_export(filename: str, content: bytes) -> str:
    download_id = uuid.uuid4().hex
    PDF_EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    (PDF_EXPORT_ROOT / f"{download_id}.pdf").write_bytes(content)
    return download_id


def _safe_download_filename(filename: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]+', "_", filename).strip().strip(".")
    if not safe.lower().endswith(".hwpx"):
        safe = f"{safe or 'livedock_hwpx_export'}.hwpx"
    return safe
