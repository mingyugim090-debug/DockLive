// 공고 유형
export type DocType = 'competition' | 'research' | 'scholarship' | 'startup';

// 체크리스트 항목 카테고리
export type ItemCategory = 'required' | 'optional';

// D-Day 상태
export type DayStatus = 'safe' | 'warning' | 'danger' | 'passed';

// 타임라인 아이템
export interface TimelineItem {
  id: string;
  label: string;
  date: string; // "YYYY-MM-DD"
  d_day: number;
  is_deadline: boolean;
  status: DayStatus;
}

// 체크리스트 아이템
export interface ChecklistItem {
  id: string;
  label: string;
  category: ItemCategory;
  description?: string;
  file_format?: string;
}

// 문서 섹션
export interface DocumentSection {
  id: string;
  title: string;
  hint: string;
  order: number;
}

// 분석 결과 전체
export interface AnalysisResult {
  id: string;
  doc_type: DocType;
  title: string;
  organization: string;
  timeline: TimelineItem[];
  checklist: ChecklistItem[];
  document_template: DocumentSection[];
  analyzed_at: string;
}

// API 응답
export interface ApiResponse {
  success: boolean;
  data: AnalysisResult;
}

// API 에러
export interface ApiError {
  detail: string;
}
