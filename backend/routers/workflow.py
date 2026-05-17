import base64
import json

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse

from core.errors import AnalysisError, WorkflowNotFoundError
from models.schemas import (
    ConfirmationRequest,
    DraftFeedbackRequest,
    ExportListResponse,
    ExportMetadata,
    ExportResponse,
    HwpxPlaceholderMapResponse,
    UserInputsRequest,
    WorkflowResponse,
    WorkflowSession,
    utc_now_iso,
)
from services import storage
from services.drafting_service import (
    clone_hwpx_template_with_validation,
    confirmation_required_items,
    confirm_workflow,
    create_hwpx_placeholder_map,
    export_markdown_to_hwpx_with_validation,
    finalize_document,
    generate_drafts,
    hwpx_bytes_to_base64,
    markdown_to_hwp_compatible_html,
    revise_section,
    stream_draft_events,
    update_inputs,
)
from services.pdf_export_service import PDF_MEDIA_TYPE, convert_hwpx_bytes_to_pdf

router = APIRouter()


def _load_workflow_or_404(workflow_id: str) -> WorkflowSession:
    data = storage.load_workflow(workflow_id)
    if data is None:
        raise WorkflowNotFoundError()
    return WorkflowSession(**data)


def _save_workflow(workflow: WorkflowSession) -> None:
    workflow.updated_at = utc_now_iso()
    storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))


def _save_and_respond(workflow: WorkflowSession) -> WorkflowResponse:
    _save_workflow(workflow)
    return WorkflowResponse(success=True, data=workflow)


def _ensure_finalized(workflow: WorkflowSession) -> WorkflowSession:
    if not workflow.final_document:
        if workflow.status != "confirmed" and not workflow.confirmed_at and confirmation_required_items(workflow):
            raise AnalysisError("확인 필요 항목을 모두 체크한 뒤 최종 문서를 생성할 수 있습니다.")
        workflow = finalize_document(workflow)
        _save_workflow(workflow)
    return workflow


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    return WorkflowResponse(success=True, data=_load_workflow_or_404(workflow_id))


@router.get("/{workflow_id}/exports", response_model=ExportListResponse)
async def list_workflow_exports(workflow_id: str):
    _load_workflow_or_404(workflow_id)
    rows = storage.list_export_files(workflow_id)
    return ExportListResponse(success=True, data=[ExportMetadata(**row) for row in rows])


@router.get("/{workflow_id}/exports/{export_id}", response_model=ExportResponse)
async def download_workflow_export(workflow_id: str, export_id: str):
    _load_workflow_or_404(workflow_id)
    row = storage.load_export_file(workflow_id, export_id)
    if row is None:
        raise AnalysisError("저장된 export 파일을 찾을 수 없습니다. 파일을 다시 생성해 주세요.")

    content_type = row.get("content_type") or "application/octet-stream"
    filename = row.get("filename") or "livedock_export"
    content = row["content"]
    if content_type.startswith("text/"):
        return ExportResponse(
            success=True,
            filename=filename,
            content_type=content_type,
            content=content.decode("utf-8", errors="replace"),
            encoding="text",
            validation_summary=row.get("validation_summary") or {},
        )
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=content_type,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        validation_summary=row.get("validation_summary") or {},
    )


@router.post("/{workflow_id}/inputs", response_model=WorkflowResponse)
async def save_inputs(workflow_id: str, payload: UserInputsRequest):
    workflow = _load_workflow_or_404(workflow_id)
    workflow = update_inputs(workflow, {item.field_id: item.value for item in payload.inputs})
    workflow.status = "collecting_inputs"
    return _save_and_respond(workflow)


@router.post("/{workflow_id}/draft", response_model=WorkflowResponse)
async def create_draft(workflow_id: str):
    workflow = _load_workflow_or_404(workflow_id)
    workflow = generate_drafts(workflow)
    return _save_and_respond(workflow)


@router.get("/{workflow_id}/draft/stream")
async def stream_draft(workflow_id: str):
    """Stream section-level draft events."""

    def event(payload: dict) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    def generate():
        try:
            workflow = _load_workflow_or_404(workflow_id)
            yield event({"type": "section_start", "workflow_id": workflow.id, "content": "초안 생성을 시작합니다."})
            last_workflow = workflow
            for payload in stream_draft_events(workflow):
                maybe_workflow = payload.pop("_workflow", None)
                if maybe_workflow is not None:
                    last_workflow = maybe_workflow
                    _save_workflow(last_workflow)
                yield event(payload)
            _save_workflow(last_workflow)
        except Exception as exc:
            yield event({"type": "error", "workflow_id": workflow_id, "content": str(exc)})

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{workflow_id}/draft/{section_id}/feedback", response_model=WorkflowResponse)
async def save_feedback(workflow_id: str, section_id: str, payload: DraftFeedbackRequest):
    workflow = _load_workflow_or_404(workflow_id)
    for draft in workflow.draft_sections:
        if draft.section_id == section_id:
            draft.user_feedback = payload.feedback.strip()
            break
    return _save_and_respond(workflow)


@router.post("/{workflow_id}/draft/{section_id}/revise", response_model=WorkflowResponse)
async def revise_draft(workflow_id: str, section_id: str):
    workflow = _load_workflow_or_404(workflow_id)
    workflow = revise_section(workflow, section_id)
    return _save_and_respond(workflow)


@router.post("/{workflow_id}/confirm", response_model=WorkflowResponse)
async def confirm_draft(workflow_id: str, payload: ConfirmationRequest | None = None):
    workflow = _load_workflow_or_404(workflow_id)
    workflow = confirm_workflow(workflow, payload.confirmed_items if payload else [])
    return _save_and_respond(workflow)


@router.post("/{workflow_id}/finalize", response_model=WorkflowResponse)
async def finalize_workflow(workflow_id: str):
    workflow = _load_workflow_or_404(workflow_id)
    if workflow.status != "confirmed" and not workflow.confirmed_at and confirmation_required_items(workflow):
        raise AnalysisError("확인 필요 항목을 모두 체크한 뒤 최종 문서를 생성할 수 있습니다.")
    workflow = finalize_document(workflow)
    return _save_and_respond(workflow)


@router.get("/{workflow_id}/export/html", response_model=ExportResponse)
async def export_hwp_compatible_html(workflow_id: str):
    workflow = _ensure_finalized(_load_workflow_or_404(workflow_id))
    assert workflow.final_document is not None
    html = markdown_to_hwp_compatible_html(
        workflow.final_document.content_markdown,
        workflow.final_document.title,
    )
    safe_title = "".join(ch if ch.isalnum() else "_" for ch in workflow.final_document.title).strip("_")
    filename = f"{safe_title or 'livedock_export'}.html"
    storage.save_export_file(
        workflow.id,
        filename,
        html.encode("utf-8"),
        "text/html; charset=utf-8",
        "html",
        validation_summary={"fallback": True, "format": "html"},
    )
    return ExportResponse(
        success=True,
        filename=filename,
        content_type="text/html; charset=utf-8",
        content=html,
        encoding="text",
    )


@router.get("/{workflow_id}/export/hwpx", response_model=ExportResponse)
async def export_hwpx(workflow_id: str):
    workflow = _ensure_finalized(_load_workflow_or_404(workflow_id))
    assert workflow.final_document is not None
    try:
        filename, content, validation_summary = export_markdown_to_hwpx_with_validation(
            workflow.final_document.content_markdown,
            workflow.final_document.title,
        )
        storage.save_export_file(
            workflow.id,
            filename,
            content,
            "application/vnd.hancom.hwpx",
            "hwpx",
            status="success",
            validation_summary=validation_summary,
        )
        return ExportResponse(
            success=True,
            filename=filename,
            content_type="application/vnd.hancom.hwpx",
            content=hwpx_bytes_to_base64(content),
            encoding="base64",
            warnings=validation_summary.get("warnings", []),
            validation_summary=validation_summary,
        )
    except Exception as exc:
        status = _export_failure_status(exc)
        _save_failed_export(workflow.id, "hwpx", status, str(exc))
        if isinstance(exc, AnalysisError):
            raise
        raise AnalysisError(f"HWPX export 실패: {exc}")


@router.get("/{workflow_id}/export/pdf", response_model=ExportResponse)
async def export_pdf(workflow_id: str):
    workflow = _ensure_finalized(_load_workflow_or_404(workflow_id))
    assert workflow.final_document is not None
    try:
        hwpx_filename, hwpx_content, hwpx_validation = export_markdown_to_hwpx_with_validation(
            workflow.final_document.content_markdown,
            workflow.final_document.title,
        )
        filename, pdf_content, pdf_summary = convert_hwpx_bytes_to_pdf(
            hwpx_content,
            workflow.final_document.title,
            source_filename=hwpx_filename,
        )
        validation_summary = {
            "hwpx_validation": hwpx_validation,
            "pdf_validation": pdf_summary,
        }
        storage.save_export_file(
            workflow.id,
            filename,
            pdf_content,
            PDF_MEDIA_TYPE,
            "pdf",
            status="success",
            validation_summary=validation_summary,
        )
        return ExportResponse(
            success=True,
            filename=filename,
            content_type=PDF_MEDIA_TYPE,
            content=hwpx_bytes_to_base64(pdf_content),
            encoding="base64",
            warnings=hwpx_validation.get("warnings", []) + pdf_summary.get("pdf_warnings", []),
            validation_summary=validation_summary,
        )
    except Exception as exc:
        status = _export_failure_status(exc)
        _save_failed_export(workflow.id, "pdf", status, str(exc))
        if isinstance(exc, AnalysisError):
            raise
        raise AnalysisError(f"PDF export 실패: {exc}")


@router.post("/{workflow_id}/export/hwpx/placeholder-map", response_model=HwpxPlaceholderMapResponse)
async def export_hwpx_placeholder_map(workflow_id: str, template_id: str = "basic_application_v1"):
    workflow = _ensure_finalized(_load_workflow_or_404(workflow_id))
    placeholder_map, warnings = create_hwpx_placeholder_map(workflow, template_id)
    content = json.dumps(
        {
            "templateId": template_id,
            "placeholderMap": placeholder_map,
            "warnings": warnings,
        },
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")
    row = storage.save_export_file(
        workflow.id,
        f"{template_id}_placeholder_map.json",
        content,
        "application/json; charset=utf-8",
        "hwpx_placeholder_map",
        status="success",
        validation_summary={"template_id": template_id, "warnings": warnings},
    )
    return HwpxPlaceholderMapResponse(
        success=True,
        export_job_id=(row or {}).get("id", f"placeholder-{workflow.id}"),
        workflow_id=workflow.id,
        template_id=template_id,
        status="completed_with_warnings" if warnings else "completed",
        placeholder_map=placeholder_map,
        warnings=warnings,
        generated_at=utc_now_iso(),
        download_id=(row or {}).get("id"),
    )


@router.post("/{workflow_id}/export/hwpx/template", response_model=ExportResponse)
async def export_hwpx_from_template(
    workflow_id: str,
    template: UploadFile = File(...),
    replacements_json: str = Form("{}"),
    keywords_json: str = Form("{}"),
):
    workflow = _ensure_finalized(_load_workflow_or_404(workflow_id))
    if not template.filename or not template.filename.lower().endswith(".hwpx"):
        raise AnalysisError("HWPX 템플릿 파일만 업로드할 수 있습니다.")

    try:
        replacements = json.loads(replacements_json or "{}")
        keywords = json.loads(keywords_json or "{}")
    except json.JSONDecodeError as exc:
        raise AnalysisError(f"치환 JSON 형식이 올바르지 않습니다: {exc}")
    if not isinstance(replacements, dict) or not isinstance(keywords, dict):
        raise AnalysisError("치환 값과 키워드 값은 JSON 객체여야 합니다.")

    try:
        filename, content, validation_summary = clone_hwpx_template_with_validation(
            await template.read(),
            workflow,
            replacements={str(key): str(value) for key, value in replacements.items()},
            keywords={str(key): str(value) for key, value in keywords.items()},
        )
        storage.save_export_file(
            workflow.id,
            filename,
            content,
            "application/vnd.hancom.hwpx",
            "hwpx_template",
            status="success",
            validation_summary=validation_summary,
        )
        return ExportResponse(
            success=True,
            filename=filename,
            content_type="application/vnd.hancom.hwpx",
            content=hwpx_bytes_to_base64(content),
            encoding="base64",
            validation_summary=validation_summary,
        )
    except Exception as exc:
        status = _export_failure_status(exc)
        _save_failed_export(workflow.id, "hwpx_template", status, str(exc))
        if isinstance(exc, AnalysisError):
            raise
        raise AnalysisError(f"HWPX 템플릿 export 실패: {exc}")


def _export_failure_status(exc: Exception) -> str:
    message = str(exc).lower()
    return "validation_failed" if "validate" in message or "validation" in message or "검증" in message else "failed"


def _save_failed_export(workflow_id: str, export_type: str, status: str, error_message: str) -> None:
    content = json.dumps(
        {
            "success": False,
            "export_type": export_type,
            "status": status,
            "error_message": error_message,
            "created_at": utc_now_iso(),
        },
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")
    storage.save_export_file(
        workflow_id,
        f"{export_type}_failed.json",
        content,
        "application/json; charset=utf-8",
        export_type,
        status=status,
        error_message=error_message,
        validation_summary={"status": status},
    )
