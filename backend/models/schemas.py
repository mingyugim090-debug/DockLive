from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


DocType = Literal["competition", "research", "scholarship", "startup"]
ItemCategory = Literal["required", "optional"]
DayStatus = Literal["safe", "warning", "danger", "passed"]
SourceType = Literal["pdf", "url", "text", "demo", "hwpx", "hwp"]
InputFieldType = Literal["text", "textarea", "number", "date", "file_note"]
DraftStatus = Literal["empty", "needs_input", "drafted", "revised", "confirmed"]
WorkflowStatus = Literal["analyzed", "collecting_inputs", "drafting", "reviewing", "confirmed", "finalized"]
DraftStreamEventType = Literal["section_start", "delta", "section_done", "workflow_done", "error"]
ExportJobStatus = Literal["pending", "success", "failed", "validation_failed"]


class TimelineItem(BaseModel):
    id: str
    label: str
    date: str
    d_day: int
    is_deadline: bool = False
    status: DayStatus


class ChecklistItem(BaseModel):
    id: str
    label: str
    category: ItemCategory
    description: Optional[str] = None
    file_format: Optional[str] = None


class DocumentSection(BaseModel):
    id: str
    title: str
    hint: str
    order: int


class SourceEvidence(BaseModel):
    field: str
    quote: str
    page: Optional[int] = None
    note: Optional[str] = None
    confidence: float = Field(default=0.7, ge=0, le=1)


class MissingQuestion(BaseModel):
    id: str
    question: str
    reason: str
    required_for: str


class AnalysisResult(BaseModel):
    id: str
    source_type: SourceType = "pdf"
    source_name: Optional[str] = None
    summary: str = ""
    doc_type: DocType
    title: str
    organization: str
    timeline: list[TimelineItem]
    checklist: list[ChecklistItem]
    document_template: list[DocumentSection]
    analyzed_at: str
    eligibility: list[str] = Field(default_factory=list)
    submission_method: Optional[str] = None
    evaluation_criteria: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    uncertain_fields: list[str] = Field(default_factory=list)
    source_evidence: list[SourceEvidence] = Field(default_factory=list)
    missing_questions: list[MissingQuestion] = Field(default_factory=list)


class CompanyProfile(BaseModel):
    name: str = ""
    industry: str = ""
    stage: str = ""
    region: str = ""
    team_size: Optional[int] = None
    strengths: str = ""
    needs: str = ""
    previous_support: str = ""


class MatchSignal(BaseModel):
    label: str
    status: Literal["match", "gap", "unknown"]
    detail: str


class MatchReport(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: str
    signals: list[MatchSignal] = Field(default_factory=list)
    missing_inputs: list[str] = Field(default_factory=list)
    recommended_next_steps: list[str] = Field(default_factory=list)


class AnalyzeTextRequest(BaseModel):
    title: Optional[str] = None
    text: str
    source_name: Optional[str] = None
    company_profile: Optional[CompanyProfile] = None


class AnalyzeUrlRequest(BaseModel):
    url: str
    company_profile: Optional[CompanyProfile] = None


class AnalyzeResponse(BaseModel):
    success: bool
    data: AnalysisResult
    match_report: Optional[MatchReport] = None


class UserInputField(BaseModel):
    id: str
    label: str
    field_type: InputFieldType = "textarea"
    required: bool = True
    section_id: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    value: str = ""


class UserInputUpdate(BaseModel):
    field_id: str
    value: str


class UserInputsRequest(BaseModel):
    inputs: list[UserInputUpdate]


class DraftSection(BaseModel):
    id: str
    section_id: str
    title: str
    content_markdown: str = ""
    purpose: str = ""
    related_criteria: list[str] = Field(default_factory=list)
    source_evidence_ids: list[str] = Field(default_factory=list)
    revision_notes: list[str] = Field(default_factory=list)
    status: DraftStatus = "empty"
    needs_confirmation: list[str] = Field(default_factory=list)
    confirmation_required: list[str] = Field(default_factory=list)
    user_feedback: str = ""
    updated_at: Optional[str] = None


class DraftStreamEvent(BaseModel):
    type: DraftStreamEventType
    workflow_id: str
    section_id: Optional[str] = None
    content: str = ""
    draft_section: Optional[DraftSection] = None


class DraftFeedbackRequest(BaseModel):
    feedback: str


class ConfirmationRequest(BaseModel):
    confirmed_items: list[str] = Field(default_factory=list)


class FinalDocument(BaseModel):
    title: str
    content_markdown: str
    created_at: str


class WorkflowSession(BaseModel):
    id: str
    analysis: AnalysisResult
    company_profile: Optional[CompanyProfile] = None
    match_report: Optional[MatchReport] = None
    status: WorkflowStatus = "analyzed"
    user_inputs: list[UserInputField] = Field(default_factory=list)
    draft_sections: list[DraftSection] = Field(default_factory=list)
    final_document: Optional[FinalDocument] = None
    confirmed_at: Optional[str] = None
    confirmed_items: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class AnalysisResponse(AnalyzeResponse):
    success: bool
    data: AnalysisResult


class WorkflowResponse(BaseModel):
    success: bool
    data: WorkflowSession


class ExportResponse(BaseModel):
    success: bool
    filename: str
    content_type: str
    content: str
    encoding: Literal["text", "base64"] = "text"
    warnings: list[str] = Field(default_factory=list)
    validation_summary: dict[str, Any] = Field(default_factory=dict)


class ExportMetadata(BaseModel):
    id: str
    workflow_id: str
    filename: str
    content_type: str
    export_type: str
    size_bytes: int = 0
    created_at: str
    status: ExportJobStatus = "success"
    error_message: Optional[str] = None
    validation_summary: dict[str, Any] = Field(default_factory=dict)


class ExportListResponse(BaseModel):
    success: bool
    data: list[ExportMetadata] = Field(default_factory=list)


class HwpxStatusResponse(BaseModel):
    success: bool = True
    enabled: bool
    skill_dir: str
    scripts_found: dict[str, bool] = Field(default_factory=dict)
    validation_available: bool = False
    template_clone_available: bool = False
    pdf_export_available: bool = False
    pdf_converter: Optional[str] = None
    pdf_warnings: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class HwpxPlaceholderMapResponse(BaseModel):
    success: bool
    export_job_id: str
    workflow_id: str
    template_id: str
    format: Literal["HWPX"] = "HWPX"
    status: Literal["completed", "completed_with_warnings"] = "completed"
    placeholder_map: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    generated_at: str
    download_id: Optional[str] = None


class HwpxComposeResponse(ExportResponse):
    template_id: str
    download_id: Optional[str] = None
    download_url: Optional[str] = None
    verification: dict = Field(default_factory=dict)
    generated_fields: dict[str, str] = Field(default_factory=dict)
    confirmation_required: list[str] = Field(default_factory=list)


class HwpxConvertResponse(ExportResponse):
    source_filename: str
    conversion_method: str
    warnings: list[str] = Field(default_factory=list)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
