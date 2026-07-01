export type DocType = 'competition' | 'research' | 'scholarship' | 'startup' | 'government_rnd';
export type ApplicantKind = 'unspecified' | 'company' | 'university_researcher' | 'research_institute' | 'mixed';
export type ItemCategory = 'required' | 'optional';
export type DayStatus = 'safe' | 'warning' | 'danger' | 'passed';
export type SourceType = 'pdf' | 'url' | 'text' | 'demo' | 'hwpx' | 'hwp';
export type InputFieldType = 'text' | 'textarea' | 'number' | 'date' | 'file_note';
export type DraftStatus = 'empty' | 'needs_input' | 'drafted' | 'revised' | 'confirmed';
export type DraftStreamEventType = 'section_start' | 'delta' | 'section_done' | 'workflow_done' | 'error';
export type ExportJobStatus = 'pending' | 'success' | 'failed' | 'validation_failed';
export type AgencyMemberRole = 'staff' | 'lead' | 'approver' | 'admin';
export type AgencyNoticeStatus = 'draft' | 'under_review' | 'revision_requested' | 'approving' | 'approved' | 'published';
export type AgencyClauseStatus = 'satisfied' | 'missing' | 'needs_confirmation';
export type AgencyApprovalStepStatus = 'pending' | 'active' | 'approved' | 'changes_requested' | 'skipped';
export type AgencyReferenceSourceType = 'brief' | 'guideline' | 'prior_notice' | 'template' | 'manual';
export type AgencyClauseSource = 'org_default' | 'agency_supplied';
export type WorkflowStatus =
  | 'analyzed'
  | 'collecting_inputs'
  | 'drafting'
  | 'reviewing'
  | 'confirmed'
  | 'finalized';

export interface TimelineItem {
  id: string;
  label: string;
  date: string;
  d_day: number;
  is_deadline: boolean;
  status: DayStatus;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: ItemCategory;
  description?: string;
  file_format?: string;
}

export interface DocumentSection {
  id: string;
  title: string;
  hint: string;
  order: number;
}

export interface SourceEvidence {
  field: string;
  quote: string;
  page?: number | null;
  note?: string | null;
  confidence: number;
}

export interface MissingQuestion {
  id: string;
  question: string;
  reason: string;
  required_for: string;
}

export interface SupportProgram {
  id: string;
  parent_program: string;
  sub_program: string;
  rfp_id?: string | null;
  research_topic?: string | null;
  budget?: string | null;
  project_count?: string | null;
  task_type?: string | null;
  rfp_type_code?: string | null;
  security_level?: string | null;
  support_scale?: string | null;
  development_period?: string | null;
  support_limit?: string | null;
  support_ratio?: string | null;
  schedule?: string | null;
  notes?: string | null;
  source_evidence_ids: string[];
}

export interface AnalysisResult {
  id: string;
  source_type: SourceType;
  source_name?: string | null;
  summary: string;
  doc_type: DocType;
  applicant_kind: ApplicantKind;
  title: string;
  organization: string;
  timeline: TimelineItem[];
  checklist: ChecklistItem[];
  document_template: DocumentSection[];
  analyzed_at: string;
  eligibility: string[];
  submission_method?: string | null;
  evaluation_criteria: string[];
  benefits: string[];
  cautions: string[];
  uncertain_fields: string[];
  source_evidence: SourceEvidence[];
  missing_questions: MissingQuestion[];
  support_programs: SupportProgram[];
}

export interface CompanyProfile {
  name: string;
  industry: string;
  stage: string;
  region: string;
  team_size?: number | null;
  strengths: string;
  needs: string;
  previous_support: string;
}

export interface MatchSignal {
  label: string;
  status: 'match' | 'gap' | 'unknown';
  detail: string;
}

export interface MatchReport {
  score: number;
  verdict: string;
  signals: MatchSignal[];
  missing_inputs: string[];
  recommended_next_steps: string[];
}

export interface UserInputField {
  id: string;
  label: string;
  field_type: InputFieldType;
  required: boolean;
  section_id?: string | null;
  description?: string | null;
  placeholder?: string | null;
  value: string;
}

export interface DraftSection {
  id: string;
  section_id: string;
  title: string;
  content_markdown: string;
  purpose: string;
  related_criteria: string[];
  source_evidence_ids: string[];
  revision_notes: string[];
  status: DraftStatus;
  needs_confirmation: string[];
  confirmation_required: string[];
  user_feedback: string;
  updated_at?: string | null;
}

export interface DraftStreamEvent {
  type: DraftStreamEventType;
  workflow_id: string;
  section_id?: string | null;
  content: string;
  draft_section?: DraftSection | null;
}

export interface FinalDocument {
  title: string;
  content_markdown: string;
  created_at: string;
}

export interface WorkflowSession {
  id: string;
  analysis: AnalysisResult;
  company_profile?: CompanyProfile | null;
  match_report?: MatchReport | null;
  status: WorkflowStatus;
  user_inputs: UserInputField[];
  draft_sections: DraftSection[];
  final_document?: FinalDocument | null;
  confirmed_at?: string | null;
  confirmed_items: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiResponse {
  success: boolean;
  data: AnalysisResult;
  match_report?: MatchReport | null;
}

export interface WorkflowResponse {
  success: boolean;
  data: WorkflowSession;
}

export interface ApiError {
  detail: string;
}

export interface ExportResponse {
  success: boolean;
  filename: string;
  content_type: string;
  content: string;
  encoding: 'text' | 'base64';
  warnings: string[];
  validation_summary: Record<string, unknown>;
}

export interface ExportMetadata {
  id: string;
  workflow_id: string;
  filename: string;
  content_type: string;
  export_type: string;
  size_bytes: number;
  created_at: string;
  status: ExportJobStatus;
  error_message?: string | null;
  validation_summary: Record<string, unknown>;
}

export interface ExportListResponse {
  success: boolean;
  data: ExportMetadata[];
}

export interface AgencyNoticeReference {
  id: string;
  source_type: AgencyReferenceSourceType;
  filename: string;
  title: string;
  text: string;
  evidence_label: string;
}

export interface AgencyNoticeBrief {
  organization_id: string;
  author_id: string;
  author_name: string;
  agency_name: string;
  title: string;
  program_type: string;
  program_purpose: string;
  budget: string;
  program_period: string;
  eligibility_rules: string;
  support_details: string;
  evaluation_criteria: string;
  submission_method: string;
  required_documents: string[];
  contact: string;
  legal_basis: string;
  privacy_policy: string;
  fair_competition_clause: string;
  appeal_process: string;
  references: AgencyNoticeReference[];
}

export interface AgencySourceEvidence {
  id: string;
  label: string;
  quote: string;
  source_type: AgencyReferenceSourceType;
  confidence: number;
}

export interface AgencySourceTrace {
  evidence_id: string;
  label: string;
  quote: string;
  source_type: AgencyReferenceSourceType;
  field_name?: string | null;
  reference_id?: string | null;
  confidence: number;
}

export interface AgencyNoticeSection {
  id: string;
  title: string;
  content_markdown: string;
  order: number;
  source_evidence_ids: string[];
  source_traces: AgencySourceTrace[];
  confirmation_required: string[];
  updated_at: string;
}

export interface MandatoryClauseCheck {
  id: string;
  label: string;
  status: AgencyClauseStatus;
  note: string;
  source_evidence_ids: string[];
  source_traces: AgencySourceTrace[];
  confirmation_required: string[];
}

export interface NoticeVersion {
  id: string;
  draft_id: string;
  version_number: number;
  created_by: string;
  change_summary: string;
  sections_snapshot: AgencyNoticeSection[];
  mandatory_clause_checks: MandatoryClauseCheck[];
  created_at: string;
}

export interface ApprovalStep {
  id: string;
  draft_id: string;
  step_order: number;
  title: string;
  role: AgencyMemberRole;
  assigned_to?: string | null;
  status: AgencyApprovalStepStatus;
  decided_at?: string | null;
  decision_note: string;
}

export interface ApprovalComment {
  id: string;
  draft_id: string;
  version_id: string;
  section_id?: string | null;
  author_id: string;
  author_name: string;
  body: string;
  resolved: boolean;
  created_at: string;
}

export interface NoticeAuditEvent {
  id: string;
  draft_id: string;
  actor_id: string;
  action: string;
  message: string;
  created_at: string;
}

export interface ApprovalWorkflow {
  status: AgencyNoticeStatus;
  current_step_order: number;
  steps: ApprovalStep[];
}

export interface AgencyNoticeDraft {
  id: string;
  organization_id: string;
  title: string;
  status: AgencyNoticeStatus;
  brief: AgencyNoticeBrief;
  sections: AgencyNoticeSection[];
  mandatory_clause_checks: MandatoryClauseCheck[];
  source_evidence: AgencySourceEvidence[];
  confirmation_required: string[];
  versions: NoticeVersion[];
  approval_workflow: ApprovalWorkflow;
  comments: ApprovalComment[];
  audit_events: NoticeAuditEvent[];
  current_version_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyNoticeDraftResponse {
  success: boolean;
  data: AgencyNoticeDraft;
}

export interface AgencyNoticeListResponse {
  success: boolean;
  data: AgencyNoticeDraft[];
}

export interface ClauseLibraryEntry {
  id: string;
  organization_id: string;
  clause_type: string;
  label: string;
  required_for_program_types: string[];
  template_text: string;
  source: AgencyClauseSource;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClauseLibraryListResponse {
  success: boolean;
  data: ClauseLibraryEntry[];
}

export interface ClauseLibraryEntryResponse {
  success: boolean;
  data: ClauseLibraryEntry;
}

export interface AgencyPriorNotice {
  id: string;
  organization_id: string;
  title: string;
  program_type: string;
  budget: string;
  budget_band: string;
  program_period: string;
  summary: string;
  text: string;
  source_filename: string;
  source_type: AgencyReferenceSourceType;
  source_evidence: AgencySourceEvidence[];
  embedding: number[];
  embedding_model: string;
  embedding_dimension: number;
  created_at: string;
  updated_at: string;
}

export interface AgencyPriorNoticeResponse {
  success: boolean;
  data: AgencyPriorNotice;
}

export interface AgencyPriorNoticeRecallItem {
  id: string;
  title: string;
  program_type: string;
  budget_band: string;
  program_period: string;
  summary: string;
  similarity: number;
  source_evidence: AgencySourceEvidence[];
}

export interface AgencyPriorNoticeRecallResponse {
  success: boolean;
  data: AgencyPriorNoticeRecallItem[];
}

export interface HwpxPlaceholderMapResponse {
  success: boolean;
  export_job_id: string;
  workflow_id: string;
  template_id: string;
  format: 'HWPX';
  status: 'completed' | 'completed_with_warnings';
  placeholder_map: Record<string, string>;
  warnings: string[];
  generated_at: string;
  download_id?: string | null;
}

export interface HwpxStatusResponse {
  success: boolean;
  enabled: boolean;
  skill_dir: string;
  scripts_found: Record<string, boolean>;
  validation_available: boolean;
  template_clone_available: boolean;
  pdf_export_available: boolean;
  pdf_converter?: string | null;
  pdf_warnings: string[];
  warnings: string[];
}

export interface HwpxComposeResponse extends ExportResponse {
  template_id: string;
  download_id?: string | null;
  download_url?: string | null;
  verification: {
    validation_passed?: boolean;
    validation_method?: string;
    validation_errors?: string[];
    structure_status?: string;
    structure_preserved?: boolean;
    text_extraction_method?: string;
    text_contains_generated_content?: boolean;
    extracted_text_excerpt?: string;
    verify_report?: Record<string, unknown>;
    [key: string]: unknown;
  };
  generated_fields: Record<string, string>;
  confirmation_required: string[];
}

export interface HwpxTemplateCell {
  text: string;
  row_span: number;
  col_span: number;
  id?: string;
  align?: 'left' | 'center' | 'right';
  vertical_align?: 'top' | 'middle' | 'bottom';
  width?: number;
  background?: string;
  editable?: boolean;
  source_ref?: Record<string, unknown>;
  style?: {
    fontSize?: number;
    bold?: boolean;
    color?: string;
    lineHeight?: number;
    minHeight?: number;
    padding?: {
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;
    };
    borderFillId?: string;
  };
}

export interface HwpxTemplateBlock {
  id: string;
  type: 'paragraph' | 'table' | 'checkboxGroup' | 'heading' | 'spacer' | 'signature';
  role: string;
  section_index: number;
  text: string;
  rows: HwpxTemplateCell[][];
  style?: HwpxTextStyle;
  options?: HwpxCheckboxOption[];
  source_ref?: Record<string, unknown>;
}

export interface HwpxTemplateField {
  id: string;
  label: string;
  value: string;
  required: boolean;
  block_id: string;
}

export interface HwpxTemplateSection {
  heading: string;
  body: string;
  block_ids: string[];
}

export interface HwpxTemplateAnalysisResponse {
  success: boolean;
  source_filename: string;
  title: string;
  organization: string;
  summary: string;
  preview_image?: string | null;
  blocks: HwpxTemplateBlock[];
  fields: HwpxTemplateField[];
  sections: HwpxTemplateSection[];
  attachments: string[];
  stats: Record<string, number>;
  warnings: string[];
}

export interface HwpxRenderPage {
  page_index: number;
  image_base64: string;
  width: number;
  height: number;
}

export interface HwpxEditableRegion {
  id: string;
  kind: 'text' | 'textarea' | 'checkbox' | 'signature' | 'table';
  label: string;
  section_heading: string;
  display_order: number;
  page_index: number;
  bbox: { x: number; y: number; width: number; height: number };
  value: string;
  prompt: string;
  placeholder_hint: string;
  draft_status: 'empty' | 'drafted' | 'revised';
  source_ref: Record<string, unknown>;
}

export interface HwpxFormSession {
  id: string;
  source_filename: string;
  canonical_hwpx_storage_path?: string | null;
  analysis: Record<string, unknown> & {
    title?: string;
    organization?: string;
    summary?: string;
    blocks?: HwpxTemplateBlock[];
    fields?: HwpxTemplateField[];
    sections?: HwpxTemplateSection[];
    attachments?: string[];
    preview_image?: string | null;
    stats?: Record<string, number>;
  };
  pages: HwpxRenderPage[];
  regions: HwpxEditableRegion[];
  status: 'analyzed' | 'editing' | 'exported';
  warnings: string[];
  created_at: string;
  updated_at: string;
}

export interface HwpxFormSessionResponse {
  success: boolean;
  data: HwpxFormSession;
}

export interface HwpxRegionDraftPreviewResponse {
  success: boolean;
  region_id: string;
  content: string;
  prompt: string;
}

export interface HwpxConvertResponse extends ExportResponse {
  source_filename: string;
  conversion_method: string;
  warnings: string[];
}

export interface NoticeSection {
  heading: string;
  body: string;
}

export interface NoticeSchedule {
  applicationPeriod: string;
  eventPeriod: string;
}

export interface NoticeContact {
  department: string;
  phone: string;
  email: string;
}

export type DocumentStyleProfileMode = 'preserve-official-form' | 'submission' | 'proposal' | 'report';

export interface DocumentStyleProfile {
  id: string;
  name: string;
  description: string;
  mode: DocumentStyleProfileMode;
  colors: {
    primary: string;
    primarySoft: string;
    accent: string;
    accentSoft: string;
    text: string;
    muted: string;
    border: string;
    surface: string;
    tableHeaderBg: string;
    tableHeaderText: string;
  };
  typography: {
    fontFamily: string;
    titleSize: string;
    titleWeight: number;
    headingWeight: number;
    bodySize: string;
    lineHeight: string;
  };
  section: {
    headingStyle: 'plain-underlined' | 'left-rule' | 'boxed' | 'numbered-band';
    spacing: 'compact' | 'normal' | 'wide';
  };
  table: {
    headerStyle: 'preserve' | 'tinted' | 'solid' | 'minimal';
    borderColor: string;
    zebra: boolean;
    density: 'compact' | 'comfortable';
  };
  preview: {
    pageBackground: string;
    documentBackground: string;
    selectedOutline: string;
    note: string;
  };
}

export interface HwpxTextStyle {
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  bold?: boolean;
  color?: string;
  lineHeight?: number;
  marginTop?: number;
  marginBottom?: number;
}

export interface HwpxParagraphBlock {
  id: string;
  type: 'paragraph';
  text: string;
  style?: HwpxTextStyle;
  editable: boolean;
}

export interface HwpxHeadingBlock {
  id: string;
  type: 'heading';
  text: string;
  level: 1 | 2 | 3;
  style?: Pick<HwpxTextStyle, 'align' | 'fontSize' | 'bold'>;
  editable: boolean;
}

export interface HwpxTableCell {
  id: string;
  text: string;
  rowSpan?: number;
  colSpan?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  background?: string;
  editable: boolean;
}

export interface HwpxTableBlock {
  id: string;
  type: 'table';
  rows: Array<{ cells: HwpxTableCell[] }>;
  style?: {
    borderCollapse?: boolean;
    width?: string;
  };
}

export interface HwpxCheckboxOption {
  id: string;
  label: string;
  checked: boolean;
}

export interface HwpxCheckboxGroupBlock {
  id: string;
  type: 'checkboxGroup';
  label?: string;
  options: HwpxCheckboxOption[];
  editable: boolean;
}

export interface HwpxSpacerBlock {
  id: string;
  type: 'spacer';
  height: number;
}

export interface HwpxSignatureBlock {
  id: string;
  type: 'signature';
  dateText: string;
  signerLabel: string;
  organizationText?: string;
  editable: boolean;
}

export type HwpxBlock =
  | HwpxParagraphBlock
  | HwpxHeadingBlock
  | HwpxTableBlock
  | HwpxCheckboxGroupBlock
  | HwpxSpacerBlock
  | HwpxSignatureBlock;

export interface HwpxPage {
  id: string;
  blocks: HwpxBlock[];
}

export interface HwpxDocumentModel {
  id: string;
  title: string;
  sourceFileName?: string;
  pages: HwpxPage[];
  metadata: {
    templateId?: string;
    documentType: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface NoticeDocument {
  documentType: string;
  title: string;
  organization: string;
  purpose: string;
  applicationMethod: string;
  sections: NoticeSection[];
  schedule: NoticeSchedule;
  contact: NoticeContact;
  attachments: string[];
  documentModel?: HwpxDocumentModel;
}

export interface NoticeGenerateResponse {
  success: boolean;
  data: NoticeDocument;
  preview_markdown: string;
  warnings: string[];
}

export interface NoticeAnalysisResult {
  noticeName: string;
  organization: string;
  applicationPeriod: string;
  deadline: string;
  eligibility: string;
  targetAudience: string;
  supportContent: string;
  requiredDocuments: string[];
  evaluationCriteria: string;
  submissionMethod: string;
  notes: string;
  requiredWritingItems: string[];
  itemsNeedingConfirmation: string[];
}

export interface QuestionField {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'textarea' | 'tel' | 'email';
}
