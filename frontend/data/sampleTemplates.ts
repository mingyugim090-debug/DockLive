import type { NoticeTemplate } from './mockTemplates';
import { noticeTemplates } from './mockTemplates';

export interface SampleTemplate extends NoticeTemplate {
  fileName: string;
  hwpxPath: string;
  previewPdfPath?: string;
  category: string;
  previewFeatures: string[];
  editableFields: string[];
}

type SampleMeta = {
  fileName: string;
  hwpxPath: string;
  previewPdfPath?: string;
  category: string;
  previewFeatures: string[];
  editableFields: string[];
};

const sampleMetaMap: Record<string, SampleMeta> = {
  startup_camp_notice: {
    fileName: 'startup-camp-notice.hwpx',
    hwpxPath: '/samples/startup-camp/startup-camp-notice.hwpx',
    category: '창업 지원',
    previewFeatures: [
      '신청서와 개인정보 동의서를 붙임으로 두는 참가자 모집 양식에 맞춤',
      '아이디어 요약서와 팀 역량 칸을 별도로 강조',
      '평가 배점 구조를 점수 그래프로 시각화',
    ],
    editableFields: ['공고 제목', '기관명', '모집 대상', '신청 기간', '신청 방법'],
  },
  business_support_notice: {
    fileName: 'business-support-notice.hwpx',
    hwpxPath: '/samples/business-support/business-support-notice.hwpx',
    category: '지원사업',
    previewFeatures: [
      '지원 분야 표와 제출 서류 묶음을 전면 배치',
      '서류평가 배점 구조를 지원사업형으로 변경',
      '기업 진단 항목과 참여 제한 체크리스트 포함',
    ],
    editableFields: ['공고 제목', '기관명', '지원 대상', '신청 기간', '신청 방법'],
  },
  education_program_notice: {
    fileName: 'education-program-notice.hwpx',
    hwpxPath: '/samples/education-program/education-program-notice.hwpx',
    category: '교육 프로그램',
    previewFeatures: [
      '교육 일정표와 수료 기준을 별도 표로 강조',
      '수강생 모집 공고에서 자주 보이는 과정별 정원 칸 반영',
      '출석률 및 과제 제출 기준을 하단에 명시',
    ],
    editableFields: ['공고 제목', '기관명', '수강 대상', '신청 기간', '신청 방법'],
  },
  event_participant_notice: {
    fileName: 'event-participant-notice.hwpx',
    hwpxPath: '/samples/event-participant/event-participant-notice.hwpx',
    category: '행사 모집',
    previewFeatures: [
      '참가자 모집 공고처럼 일정과 유의사항을 앞쪽에 배치',
      '모집 인원과 참가비 확인 칸을 표 안에 유지',
      '선정 안내 방법과 행사 당일 안내 포함',
    ],
    editableFields: ['공고 제목', '기관명', '참가 대상', '접수 기간', '신청 방법'],
  },
  scholarship_notice: {
    fileName: 'scholarship-notice.hwpx',
    hwpxPath: '/samples/scholarship/scholarship-notice.hwpx',
    category: '장학금',
    previewFeatures: [
      '공통서류와 분야별 추가서류를 나누는 장학 공고 양식 반영',
      '성적·소득·추천 항목을 평가표처럼 표시',
      '중복수혜 확인 체크리스트 포함',
    ],
    editableFields: ['공고 제목', '기관명', '신청 자격', '신청 기간', '제출 서류'],
  },
  tenant_company_notice: {
    fileName: 'tenant-company-notice.hwpx',
    hwpxPath: '/samples/tenant-company/tenant-company-notice.hwpx',
    category: '입주 모집',
    previewFeatures: [
      '입주 신청서와 사업계획서가 함께 첨부되는 공고 구조 반영',
      '공간 유형과 주소지 등록 가능 여부를 표로 표현',
      '입주 기간 및 보육 프로그램 연장 조건 명시',
    ],
    editableFields: ['공고 제목', '기관명', '입주 대상', '신청 기간', '신청 방법'],
  },
  research_participant_notice: {
    fileName: 'research-participant-notice.hwpx',
    hwpxPath: '/samples/research-participant/research-participant-notice.hwpx',
    category: '연구 과제',
    previewFeatures: [
      '연구 과제 신청서에서 자주 쓰는 윤리·보안 체크 영역 반영',
      '참여 역할과 수행 내용을 표로 분리',
      '자료 보안 및 이해상충 확인 항목 포함',
    ],
    editableFields: ['공고 제목', '기관명', '참여 대상', '참여 기간', '신청 방법'],
  },
  bid_rfp_notice: {
    fileName: 'bid-rfp-notice.hwpx',
    hwpxPath: '/samples/bid-rfp/bid-rfp-notice.hwpx',
    category: '입찰·제안',
    previewFeatures: [
      'RFP의 기술제안서·가격제안서 분리 제출 구조 반영',
      '기술/가격 평가 비중을 공고문처럼 표시',
      '제출 목차와 서약서 항목 체크리스트 포함',
    ],
    editableFields: ['공고 제목', '기관명', '과업명', '제출 기간', '제출 방법'],
  },
};

export const sampleTemplates: SampleTemplate[] = noticeTemplates.map((t) => ({
  ...t,
  ...(sampleMetaMap[t.id] ?? {
    fileName: `${t.id}.hwpx`,
    hwpxPath: `/samples/${t.id}/${t.id}.hwpx`,
    category: t.purpose,
    previewFeatures: [],
    editableFields: [],
  }),
}));

export function getSampleTemplate(id: string | null | undefined): SampleTemplate {
  return sampleTemplates.find((t) => t.id === id) ?? sampleTemplates[0];
}
