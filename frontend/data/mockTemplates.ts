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
  outputFormats: string[];
  accent: string;
  fields: NoticeInputField[];
  previewSections: string[];
}

const commonFields: NoticeInputField[] = [
  { id: 'title', label: '공고 제목', type: 'text', required: true, placeholder: '예: 2026년 청년 창업캠프 참가자 모집 공고' },
  { id: 'organization', label: '기관명', type: 'text', required: true, placeholder: '예: 서울특별시, ○○대학교 창업지원단' },
  { id: 'target', label: '모집 대상', type: 'textarea', required: true, placeholder: '예: 창업에 관심 있는 만 19세 이상 청년, 관내 중소기업 등' },
  { id: 'capacity', label: '모집 인원', type: 'text', required: false, placeholder: '예: 30명 내외 / 10개 기업 / 예산 범위 내 선정' },
  { id: 'applicationPeriod', label: '신청 기간', type: 'text', required: true, placeholder: '예: 2026. 6. 1.(월) ~ 6. 20.(금) 18:00' },
  { id: 'eventPeriod', label: '운영 일정', type: 'text', required: false, placeholder: '예: 2026. 7. 3.(금) ~ 7. 5.(일)' },
  { id: 'applicationMethod', label: '신청 방법', type: 'textarea', required: true, placeholder: '예: 기관 누리집에서 신청서를 내려받아 이메일 제출' },
  { id: 'selectionCriteria', label: '선정 기준', type: 'textarea', required: false, placeholder: '예: 신청 자격 충족 여부, 사업 적합성, 제출 서류 완비 여부' },
  { id: 'benefit', label: '지원 내용', type: 'textarea', required: false, placeholder: '예: 교육, 멘토링, 공간 지원, 사업화 자금, 네트워킹' },
  { id: 'documents', label: '제출 서류', type: 'textarea', required: false, placeholder: '예: 신청서, 사업계획서, 개인정보 수집 및 이용 동의서' },
  { id: 'department', label: '담당 부서', type: 'text', required: true, placeholder: '예: 창업지원팀' },
  { id: 'phone', label: '연락처', type: 'tel', required: false, placeholder: '예: 02-000-0000' },
  { id: 'email', label: '이메일', type: 'email', required: false, placeholder: '예: notice@example.go.kr' },
  { id: 'attachments', label: '붙임 문서 목록', type: 'textarea', required: false, placeholder: '예: 신청서 1부\n개인정보 수집 및 이용 동의서 1부' },
];

function template(
  id: string,
  name: string,
  purpose: string,
  description: string,
  accent: string,
): NoticeTemplate {
  return {
    id,
    name,
    purpose,
    description,
    inputCount: commonFields.filter((field) => field.required).length,
    outputFormats: ['HWPX', 'DOCX', 'PDF'],
    accent,
    fields: commonFields,
    previewSections: [
      '공고 안내문',
      '1. 사업 개요',
      '2. 모집 대상',
      '3. 모집 인원',
      '4. 신청 기간',
      '5. 운영 일정',
      '6. 신청 방법',
      '7. 선정 기준',
      '8. 제출 서류',
      '9. 문의처',
      '붙임 문서 목록',
    ],
  };
}

export const noticeTemplates: NoticeTemplate[] = [
  template(
    'startup_camp_notice',
    '창업캠프 모집 공고문',
    '창업캠프 참가자 모집',
    '캠프 목적, 참가 대상, 일정, 신청 방법, 선정 기준을 행정 공고문 형식으로 정리합니다.',
    '#4F7CAC',
  ),
  template(
    'business_support_notice',
    '지원사업 참여기업 모집 공고문',
    '지원사업 참여기업 모집',
    '지원 대상, 지원 내용, 평가 절차, 제출 서류를 참여기업 모집 공고에 맞춰 구성합니다.',
    '#3A8F7B',
  ),
  template(
    'education_program_notice',
    '교육 프로그램 수강생 모집 공고문',
    '교육 프로그램 수강생 모집',
    '교육 목적, 수강 대상, 교육 일정, 신청 절차와 수료 안내를 한 문서로 만듭니다.',
    '#6C7A89',
  ),
  template(
    'event_participant_notice',
    '행사 참가자 모집 공고문',
    '행사 참가자 모집',
    '행사 개요, 참가 대상, 접수 기간, 참여 방법과 유의사항을 안내문 톤으로 작성합니다.',
    '#B07D62',
  ),
  template(
    'scholarship_notice',
    '장학생 모집 공고문',
    '장학생 모집',
    '신청 자격, 선발 인원, 장학 내용, 제출 서류와 문의처를 명확하게 정리합니다.',
    '#7A8B54',
  ),
  template(
    'tenant_company_notice',
    '입주기업 모집 공고문',
    '창업보육센터·공간 입주기업 모집',
    '입주 대상, 모집 규모, 공간 지원, 평가 기준과 계약 절차를 공고문 구조로 작성합니다.',
    '#6E7F80',
  ),
  template(
    'research_participant_notice',
    '연구과제 참여자 모집 공고문',
    '연구과제 참여자 모집',
    '연구 목적, 참여 조건, 운영 일정, 윤리 안내와 제출 서류를 기관 공고 형식으로 만듭니다.',
    '#5F819D',
  ),
  template(
    'bid_rfp_notice',
    '입찰/제안요청 공고문',
    '입찰 또는 제안서 접수',
    '과업 범위, 참가 자격, 제출 방식, 평가 기준과 계약 절차를 입찰 공고 형식으로 구성합니다.',
    '#8A6F5A',
  ),
];

export function getNoticeTemplate(id: string | null | undefined): NoticeTemplate {
  return noticeTemplates.find((template) => template.id === id) ?? noticeTemplates[0];
}

export const mockTemplates = noticeTemplates;
