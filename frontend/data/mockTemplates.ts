import type { HwpxDocumentModel } from '@/lib/types';
import { getHwpxTemplateModel } from './hwpxDocumentModels';

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
  sample: NoticeTemplateSample;
}

export interface NoticeTemplateSample {
  layout: 'notice' | 'application' | 'program' | 'scholarship' | 'research' | 'rfp';
  sourceName: string;
  sourceUrl: string;
  documentNo: string;
  organization: string;
  title: string;
  intro: string;
  overviewRows: Array<[string, string]>;
  sections: Array<{ heading: string; body: string[] }>;
  attachments: string[];
  documentModel?: HwpxDocumentModel;
}

const commonFields: NoticeInputField[] = [
  { id: 'title', label: '공고 제목', type: 'text', required: true, placeholder: '예: 2026년 청년 창업캠프 참가자 모집 공고' },
  { id: 'organization', label: '기관명', type: 'text', required: true, placeholder: '예: OO대학교 창업지원단' },
  { id: 'target', label: '모집 대상', type: 'textarea', required: true, placeholder: '예: 창업 아이디어를 보유한 대학생 및 예비창업자' },
  { id: 'capacity', label: '모집 인원', type: 'text', required: false, placeholder: '예: 30명 내외' },
  { id: 'applicationPeriod', label: '신청 기간', type: 'text', required: true, placeholder: '예: 2026. 6. 1.(월) ~ 6. 20.(금) 18:00' },
  { id: 'eventPeriod', label: '운영 일정', type: 'text', required: false, placeholder: '예: 2026. 7. 3.(금) ~ 7. 5.(일)' },
  { id: 'applicationMethod', label: '신청 방법', type: 'textarea', required: true, placeholder: '예: 신청서 작성 후 이메일 제출' },
  { id: 'selectionCriteria', label: '선정 기준', type: 'textarea', required: false, placeholder: '예: 참여 의지, 아이디어 구체성, 서류 완성도' },
  { id: 'benefit', label: '지원 내용', type: 'textarea', required: false, placeholder: '예: 교육, 멘토링, 발표 코칭, 수료증' },
  { id: 'documents', label: '제출 서류', type: 'textarea', required: false, placeholder: '예: 참가 신청서, 개인정보 수집 및 이용 동의서' },
  { id: 'department', label: '담당 부서', type: 'text', required: false, placeholder: '예: 창업지원팀' },
  { id: 'phone', label: '연락처', type: 'tel', required: false, placeholder: '예: 02-000-0000' },
  { id: 'email', label: '이메일', type: 'email', required: false, placeholder: '예: notice@example.go.kr' },
  { id: 'attachments', label: '붙임 문서 목록', type: 'textarea', required: false, placeholder: '예: 참가 신청서 1부\n개인정보 수집 및 이용 동의서 1부' },
];

function template(
  id: string,
  name: string,
  purpose: string,
  description: string,
  accent: string,
  sample: NoticeTemplateSample,
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
    previewSections: ['공고 안내문', '참가 신청서', '1. 사업 개요', '2. 신청 자격', '3. 선정 방법', '4. 신청 방법', '문의처', '붙임 문서'],
    sample: { ...sample, documentModel: getHwpxTemplateModel(id) },
  };
}

const baseSections = {
  startup: [
    { heading: '1. 사업 개요', body: ['창업 아이디어 검증, 시장 분석, 사업계획서 작성 실습을 중심으로 캠프를 운영합니다.'] },
    { heading: '2. 신청 자격', body: ['창업 아이디어를 보유하거나 창업 교육 참여 의지가 있는 개인 또는 팀을 대상으로 합니다.'] },
    { heading: '3. 선정 방법', body: ['신청서 충실도, 아이디어 구체성, 참여 의지를 종합 검토하여 선정합니다.'] },
    { heading: '4. 신청 방법', body: ['붙임 신청서와 개인정보 수집 및 이용 동의서를 작성하여 담당 부서 이메일로 제출합니다.'] },
  ],
  support: [
    { heading: '1. 사업 목적', body: ['참여기업의 제품 경쟁력과 시장 진입 가능성을 높이기 위한 맞춤형 지원을 제공합니다.'] },
    { heading: '2. 지원 내용', body: ['선정 기업별 진단 결과에 따라 교육, 멘토링, 홍보물 제작, 사업화 비용을 연계합니다.'] },
    { heading: '3. 평가 기준', body: ['지원 필요성, 사업계획 적정성, 기대 효과, 수행 역량을 기준으로 평가합니다.'] },
    { heading: '4. 제출 방법', body: ['공고문 붙임 서식을 작성하여 접수 마감일 전까지 온라인 또는 이메일로 제출합니다.'] },
  ],
  program: [
    { heading: '1. 교육 개요', body: ['이론 강의와 실습을 병행하여 교육 목적에 맞는 실무 역량을 높입니다.'] },
    { heading: '2. 모집 과정', body: ['기초 과정, 심화 과정, 프로젝트 과정 등 과정별 정원에 따라 모집합니다.'] },
    { heading: '3. 신청 절차', body: ['온라인 신청서 제출 후 선착순 또는 내부 기준에 따라 수강 대상을 확정합니다.'] },
    { heading: '4. 유의 사항', body: ['교육 일정과 장소는 운영 상황에 따라 변경될 수 있으며 변경 시 별도 안내합니다.'] },
  ],
  rfp: [
    { heading: '1. 입찰 개요', body: ['사업명, 사업 예산, 계약 기간, 입찰 방식을 명시합니다.'] },
    { heading: '2. 참가 자격', body: ['관련 법령과 공고에서 정한 자격 요건을 모두 충족해야 합니다.'] },
    { heading: '3. 제안서 제출', body: ['제출 기한, 제출 장소, 제출 부수와 파일 형식을 확인하여 제출합니다.'] },
    { heading: '4. 평가 및 계약', body: ['기술 평가와 가격 평가를 거쳐 우선협상대상자를 선정합니다.'] },
  ],
};

export const noticeTemplates: NoticeTemplate[] = [
  template('startup_camp_notice', '창업캠프 모집 공고문', '창업캠프 참가자 모집', '캠프 목적, 참가 대상, 일정, 신청 방법을 실제 공고문 형식으로 정리합니다.', '#4F7CAC', {
    layout: 'application',
    sourceName: '강원대학교 창업경진대회 HWPX 공고 첨부',
    sourceUrl: 'https://biology.kangwon.ac.kr/biology/selectBbsNttView.do?bbsNo=222&key=1011&nttNo=165079',
    documentNo: '창업지원단 공고 제2026-01호',
    organization: 'OO대학교 창업지원단',
    title: '2026년 청년 창업캠프 참가자 모집 공고',
    intro: '예비창업자의 사업화 역량 강화와 창업 아이디어 고도화를 위하여 다음과 같이 참가자를 모집합니다.',
    overviewRows: [['모집 대상', '창업에 관심 있는 대학생 및 예비창업자'], ['모집 규모', '30명 내외 또는 10개 팀 내외'], ['운영 기간', '2026. 7. 3.(금) ~ 7. 5.(일)'], ['지원 내용', '창업 교육, 멘토링, 발표 코칭, 수료증']],
    sections: baseSections.startup,
    attachments: ['참가 신청서', '개인정보 수집 및 이용 동의서', '창업 아이디어 요약서'],
  }),
  template('business_support_notice', '지원사업 참여기업 모집 공고문', '지원사업 참여기업 모집', '지원 대상, 지원 내용, 평가 절차, 제출 서류를 참여기업 모집 공고에 맞춰 구성합니다.', '#3A8F7B', {
    layout: 'notice',
    sourceName: 'KOCCA/WelCon 참여기업 모집 HWPX 공고 양식',
    sourceUrl: 'https://welcon.kocca.kr/en/info/business/1955732',
    documentNo: '지원사업 공고 제2026-02호',
    organization: 'OO산업진흥원',
    title: '2026년 지원사업 참여기업 모집 공고',
    intro: '지역 기업의 성장 기반 마련과 사업화 역량 강화를 위하여 참여기업을 다음과 같이 모집합니다.',
    overviewRows: [['지원 대상', '관내 소재 중소기업 및 스타트업'], ['지원 규모', '예산 범위 내 선정'], ['지원 내용', '컨설팅, 홍보물 제작, 판로 개척, 사업화 비용 일부'], ['평가 절차', '요건 검토, 서면 평가, 필요 시 발표 평가']],
    sections: baseSections.support,
    attachments: ['참여 신청서', '사업계획서', '기업정보 제공 및 활용 동의서', '사업자등록증'],
  }),
  template('education_program_notice', '교육 프로그램 수강생 모집 공고문', '교육 프로그램 수강생 모집', '교육 목적, 수강 대상, 교육 일정, 신청 절차와 수료 안내를 한 문서로 만듭니다.', '#6C7A89', {
    layout: 'program',
    sourceName: '교육 프로그램 HWP 안내 양식',
    sourceUrl: 'https://www.mokwon.ac.kr/kr/html/sub06/0601.html?GotoPage=121&mode=V&no=5d2b89c217f2ac6ec5700d58072a4c6a',
    documentNo: '교육운영 공고 제2026-03호',
    organization: 'OO교육센터',
    title: '2026년 교육 프로그램 수강생 모집 공고',
    intro: '전문 역량 향상과 실무 경험 확보를 위하여 교육 프로그램 수강생을 아래와 같이 모집합니다.',
    overviewRows: [['교육 대상', '교육 주제에 관심 있는 시민, 학생, 재직자'], ['교육 인원', '과정별 25명 내외'], ['교육 방식', '대면 강의, 실습, 조별 프로젝트'], ['수료 기준', '출석률 및 과제 제출 기준 충족']],
    sections: baseSections.program,
    attachments: ['수강 신청서', '교육 일정표', '개인정보 수집 및 이용 동의서'],
  }),
  template('event_participant_notice', '행사 참가자 모집 공고문', '행사 참가자 모집', '행사 개요, 참가 대상, 접수 기간, 참여 방법과 유의사항을 안내문 톤으로 작성합니다.', '#B07D62', {
    layout: 'notice',
    sourceName: '문화재단 참가자 모집 PDF 공고 양식',
    sourceUrl: 'https://www.ysfac.or.kr/upfiles/editor/2025_09/0ca0834037879f8bc.pdf?ver=0.5821070726355883',
    documentNo: '행사운영 공고 제2026-04호',
    organization: 'OO문화재단',
    title: '2026년 행사 참가자 모집 공고',
    intro: '지역 주민의 참여 확대와 행사 활성화를 위하여 참가자를 다음과 같이 모집합니다.',
    overviewRows: [['행사명', 'OO 참여형 문화행사'], ['참가 대상', '행사 주제에 관심 있는 개인 또는 단체'], ['모집 인원', '프로그램별 정원 내 모집'], ['참가 비용', '무료 또는 일부 자부담']],
    sections: baseSections.program,
    attachments: ['참가 신청서', '행사 운영 일정표', '유의사항 확인서'],
  }),
  template('scholarship_notice', '장학생 모집 공고문', '장학생 모집', '신청 자격, 선발 인원, 장학 내용, 제출 서류와 문의처를 명확하게 정리합니다.', '#7A8B54', {
    layout: 'scholarship',
    sourceName: '장학생 선발 HWP 공고 양식',
    sourceUrl: 'https://www.donggu.go.kr/dg/attach/preview/5288c5a713acaf0525f0f7f948bfc0c5/778bdbf5db9ced7c8fd52756c00bf0cd',
    documentNo: '장학 공고 제2026-05호',
    organization: 'OO장학재단',
    title: '2026년 장학생 모집 공고',
    intro: '우수 인재의 학업 지속과 성장 지원을 위하여 장학생을 다음과 같이 선발합니다.',
    overviewRows: [['신청 자격', '학업 성적, 소득 기준, 활동 실적 등 공고 기준 충족자'], ['선발 인원', 'OO명 내외'], ['장학 금액', '등록금 또는 생활비 일부 지원'], ['선발 절차', '서류 심사, 필요 시 면접 심사']],
    sections: baseSections.support,
    attachments: ['장학금 신청서', '추천서', '개인정보 수집 및 이용 동의서', '증빙서류 목록'],
  }),
  template('tenant_company_notice', '입주기업 모집 공고문', '창업보육센터 및 공간 입주기업 모집', '입주 대상, 모집 규모, 공간 지원, 평가 기준과 계약 절차를 공고문 구조로 작성합니다.', '#6E7F80', {
    layout: 'application',
    sourceName: '기업마당 입주기업 모집 공고 HWP 양식',
    sourceUrl: 'https://bizinfo.go.kr/biz/bizb/selectBIZB200Detail.do?mvnEntrprsRcritPblancId=MVNP_000000000000266',
    documentNo: '입주모집 공고 제2026-06호',
    organization: 'OO창업보육센터',
    title: '2026년 입주기업 모집 공고',
    intro: '창업기업의 안정적인 사업 공간 확보와 성장 지원을 위하여 입주기업을 모집합니다.',
    overviewRows: [['입주 대상', '예비창업자 또는 창업 7년 이내 기업'], ['모집 공간', '사무실, 공유공간 및 회의실'], ['입주 기간', '기본 1년, 평가 후 연장 가능'], ['지원 사항', '공간, 멘토링, 네트워크, 사업 연계']],
    sections: baseSections.support,
    attachments: ['입주 신청서', '사업계획서', '대표자 이력서', '사업자등록증'],
  }),
  template('research_participant_notice', '연구과제 참여자 모집 공고문', '연구과제 참여자 모집', '연구 목적, 참여 조건, 운영 일정, 윤리 안내와 제출 서류를 기관 공고 형식으로 만듭니다.', '#5F819D', {
    layout: 'research',
    sourceName: '연구과제 공모 HWP 신청 양식',
    sourceUrl: 'https://sanhak.kookje.ac.kr/sanhak/index.php?idx=581&mode=view&pCode=projectguide',
    documentNo: '연구과제 공고 제2026-07호',
    organization: 'OO연구원',
    title: '2026년 연구과제 참여자 모집 공고',
    intro: '연구 목적 달성과 과제 수행을 위하여 연구 참여자를 다음과 같이 모집합니다.',
    overviewRows: [['연구 주제', 'OO 분야 정책 연구 및 실증 분석'], ['참여 대상', '관련 분야 전공자 또는 실무 경험자'], ['참여 기간', '계약일로부터 OO개월'], ['참여 내용', '자료 조사, 인터뷰, 분석, 결과 보고']],
    sections: baseSections.support,
    attachments: ['참여 신청서', '연구 수행 계획서', '연구윤리 준수 서약서'],
  }),
  template('bid_rfp_notice', '입찰 및 제안요청 공고문', '입찰 또는 제안서 접수', '과업 범위, 참가 자격, 제출 방식, 평가 기준과 계약 절차를 입찰 공고 형식으로 구성합니다.', '#8A6F5A', {
    layout: 'rfp',
    sourceName: '제안요청서 HWP 입찰 공고 양식',
    sourceUrl: 'https://m.koti.re.kr/user/bbs/bidNotiView.do?bbs_no=69994',
    documentNo: '입찰 공고 제2026-08호',
    organization: 'OO공공기관',
    title: '2026년 용역 입찰 및 제안요청 공고',
    intro: '과업 수행 업체 선정을 위하여 입찰 참가 자격과 제안서 제출 절차를 다음과 같이 공고합니다.',
    overviewRows: [['과업명', 'OO 시스템 구축 및 운영 용역'], ['계약 방법', '제한경쟁입찰 또는 협상에 의한 계약'], ['사업 기간', '계약일로부터 OO개월'], ['제출 방식', '입찰 서류 및 제안서 방문 또는 전자 제출']],
    sections: baseSections.rfp,
    attachments: ['제안요청서', '입찰 참가 신청서', '가격 제안서', '서약서 및 확약서'],
  }),
];

export function getNoticeTemplate(id: string | null | undefined): NoticeTemplate {
  return noticeTemplates.find((template) => template.id === id) ?? noticeTemplates[0];
}

export const mockTemplates = noticeTemplates;
