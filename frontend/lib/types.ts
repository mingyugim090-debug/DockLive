export type DocType = 'competition' | 'research' | 'scholarship' | 'startup';
export type ItemCategory = 'required' | 'optional';
export type DayStatus = 'safe' | 'warning' | 'danger' | 'passed';
export type InputFieldType = 'text' | 'textarea' | 'number' | 'date' | 'file_note';
export type DraftStatus = 'empty' | 'needs_input' | 'drafted' | 'revised' | 'confirmed';
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

export interface AnalysisResult {
  id: string;
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
  user_feedback: string;
  updated_at?: string | null;
}

export interface FinalDocument {
  title: string;
  content_markdown: string;
  created_at: string;
}

export interface WorkflowSession {
  id: string;
  analysis: AnalysisResult;
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
}

export interface WorkflowResponse {
  success: boolean;
  data: WorkflowSession;
}

export interface ApiError {
  detail: string;
}
