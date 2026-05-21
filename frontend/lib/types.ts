export type DocType = 'competition' | 'research' | 'scholarship' | 'startup';
export type ItemCategory = 'required' | 'optional';
export type DayStatus = 'safe' | 'warning' | 'danger' | 'passed';
export type SourceType = 'pdf' | 'url' | 'text' | 'demo' | 'hwpx' | 'hwp';
export type InputFieldType = 'text' | 'textarea' | 'number' | 'date' | 'file_note';
export type DraftStatus = 'empty' | 'needs_input' | 'drafted' | 'revised' | 'confirmed';
export type DraftStreamEventType = 'section_start' | 'delta' | 'section_done' | 'workflow_done' | 'error';
export type ExportJobStatus = 'pending' | 'success' | 'failed' | 'validation_failed';
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

export interface AnalysisResult {
  id: string;
  source_type: SourceType;
  source_name?: string | null;
  summary: string;
  doc_type: DocType;
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
  blocks: HwpxTemplateBlock[];
  fields: HwpxTemplateField[];
  sections: HwpxTemplateSection[];
  attachments: string[];
  stats: Record<string, number>;
  warnings: string[];
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

export interface HwpxTextStyle {
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  bold?: boolean;
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
