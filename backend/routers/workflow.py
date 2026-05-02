from fastapi import APIRouter

from core.errors import WorkflowNotFoundError
from models.schemas import (
    DraftFeedbackRequest,
    UserInputsRequest,
    WorkflowResponse,
    WorkflowSession,
    utc_now_iso,
)
from services import storage
from services.drafting_service import (
    confirm_workflow,
    finalize_document,
    generate_drafts,
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
