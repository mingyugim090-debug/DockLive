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
ParsedDocumentBlockType = Literal["paragraph", "table", "checkboxGroup", "heading", "spacer", "signature"]


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
    evidence_quotes: list[str] = Field(default_factory=list)
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


class ParsedTableCell(BaseModel):
    text: str = ""
    row_index: int = 0
    col_index: int = 0
    row_span: int = 1
    col_span: int = 1
    source_ref: dict[str, Any] = Field(default_factory=dict)


class ParsedTable(BaseModel):
    id: str
    rows: list[list[ParsedTableCell]] = Field(default_factory=list)
    text: str = ""
    source_ref: dict[str, Any] = Field(default_factory=dict)


class ParsedDocumentBlock(BaseModel):
    id: str
    type: ParsedDocumentBlockType = "paragraph"
    text: str = ""
    rows: list[list[ParsedTableCell]] = Field(default_factory=list)
    section_index: int = 0
    source_ref: dict[str, Any] = Field(default_factory=dict)


class ParsedDocument(BaseModel):
    source_type: SourceType
    source_name: str
    text: str = ""
    paragraphs: list[str] = Field(default_factory=list)
    tables: list[ParsedTable] = Field(default_factory=list)
    blocks: list[ParsedDocumentBlock] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


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


class HwpxTemplateCell(BaseModel):
    text: str = ""
    row_span: int = 1
    col_span: int = 1
    id: Optional[str] = None
    align: Optional[Literal["left", "center", "right"]] = None
    vertical_align: Optional[Literal["top", "middle", "bottom"]] = None
    width: Optional[int] = None
    background: Optional[str] = None
    editable: bool = True


class HwpxTemplateBlock(BaseModel):
    id: str
    type: Literal["paragraph", "table", "checkboxGroup", "heading", "spacer", "signature"]
    role: str = "body"
    section_index: int = 0
    text: str = ""
    rows: list[list[HwpxTemplateCell]] = Field(default_factory=list)
    style: dict[str, Any] = Field(default_factory=dict)
    options: list[dict[str, Any]] = Field(default_factory=list)


class HwpxTemplateField(BaseModel):
    id: str
    label: str
    value: str = ""
    required: bool = False
    block_id: str


class HwpxTemplateSection(BaseModel):
    heading: str
    body: str = ""
    block_ids: list[str] = Field(default_factory=list)


class HwpxTemplateAnalysisResponse(BaseModel):
    success: bool = True
    source_filename: str
    title: str = ""
    organization: str = ""
    summary: str = ""
    preview_image: Optional[str] = None
    blocks: list[HwpxTemplateBlock] = Field(default_factory=list)
    fields: list[HwpxTemplateField] = Field(default_factory=list)
    sections: list[HwpxTemplateSection] = Field(default_factory=list)
    attachments: list[str] = Field(default_factory=list)
    stats: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class HwpxRenderPage(BaseModel):
    page_index: int
    image_base64: str
    width: int
    height: int


class HwpxEditableRegion(BaseModel):
    id: str
    kind: Literal["text", "textarea", "checkbox", "signature", "table"] = "text"
    label: str
    display_order: int = 0
    page_index: int = 0
    bbox: dict[str, float] = Field(default_factory=dict)
    value: str = ""
    prompt: str = ""
    placeholder_hint: str = ""
    draft_status: Literal["empty", "drafted", "revised"] = "empty"
    source_ref: dict[str, Any] = Field(default_factory=dict)


class HwpxFormSession(BaseModel):
    id: str
    source_filename: str
    canonical_hwpx_storage_path: Optional[str] = None
    analysis: dict[str, Any] = Field(default_factory=dict)
    pages: list[HwpxRenderPage] = Field(default_factory=list)
    regions: list[HwpxEditableRegion] = Field(default_factory=list)
    status: Literal["analyzed", "editing", "exported"] = "analyzed"
    warnings: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class HwpxFormSessionResponse(BaseModel):
    success: bool = True
    data: HwpxFormSession


class HwpxRegionUpdateRequest(BaseModel):
    value: str = ""
    prompt: str = ""


class HwpxRegionDraftRequest(BaseModel):
    base_input: str = ""
    prompt: str = ""


class HwpxComponentCreateRequest(BaseModel):
    kind: Literal["text", "textarea", "signature", "table"] = "textarea"
    label: str = ""
    value: str = ""


class HwpxConvertResponse(ExportResponse):
    source_filename: str
    conversion_method: str
    warnings: list[str] = Field(default_factory=list)


class NoticeSection(BaseModel):
    heading: str
    body: str


class NoticeSchedule(BaseModel):
    applicationPeriod: str = ""
    eventPeriod: str = ""


class NoticeContact(BaseModel):
    department: str = ""
    phone: str = ""
    email: str = ""


class NoticeDocument(BaseModel):
    documentType: str
    title: str
    organization: str
    purpose: str = ""
    applicationMethod: str = ""
    sections: list[NoticeSection] = Field(default_factory=list)
    schedule: NoticeSchedule = Field(default_factory=NoticeSchedule)
    contact: NoticeContact = Field(default_factory=NoticeContact)
    attachments: list[str] = Field(default_factory=list)
    documentModel: Optional[dict[str, Any]] = None


DocumentStyleProfileMode = Literal["preserve-official-form", "submission", "proposal", "report"]
DocumentSectionHeadingStyle = Literal["plain-underlined", "left-rule", "boxed", "numbered-band"]
DocumentSectionSpacing = Literal["compact", "normal", "wide"]
DocumentTableHeaderStyle = Literal["preserve", "tinted", "solid", "minimal"]
DocumentTableDensity = Literal["compact", "comfortable"]


class DocumentStyleColors(BaseModel):
    primary: str
    primarySoft: str
    accent: str
    accentSoft: str
    text: str
    muted: str
    border: str
    surface: str
    tableHeaderBg: str
    tableHeaderText: str


class DocumentStyleTypography(BaseModel):
    fontFamily: str
    titleSize: str
    titleWeight: int
    headingWeight: int
    bodySize: str
    lineHeight: str


class DocumentStyleSection(BaseModel):
    headingStyle: DocumentSectionHeadingStyle
    spacing: DocumentSectionSpacing


class DocumentStyleTable(BaseModel):
    headerStyle: DocumentTableHeaderStyle
    borderColor: str
    zebra: bool
    density: DocumentTableDensity


class DocumentStylePreview(BaseModel):
    pageBackground: str
    documentBackground: str
    selectedOutline: str
    note: str


class DocumentStyleProfile(BaseModel):
    id: str
    name: str
    description: str
    mode: DocumentStyleProfileMode
    colors: DocumentStyleColors
    typography: DocumentStyleTypography
    section: DocumentStyleSection
    table: DocumentStyleTable
    preview: DocumentStylePreview


class NoticeGenerateRequest(BaseModel):
    template_id: str
    inputs: dict[str, str] = Field(default_factory=dict)


class NoticeGenerateResponse(BaseModel):
    success: bool
    data: NoticeDocument
    preview_markdown: str
    warnings: list[str] = Field(default_factory=list)


class NoticeExportRequest(BaseModel):
    document: NoticeDocument
    style_profile: Optional[DocumentStyleProfile] = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
