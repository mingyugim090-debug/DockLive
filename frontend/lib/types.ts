export type DocType = 'competition' | 'research' | 'scholarship' | 'startup';
export type ItemCategory = 'required' | 'optional';
export type DayStatus = 'safe' | 'warning' | 'danger' | 'passed';
export type SourceType = 'pdf' | 'url' | 'text' | 'demo';
export type InputFieldType = 'text' | 'textarea' | 'number' | 'date' | 'file_note';
export type DraftStatus = 'empty' | 'needs_input' | 'drafted' | 'revised' | 'confirmed';
export type DraftStreamEventType = 'section_start' | 'delta' | 'section_done' | 'workflow_done' | 'error';
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
