import base64
import json

from fastapi import APIRouter, File, Form, Request, UploadFile

from models.schemas import (
    AgencyNoticeCommentCreateRequest,
    AgencyNoticeDraftCreateRequest,
    AgencyNoticeDraftResponse,
    AgencyNoticeExportRequest,
    AgencyNoticeListResponse,
    AgencyNoticeSectionUpdateRequest,
    AgencyNoticeTransitionRequest,
    AgencyPriorNoticeCreateRequest,
    AgencyPriorNoticeRecallRequest,
    AgencyPriorNoticeRecallResponse,
    AgencyPriorNoticeResponse,
    ClauseLibraryEntryRequest,
    ClauseLibraryEntryResponse,
    ClauseLibraryListResponse,
    ExportResponse,
)
from services.agency_clause_library import (
    create_clause_library_entry,
    list_clause_library_entries,
    update_clause_library_entry,
)
from services.agency_noticeops import (
    add_agency_notice_comment,
    agency_notice_to_notice_document,
    create_agency_notice_draft,
    get_agency_notice_draft,
    list_agency_notice_drafts,
    transition_agency_notice,
    update_agency_notice_section,
)
from services.document_ingestion import ingest_uploaded_document
from services.notice_service import export_notice_docx, export_notice_hwpx, export_notice_pdf
from services.prior_notice_recall import create_prior_notice, recall_prior_notices

router = APIRouter()

HWPX_MEDIA_TYPE = "application/vnd.hancom.hwpx"
DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@router.get("/notices/drafts", response_model=AgencyNoticeListResponse)
async def list_drafts(organization_id: str = "00000000-0000-4000-8000-000000000001"):
    return AgencyNoticeListResponse(data=list_agency_notice_drafts(organization_id))


@router.post("/prior-notices", response_model=AgencyPriorNoticeResponse)
async def create_prior_notice_route(
    request: Request,
    file: UploadFile | None = File(default=None),
    payload_json: str | None = Form(default=None),
    organization_id: str = Form(default="00000000-0000-4000-8000-000000000001"),
    title: str = Form(default=""),
    program_type: str = Form(default="support_program"),
    budget: str = Form(default=""),
    program_period: str = Form(default=""),
    text: str = Form(default=""),
):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = AgencyPriorNoticeCreateRequest.model_validate(await request.json())
    else:
        data = json.loads(payload_json) if payload_json else {}
        if file is not None:
            raw = await file.read()
            ingested = ingest_uploaded_document(raw, file.filename or "prior-notice")
            data.update(
                {
                    "text": ingested.text,
                    "source_filename": file.filename or ingested.source_name,
                }
            )
        payload = AgencyPriorNoticeCreateRequest.model_validate(
            {
                "organization_id": data.get("organization_id") or organization_id,
                "title": data.get("title") or title,
                "program_type": data.get("program_type") or program_type,
                "budget": data.get("budget") or budget,
                "program_period": data.get("program_period") or program_period,
                "text": data.get("text") or text,
                "source_filename": data.get("source_filename") or "",
            }
        )
    return AgencyPriorNoticeResponse(data=create_prior_notice(payload))


@router.post("/prior-notices/recall", response_model=AgencyPriorNoticeRecallResponse)
async def recall_prior_notice_route(payload: AgencyPriorNoticeRecallRequest):
    return AgencyPriorNoticeRecallResponse(data=recall_prior_notices(payload))


@router.get("/clause-library", response_model=ClauseLibraryListResponse)
async def list_clause_library(
    organization_id: str = "00000000-0000-4000-8000-000000000001",
    program_type: str | None = None,
):
    return ClauseLibraryListResponse(data=list_clause_library_entries(organization_id, program_type))


@router.post("/clause-library", response_model=ClauseLibraryEntryResponse)
async def create_clause_library(payload: ClauseLibraryEntryRequest):
    return ClauseLibraryEntryResponse(data=create_clause_library_entry(payload))


@router.patch("/clause-library/{entry_id}", response_model=ClauseLibraryEntryResponse)
async def update_clause_library(entry_id: str, payload: ClauseLibraryEntryRequest):
    return ClauseLibraryEntryResponse(data=update_clause_library_entry(entry_id, payload))


@router.post("/notices/drafts", response_model=AgencyNoticeDraftResponse)
async def create_draft(payload: AgencyNoticeDraftCreateRequest):
    return AgencyNoticeDraftResponse(data=create_agency_notice_draft(payload.brief))


@router.get("/notices/drafts/{draft_id}", response_model=AgencyNoticeDraftResponse)
async def get_draft(draft_id: str):
    return AgencyNoticeDraftResponse(data=get_agency_notice_draft(draft_id))


@router.patch("/notices/drafts/{draft_id}/sections/{section_id}", response_model=AgencyNoticeDraftResponse)
async def update_section(draft_id: str, section_id: str, payload: AgencyNoticeSectionUpdateRequest):
    draft = update_agency_notice_section(
        draft_id,
        section_id,
        payload.content_markdown,
        payload.change_summary,
        payload.actor_id,
    )
    return AgencyNoticeDraftResponse(data=draft)


@router.post("/notices/drafts/{draft_id}/comments", response_model=AgencyNoticeDraftResponse)
async def add_comment(draft_id: str, payload: AgencyNoticeCommentCreateRequest):
    draft = add_agency_notice_comment(
        draft_id,
        payload.body,
        version_id=payload.version_id,
        section_id=payload.section_id,
        author_id=payload.author_id,
        author_name=payload.author_name,
    )
    return AgencyNoticeDraftResponse(data=draft)


@router.post("/notices/drafts/{draft_id}/submit-review", response_model=AgencyNoticeDraftResponse)
async def submit_for_review(draft_id: str, payload: AgencyNoticeTransitionRequest | None = None):
    request = payload or AgencyNoticeTransitionRequest()
    return AgencyNoticeDraftResponse(
        data=transition_agency_notice(draft_id, "under_review", request.actor_id, request.note)
    )


@router.post("/notices/drafts/{draft_id}/request-revision", response_model=AgencyNoticeDraftResponse)
async def request_revision(draft_id: str, payload: AgencyNoticeTransitionRequest | None = None):
    request = payload or AgencyNoticeTransitionRequest()
    return AgencyNoticeDraftResponse(
        data=transition_agency_notice(draft_id, "revision_requested", request.actor_id, request.note)
    )


@router.post("/notices/drafts/{draft_id}/approve", response_model=AgencyNoticeDraftResponse)
async def approve_step(draft_id: str, payload: AgencyNoticeTransitionRequest | None = None):
    request = payload or AgencyNoticeTransitionRequest()
    draft = get_agency_notice_draft(draft_id)
    target = "approving" if draft.status == "under_review" else "approved"
    return AgencyNoticeDraftResponse(data=transition_agency_notice(draft_id, target, request.actor_id, request.note))


@router.post("/notices/drafts/{draft_id}/publish", response_model=AgencyNoticeDraftResponse)
async def publish_draft(draft_id: str, payload: AgencyNoticeTransitionRequest | None = None):
    request = payload or AgencyNoticeTransitionRequest()
    return AgencyNoticeDraftResponse(data=transition_agency_notice(draft_id, "published", request.actor_id, request.note))


@router.post("/notices/drafts/{draft_id}/export/hwpx", response_model=ExportResponse)
async def export_draft_hwpx(draft_id: str, payload: AgencyNoticeExportRequest | None = None):
    request = payload or AgencyNoticeExportRequest()
    document = agency_notice_to_notice_document(get_agency_notice_draft(draft_id))
    filename, content, validation_summary = export_notice_hwpx(document, request.style_profile)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=HWPX_MEDIA_TYPE,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=validation_summary.get("warnings", []),
        validation_summary=validation_summary,
    )


@router.post("/notices/drafts/{draft_id}/export/pdf", response_model=ExportResponse)
async def export_draft_pdf(draft_id: str, payload: AgencyNoticeExportRequest | None = None):
    request = payload or AgencyNoticeExportRequest()
    document = agency_notice_to_notice_document(get_agency_notice_draft(draft_id))
    filename, content, validation_summary = export_notice_pdf(document, request.style_profile)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type="application/pdf",
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=validation_summary.get("pdf_validation", {}).get("pdf_warnings", []),
        validation_summary=validation_summary,
    )


@router.post("/notices/drafts/{draft_id}/export/docx", response_model=ExportResponse)
async def export_draft_docx(draft_id: str):
    document = agency_notice_to_notice_document(get_agency_notice_draft(draft_id))
    filename, content, validation_summary = export_notice_docx(document)
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=DOCX_MEDIA_TYPE,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        validation_summary=validation_summary,
    )
