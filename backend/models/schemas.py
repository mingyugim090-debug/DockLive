from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


DocType = Literal["competition", "research", "scholarship", "startup", "government_rnd"]
ApplicantKind = Literal[
    "unspecified",
    "company",
    "university_researcher",
    "research_institute",
    "mixed",
]
ItemCategory = Literal["required", "optional"]
DayStatus = Literal["safe", "warning", "danger", "passed"]
SourceType = Literal["pdf", "url", "text", "demo", "hwpx", "hwp"]
InputFieldType = Literal["text", "textarea", "number", "date", "file_note"]
DraftStatus = Literal["empty", "needs_input", "drafted", "revised", "confirmed"]
WorkflowStatus = Literal["analyzed", "collecting_inputs", "drafting", "reviewing", "confirmed", "finalized"]
DraftStreamEventType = Literal["section_start", "delta", "section_done", "workflow_done", "error"]
ExportJobStatus = Literal["pending", "success", "failed", "validation_failed"]
ParsedDocumentBlockType = Literal["paragraph", "table", "checkboxGroup", "heading", "spacer", "signature"]
AgencyMemberRole = Literal["staff", "lead", "approver", "admin"]
AgencyNoticeStatus = Literal["draft", "under_review", "revision_requested", "approving", "approved", "published"]
AgencyClauseStatus = Literal["satisfied", "missing", "needs_confirmation"]
AgencyApprovalStepStatus = Literal["pending", "active", "approved", "changes_requested", "skipped"]
AgencyReferenceSourceType = Literal["brief", "guideline", "prior_notice", "template", "manual"]
AgencyClauseSource = Literal["org_default", "agency_supplied"]


def _default_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


class SupportProgram(BaseModel):
    id: str
    parent_program: str = ""
    sub_program: str = ""
    rfp_id: Optional[str] = None
    research_topic: Optional[str] = None
    budget: Optional[str] = None
    project_count: Optional[str] = None
    task_type: Optional[str] = None
    rfp_type_code: Optional[str] = None
    security_level: Optional[str] = None
    support_scale: Optional[str] = None
    development_period: Optional[str] = None
    support_limit: Optional[str] = None
    support_ratio: Optional[str] = None
    schedule: Optional[str] = None
    notes: Optional[str] = None
    source_evidence_ids: list[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    id: str
    source_type: SourceType = "pdf"
    source_name: Optional[str] = None
    summary: str = ""
    doc_type: DocType
    applicant_kind: ApplicantKind = "unspecified"
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
    support_programs: list[SupportProgram] = Field(default_factory=list)


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
    style: dict[str, Any] = Field(default_factory=dict)
    source_ref: dict[str, Any] = Field(default_factory=dict)


class HwpxTemplateBlock(BaseModel):
    id: str
    type: Literal["paragraph", "table", "checkboxGroup", "heading", "spacer", "signature"]
    role: str = "body"
    section_index: int = 0
    text: str = ""
    rows: list[list[HwpxTemplateCell]] = Field(default_factory=list)
    style: dict[str, Any] = Field(default_factory=dict)
    options: list[dict[str, Any]] = Field(default_factory=list)
    source_ref: dict[str, Any] = Field(default_factory=dict)


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
    section_heading: str = ""
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
    draft_status: Optional[Literal["empty", "drafted", "revised"]] = None


class HwpxRegionDraftRequest(BaseModel):
    base_input: str = ""
    prompt: str = ""


class HwpxRegionDraftPreviewResponse(BaseModel):
    success: bool = True
    region_id: str
    content: str
    prompt: str = ""


class HwpxBatchDraftRequest(BaseModel):
    base_input: str = ""
    global_prompt: str = ""
    overwrite_existing: bool = False


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


class AgencyNoticeReference(BaseModel):
    id: str
    source_type: AgencyReferenceSourceType = "guideline"
    filename: str = ""
    title: str = ""
    text: str = ""
    evidence_label: str = ""


class AgencyNoticeBrief(BaseModel):
    organization_id: str = "00000000-0000-4000-8000-000000000001"
    author_id: str = "demo-user"
    author_name: str = "담당자"
    agency_name: str = ""
    title: str
    program_type: str = "support_program"
    program_purpose: str = ""
    budget: str = ""
    program_period: str = ""
    eligibility_rules: str = ""
    support_details: str = ""
    evaluation_criteria: str = ""
    submission_method: str = ""
    required_documents: list[str] = Field(default_factory=list)
    contact: str = ""
    legal_basis: str = ""
    privacy_policy: str = ""
    fair_competition_clause: str = ""
    appeal_process: str = ""
    references: list[AgencyNoticeReference] = Field(default_factory=list)


class AgencySourceEvidence(BaseModel):
    id: str
    label: str
    quote: str
    source_type: AgencyReferenceSourceType = "brief"
    confidence: float = Field(default=0.8, ge=0, le=1)


class AgencySourceTrace(BaseModel):
    evidence_id: str
    label: str
    quote: str
    source_type: AgencyReferenceSourceType = "brief"
    field_name: Optional[str] = None
    reference_id: Optional[str] = None
    confidence: float = Field(default=0.8, ge=0, le=1)


class AgencyNoticeSection(BaseModel):
    id: str
    title: str
    content_markdown: str = ""
    order: int = 0
    source_evidence_ids: list[str] = Field(default_factory=list)
    source_traces: list[AgencySourceTrace] = Field(default_factory=list)
    confirmation_required: list[str] = Field(default_factory=list)
    updated_at: str = Field(default_factory=_default_utc_now_iso)


class MandatoryClauseCheck(BaseModel):
    id: str
    label: str
    status: AgencyClauseStatus = "missing"
    note: str = ""
    source_evidence_ids: list[str] = Field(default_factory=list)
    source_traces: list[AgencySourceTrace] = Field(default_factory=list)
    confirmation_required: list[str] = Field(default_factory=list)


class NoticeVersion(BaseModel):
    id: str
    draft_id: str
    version_number: int
    created_by: str = "demo-user"
    change_summary: str = ""
    sections_snapshot: list[AgencyNoticeSection] = Field(default_factory=list)
    mandatory_clause_checks: list[MandatoryClauseCheck] = Field(default_factory=list)
    created_at: str = Field(default_factory=_default_utc_now_iso)


class ApprovalStep(BaseModel):
    id: str
    draft_id: str
    step_order: int
    title: str
    role: AgencyMemberRole = "lead"
    assigned_to: Optional[str] = None
    status: AgencyApprovalStepStatus = "pending"
    decided_at: Optional[str] = None
    decision_note: str = ""


class ApprovalComment(BaseModel):
    id: str
    draft_id: str
    version_id: str
    section_id: Optional[str] = None
    author_id: str = "demo-user"
    author_name: str = "담당자"
    body: str
    resolved: bool = False
    created_at: str = Field(default_factory=_default_utc_now_iso)


class NoticeAuditEvent(BaseModel):
    id: str
    draft_id: str
    actor_id: str = "system"
    action: str
    message: str
    created_at: str = Field(default_factory=_default_utc_now_iso)


class ApprovalWorkflow(BaseModel):
    status: AgencyNoticeStatus = "draft"
    current_step_order: int = 1
    steps: list[ApprovalStep] = Field(default_factory=list)


class AgencyNoticeDraft(BaseModel):
    id: str
    organization_id: str
    title: str
    status: AgencyNoticeStatus = "draft"
    brief: AgencyNoticeBrief
    sections: list[AgencyNoticeSection] = Field(default_factory=list)
    mandatory_clause_checks: list[MandatoryClauseCheck] = Field(default_factory=list)
    source_evidence: list[AgencySourceEvidence] = Field(default_factory=list)
    confirmation_required: list[str] = Field(default_factory=list)
    versions: list[NoticeVersion] = Field(default_factory=list)
    approval_workflow: ApprovalWorkflow
    comments: list[ApprovalComment] = Field(default_factory=list)
    audit_events: list[NoticeAuditEvent] = Field(default_factory=list)
    current_version_id: Optional[str] = None
    created_at: str = Field(default_factory=_default_utc_now_iso)
    updated_at: str = Field(default_factory=_default_utc_now_iso)


class AgencyNoticeDraftCreateRequest(BaseModel):
    brief: AgencyNoticeBrief


class AgencyNoticeDraftResponse(BaseModel):
    success: bool = True
    data: AgencyNoticeDraft


class AgencyNoticeListResponse(BaseModel):
    success: bool = True
    data: list[AgencyNoticeDraft] = Field(default_factory=list)


class AgencyNoticeSectionUpdateRequest(BaseModel):
    content_markdown: str
    change_summary: str = "섹션 내용을 수정했습니다."
    actor_id: str = "demo-user"


class AgencyNoticeTransitionRequest(BaseModel):
    actor_id: str = "demo-user"
    note: str = ""


class AgencyNoticeCommentCreateRequest(BaseModel):
    version_id: Optional[str] = None
    section_id: Optional[str] = None
    author_id: str = "demo-user"
    author_name: str = "담당자"
    body: str


class AgencyNoticeExportRequest(BaseModel):
    style_profile: Optional[DocumentStyleProfile] = None


class ClauseLibraryEntry(BaseModel):
    id: str
    organization_id: str = "00000000-0000-4000-8000-000000000001"
    clause_type: str
    label: str
    required_for_program_types: list[str] = Field(default_factory=list)
    template_text: str = ""
    source: AgencyClauseSource = "org_default"
    active: bool = True
    created_at: str = Field(default_factory=_default_utc_now_iso)
    updated_at: str = Field(default_factory=_default_utc_now_iso)


class ClauseLibraryListResponse(BaseModel):
    success: bool = True
    data: list[ClauseLibraryEntry] = Field(default_factory=list)


class ClauseLibraryEntryRequest(BaseModel):
    organization_id: str = "00000000-0000-4000-8000-000000000001"
    clause_type: str
    label: str
    required_for_program_types: list[str] = Field(default_factory=list)
    template_text: str = ""
    source: AgencyClauseSource = "agency_supplied"
    active: bool = True


class ClauseLibraryEntryResponse(BaseModel):
    success: bool = True
    data: ClauseLibraryEntry


class AgencyPriorNotice(BaseModel):
    id: str
    organization_id: str = "00000000-0000-4000-8000-000000000001"
    title: str
    program_type: str = "support_program"
    budget: str = ""
    budget_band: str = "unspecified"
    program_period: str = ""
    summary: str = ""
    text: str = ""
    source_filename: str = ""
    source_type: AgencyReferenceSourceType = "prior_notice"
    source_evidence: list[AgencySourceEvidence] = Field(default_factory=list)
    embedding: list[float] = Field(default_factory=list)
    embedding_model: str = ""
    embedding_dimension: int = 0
    created_at: str = Field(default_factory=_default_utc_now_iso)
    updated_at: str = Field(default_factory=_default_utc_now_iso)


class AgencyPriorNoticeCreateRequest(BaseModel):
    organization_id: str = "00000000-0000-4000-8000-000000000001"
    title: str = ""
    program_type: str = "support_program"
    budget: str = ""
    program_period: str = ""
    text: str = ""
    source_filename: str = ""


class AgencyPriorNoticeResponse(BaseModel):
    success: bool = True
    data: AgencyPriorNotice


class AgencyPriorNoticeRecallRequest(BaseModel):
    organization_id: str = "00000000-0000-4000-8000-000000000001"
    brief: Optional[AgencyNoticeBrief] = None
    title: str = ""
    program_type: str = "support_program"
    budget: str = ""
    program_period: str = ""
    program_purpose: str = ""
    eligibility_rules: str = ""
    limit: int = Field(default=5, ge=1, le=20)


class AgencyPriorNoticeRecallItem(BaseModel):
    id: str
    title: str
    program_type: str = "support_program"
    budget_band: str = "unspecified"
    program_period: str = ""
    summary: str = ""
    similarity: float = Field(default=0, ge=0, le=1)
    source_evidence: list[AgencySourceEvidence] = Field(default_factory=list)


class AgencyPriorNoticeRecallResponse(BaseModel):
    success: bool = True
    data: list[AgencyPriorNoticeRecallItem] = Field(default_factory=list)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
