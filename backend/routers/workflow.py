import json

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse

from core.errors import AnalysisError, WorkflowNotFoundError
from models.schemas import (
    DraftFeedbackRequest,
    ExportResponse,
    UserInputsRequest,
    WorkflowResponse,
    WorkflowSession,
    utc_now_iso,
)
from services import storage
from services.drafting_service import (
    clone_hwpx_template,
    confirm_workflow,
    export_markdown_to_hwpx,
    finalize_document,
    generate_drafts,
    hwpx_bytes_to_base64,
    markdown_to_hwp_compatible_html,
    revise_section,
    update_inputs,
)

router = APIRouter()


def _load_workflow_or_404(workflow_id: str) -> WorkflowSession:
    data = storage.load_workflow(workflow_id)
    if data is None:
        raise WorkflowNotFoundError()
    return WorkflowSession(**data)


def _save_and_respond(workflow: WorkflowSession) -> WorkflowResponse:
    workflow.updated_at = utc_now_iso()
    storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))
    return WorkflowResponse(success=True, data=workflow)


def _ensure_finalized(workflow: WorkflowSession) -> WorkflowSession:
    if not workflow.final_document:
        workflow = finalize_document(workflow)
        storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))
    return workflow


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    return WorkflowResponse(success=True, data=_load_workflow_or_404(workflow_id))


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
            workflow = generate_drafts(workflow)
            storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))
            for draft in workflow.draft_sections:
                yield event(
                    {
                        "type": "section_done",
                        "workflow_id": workflow.id,
                        "section_id": draft.section_id,
                        "content": draft.content_markdown,
                        "draft_section": draft.model_dump(mode="json"),
                    }
                )
            yield event({"type": "workflow_done", "workflow_id": workflow.id, "content": "초안 생성이 완료되었습니다."})
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
async def confirm_draft(workflow_id: str):
    workflow = _load_workflow_or_404(workflow_id)
    workflow = confirm_workflow(workflow)
    return _save_and_respond(workflow)


@router.post("/{workflow_id}/finalize", response_model=WorkflowResponse)
async def finalize_workflow(workflow_id: str):
    workflow = _load_workflow_or_404(workflow_id)
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
    return ExportResponse(
        success=True,
        filename=f"{safe_title or 'livedock_export'}.html",
        content_type="text/html; charset=utf-8",
        content=html,
        encoding="text",
    )


@router.get("/{workflow_id}/export/hwpx", response_model=ExportResponse)
async def export_hwpx(workflow_id: str):
    workflow = _ensure_finalized(_load_workflow_or_404(workflow_id))
    assert workflow.final_document is not None
    filename, content = export_markdown_to_hwpx(
        workflow.final_document.content_markdown,
        workflow.final_document.title,
    )
    return ExportResponse(
        success=True,
        filename=filename,
        content_type="application/vnd.hancom.hwpx",
        content=hwpx_bytes_to_base64(content),
        encoding="base64",
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

    filename, content = clone_hwpx_template(
        await template.read(),
        workflow,
        replacements={str(key): str(value) for key, value in replacements.items()},
        keywords={str(key): str(value) for key, value in keywords.items()},
    )
    return ExportResponse(
        success=True,
        filename=filename,
        content_type="application/vnd.hancom.hwpx",
        content=hwpx_bytes_to_base64(content),
        encoding="base64",
    )
