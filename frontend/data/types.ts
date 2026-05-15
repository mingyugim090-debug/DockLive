export type DocumentStatus = '분석 완료' | '처리 중' | '오류' | '대기 중';
export type JobStatus = '완료' | '진행 중' | '오류' | '대기';
export type JobType = '요약' | '변환' | '템플릿 적용' | '키워드 추출' | '서식 정리' | '자동 작성';

export interface MockDocument {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'HWPX' | 'TXT';
  size: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  lastJob: JobType;
  category: string;
  summary: string;
  keywords: string[];
  structure: Array<{ title: string; description: string }>;
  generatedResult: string;
}

export interface MockJob {
  id: string;
  name: string;
  documentName: string;
  type: JobType;
  status: JobStatus;
  duration: string;
  createdAt: string;
}

export interface MockTemplate {
  id: string;
  name: string;
  description: string;
  recommendedFor: string;
  output: string;
}
