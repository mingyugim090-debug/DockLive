export type NoticeFieldType = 'text' | 'textarea' | 'date' | 'email' | 'tel';

export interface NoticeInputField {
  id: string;
  label: string;
  type: NoticeFieldType;
  required: boolean;
  placeholder: string;
}

export interface NoticeTemplate {
  id: string;
  name: string;
  purpose: string;
  description: string;
  inputCount: number;
  accent: string;
  fields: NoticeInputField[];
  previewSections: string[];
}

const commonFields: NoticeInputField[] = [
  { id: 'title', label: '공고 제목', type: 'text', required: true, placeholder: '예: 2026년 노원 대학 연합 창업캠프 참가자 모집 공고' },
  { id: 'organization', label: '기관명', type: 'text', required: true, placeholder: '예: 서울과학기술대학교 창업지원단' },
  { id: 'target', label: '모집 대상', type: 'textarea', required: true, placeholder: '예: 창업에 관심 있는 관내 대학생 및 예비창업자' },
  { id: 'applicationPeriod', label: '신청 기간', type: 'text', required: true, placeholder: '예: 2026. 6. 1.(월) ~ 6. 20.(토)' },
  { id: 'eventPeriod', label: '운영 기간', type: 'text', required: false, placeholder: '예: 2026. 7. 3.(금) ~ 7. 5.(일)' },
  { id: 'applicationMethod', label: '신청 방법', type: 'textarea', required: true, placeholder: '예: 기관 홈페이지에서 신청서 내려받아 이메일 제출' },
  { id: 'benefit', label: '지원 내용', type: 'textarea', required: false, placeholder: '예: 교육, 멘토링, 네트워킹, 수료증 발급' },
  { id: 'department', label: '담당 부서', type: 'text', required: true, placeholder: '예: 창업지원팀' },
  { id: 'phone', label: '연락처', type: 'tel', required: false, placeholder: '예: 02-000-0000' },
  { id: 'email', label: '이메일', type: 'email', required: false, placeholder: '예: notice@example.go.kr' },
  { id: 'attachments', label: '붙임 문서', type: 'textarea', required: false, placeholder: '예: 신청서, 개인정보 수집 및 이용 동의서' },
];

function template(
  id: string,
  name: string,
  purpose: string,
  description: string,
  accent: string,
  previewSections: string[],
): NoticeTemplate {
  return {
    id,
    name,
    purpose,
    description,
    inputCount: commonFields.filter((field) => field.required).length,
    accent,
    fields: commonFields,
    previewSections,
  };
}

export const noticeTemplates: NoticeTemplate[] = [
  template(
    'startup_camp_notice',
    '창업캠프 모집 공고문',
    '창업 교육·캠프 참가자 모집',
    '창업캠프 일정, 모집 대상, 신청 방법, 문의처를 행정 공고문 형식으로 정리합니다.',
    '#4F7CAC',
    ['사업 개요', '모집 대상', '운영 일정', '신청 방법', '선정 및 안내'],
  ),
  template(
    'business_support_notice',
    '지원사업 참여기업 모집 공고문',
    '기업 지원사업 참여자 모집',
    '지원 대상, 지원 내용, 평가 절차, 제출 서류를 참여기업 모집 공고로 구성합니다.',
    '#3A8F7B',
    ['사업 개요', '지원 대상', '지원 내용', '신청 방법', '평가 및 선정'],
  ),
  template(
    'education_program_notice',
    '교육 프로그램 수강생 모집 공고문',
    '교육 프로그램 수강생 모집',
    '교육 목적, 수강 대상, 교육 일정, 수료 기준을 한눈에 보이도록 정리합니다.',
    '#6C7A89',
    ['교육 개요', '모집 대상', '교육 일정', '신청 방법', '수료 및 안내'],
  ),
  template(
    'event_participant_notice',
    '행사 참가자 모집 공고문',
    '행사·포럼·설명회 참가자 모집',
    '행사 개요와 참가 신청 절차를 공공기관 안내문 톤으로 작성합니다.',
    '#B07D62',
    ['행사 개요', '모집 대상', '행사 일정', '참가 신청', '유의사항'],
  ),
  template(
    'supporters_notice',
    '대외활동/서포터즈 모집 공고문',
    '대외활동·홍보단·서포터즈 모집',
    '활동 내용, 선발 일정, 활동 혜택을 모집 공고 형식으로 구성합니다.',
    '#7B6FA6',
    ['활동 개요', '모집 대상', '활동 내용', '신청 방법', '선발 일정'],
  ),
  template(
    'scholarship_notice',
    '장학생 모집 공고문',
    '장학금 신청자 모집',
    '신청 자격, 장학 금액, 제출 서류, 선발 기준을 명확하게 정리합니다.',
    '#7A8B54',
    ['장학사업 개요', '신청 자격', '지원 내용', '신청 방법', '선발 기준'],
  ),
  template(
    'research_participant_notice',
    '연구과제 참여자 모집 공고문',
    '연구과제 참여자 모집',
    '연구 목적, 참여 조건, 연구 윤리, 신청 방법을 공고문으로 구성합니다.',
    '#5F819D',
    ['연구 개요', '모집 대상', '참여 내용', '신청 방법', '연구 윤리 및 유의사항'],
  ),
  template(
    'bid_rfp_notice',
    '입찰/제안요청 공고문',
    '입찰 또는 제안서 제출 안내',
    '과업 범위, 참가 자격, 제출 방식, 평가 절차를 입찰 공고 형식으로 작성합니다.',
    '#8A6F5A',
    ['공고 개요', '과업 범위', '입찰 참가 자격', '제안서 제출', '평가 및 계약'],
  ),
];

export function getNoticeTemplate(id: string | null | undefined): NoticeTemplate {
  return noticeTemplates.find((template) => template.id === id) ?? noticeTemplates[0];
}

export const mockTemplates = noticeTemplates;
