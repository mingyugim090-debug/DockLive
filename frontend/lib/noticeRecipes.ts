import type { AgencyNoticeBrief, NoticeRecipe, NoticeRecipeId } from './types';

export const NOTICE_RECIPES: NoticeRecipe[] = [
  {
    id: 'lab_recruitment',
    label: '연구실/팀 모집공고',
    description: '학부연구생, 인턴, 팀원을 모집할 때 필요한 내용만 묻습니다.',
    exportStyle: 'friendly_lab',
    recommendedReferenceKeywords: ['연구실 모집', '학부연구생', '참여연구원', '신청 자격'],
    structureChips: ['infoTable', 'eligibilityTable', 'scheduleTable', 'documentListTable', 'noticeBox'],
    directions: [
      {
        id: 'friendly_recruitment',
        label: '친근한 모집형',
        description: '지원자가 부담 없이 읽을 수 있게 부드럽게 정리합니다.',
      },
      {
        id: 'campus_notice',
        label: '캠퍼스 공지형',
        description: '학과 게시판에 바로 올릴 수 있게 간결하게 구성합니다.',
      },
      {
        id: 'iris_official',
        label: 'IRIS 표 형식',
        description: '자격, 일정, 제출서류를 표 중심으로 정리합니다.',
      },
    ],
    fields: [
      { id: 'title', label: '공고 제목', placeholder: '예: CVR 연구실 학부연구생 모집공고', required: true },
      { id: 'lab_name', label: '연구실/팀 이름', placeholder: '예: CVR 연구실', required: true },
      { id: 'lab_intro', label: '연구실 소개', type: 'textarea', placeholder: '어떤 연구를 하는 곳인지 짧게 적어주세요.' },
      { id: 'research_topics', label: '연구 주제', placeholder: '예: 3D vision, robot perception' },
      { id: 'target_applicants', label: '모집 대상', placeholder: '예: 컴퓨터공학 전공 학부생', required: true },
      { id: 'openings', label: '모집 인원', placeholder: '예: 2명 내외' },
      { id: 'activities', label: '활동 내용', type: 'textarea', placeholder: '논문 리뷰, 실험 보조, 데이터셋 정리 등', required: true },
      { id: 'required_qualifications', label: '필수 자격', type: 'textarea', placeholder: '예: Python 기초' },
      { id: 'preferred_qualifications', label: '우대 사항', type: 'textarea', placeholder: '예: PyTorch 경험' },
      { id: 'activity_period', label: '활동 기간', placeholder: '예: 2026년 9월부터 6개월' },
      { id: 'weekly_commitment', label: '예상 참여 시간', placeholder: '예: 주 8시간' },
      { id: 'submission_method', label: '지원 방법', type: 'textarea', placeholder: '예: 이메일로 서류 제출', required: true },
      { id: 'required_documents', label: '제출서류', type: 'textarea', placeholder: '자기소개서\n성적표' },
      { id: 'application_deadline', label: '마감일', placeholder: '예: 2026. 8. 31.' },
      { id: 'contact', label: '문의처', placeholder: '예: cvr@example.edu', required: true },
      { id: 'notes', label: '유의사항', type: 'textarea', placeholder: '지원 전 확인할 내용을 적어주세요.' },
    ],
  },
  {
    id: 'rnd_support',
    label: '정부 R&D/지원사업 공고',
    description: 'IRIS 공고처럼 예산, 자격, 평가, 필수 조항을 꼼꼼히 채웁니다.',
    exportStyle: 'iris_official',
    recommendedReferenceKeywords: ['R&D', '지원사업', '신청자격', '평가 기준'],
    structureChips: ['infoTable', 'procedureTable', 'documentListTable', 'eligibilityTable', 'scheduleTable'],
    directions: [
      {
        id: 'iris_official',
        label: 'IRIS 공식형',
        description: '공공기관 공고문처럼 표와 필수 조항을 단정하게 구성합니다.',
      },
      {
        id: 'concise_notice',
        label: '간결 공지형',
        description: '핵심 조건과 제출 절차를 짧게 보여줍니다.',
      },
    ],
    fields: [
      { id: 'title', label: '공고명', placeholder: '예: 2026년 지역 AI 전환 지원사업 참여기업 모집 공고', required: true },
      { id: 'agency_name', label: '기관명', placeholder: '예: OO산업진흥원' },
      { id: 'program_purpose', label: '사업 목적', type: 'textarea', placeholder: '이 사업의 목적과 기대효과를 적어주세요.' },
      { id: 'support_details', label: '지원 내용', type: 'textarea', placeholder: '지원 항목, 지원 방식 등' },
      { id: 'budget', label: '예산', placeholder: '예: 총 900,000,000원' },
      { id: 'program_period', label: '사업 기간', placeholder: '예: 2026. 3. 1. ~ 2026. 11. 30.' },
      { id: 'eligibility_rules', label: '신청 자격', type: 'textarea' },
      { id: 'evaluation_criteria', label: '평가 기준', type: 'textarea' },
      { id: 'submission_method', label: '신청 방법', type: 'textarea' },
      { id: 'required_documents', label: '제출서류', type: 'textarea', placeholder: '참여신청서\n사업계획서' },
      { id: 'legal_basis', label: '법적 근거' },
      { id: 'privacy_policy', label: '개인정보 처리방침', type: 'textarea' },
      { id: 'fair_competition_clause', label: '공정경쟁 문구', type: 'textarea' },
      { id: 'appeal_process', label: '이의신청 절차', type: 'textarea' },
      { id: 'contact', label: '문의처', placeholder: '예: AI전환팀 02-0000-0000' },
    ],
  },
  {
    id: 'event_program',
    label: '행사/프로그램 참여 공고',
    description: '행사 일정, 대상, 신청 방법, 혜택을 중심으로 작성합니다.',
    exportStyle: 'campus_notice',
    recommendedReferenceKeywords: ['프로그램 참여', '행사 모집', '신청 방법'],
    structureChips: ['infoTable', 'scheduleTable', 'noticeBox', 'contactBox'],
    directions: [
      { id: 'concise_notice', label: '간결 안내형', description: '일정과 신청 방법을 빠르게 읽히게 정리합니다.' },
      { id: 'iris_official', label: '공식 공고형', description: '기관 공고처럼 항목별 표를 사용합니다.' },
    ],
    fields: [
      { id: 'title', label: '프로그램명', required: true },
      { id: 'agency_name', label: '주최/주관' },
      { id: 'program_purpose', label: '목적', type: 'textarea' },
      { id: 'target_applicants', label: '참여 대상' },
      { id: 'program_period', label: '일정' },
      { id: 'support_details', label: '참여 혜택', type: 'textarea' },
      { id: 'submission_method', label: '신청 방법', type: 'textarea' },
      { id: 'contact', label: '문의처' },
    ],
  },
  {
    id: 'education_camp',
    label: '교육/캠프/장학 모집',
    description: '선발 대상, 혜택, 제출서류, 교육 일정을 중심으로 작성합니다.',
    exportStyle: 'campus_notice',
    recommendedReferenceKeywords: ['교육생 모집', '캠프 모집', '장학'],
    structureChips: ['infoTable', 'eligibilityTable', 'documentListTable', 'scheduleTable'],
    directions: [
      { id: 'campus_notice', label: '캠퍼스 공지형', description: '학생이 읽기 쉬운 공지문으로 구성합니다.' },
      { id: 'iris_official', label: '공식 선발형', description: '선발 절차와 제출서류를 표로 정리합니다.' },
    ],
    fields: [
      { id: 'title', label: '모집명', required: true },
      { id: 'agency_name', label: '운영 기관' },
      { id: 'target_applicants', label: '지원 대상' },
      { id: 'openings', label: '선발 인원' },
      { id: 'support_details', label: '혜택', type: 'textarea' },
      { id: 'program_period', label: '교육/활동 기간' },
      { id: 'evaluation_criteria', label: '선발 절차', type: 'textarea' },
      { id: 'required_documents', label: '제출서류', type: 'textarea' },
      { id: 'submission_method', label: '신청 방법', type: 'textarea' },
      { id: 'contact', label: '문의처' },
    ],
  },
  {
    id: 'custom',
    label: '직접 구성',
    description: '가까운 공고 유형을 고르고 필요한 항목만 남깁니다.',
    exportStyle: 'campus_notice',
    recommendedReferenceKeywords: ['공고', '모집', '신청'],
    structureChips: ['infoTable', 'noticeBox', 'contactBox'],
    directions: [
      { id: 'custom_guided', label: '맞춤 구성', description: '작성 목적에 맞춰 자유롭게 조정합니다.' },
      { id: 'iris_official', label: '공식 문서형', description: '표 중심의 공식 문서처럼 구성합니다.' },
    ],
    fields: [
      { id: 'title', label: '공고 제목', required: true },
      { id: 'program_purpose', label: '작성 목적', type: 'textarea' },
      { id: 'target_applicants', label: '대상' },
      { id: 'submission_method', label: '신청/접수 방법', type: 'textarea' },
      { id: 'contact', label: '문의처' },
      { id: 'notes', label: '추가 요청', type: 'textarea' },
    ],
  },
];

export function getNoticeRecipe(id: NoticeRecipeId | undefined): NoticeRecipe {
  return NOTICE_RECIPES.find((recipe) => recipe.id === id) ?? NOTICE_RECIPES[0];
}

export function getDefaultDirectionId(recipe: NoticeRecipe): string {
  return recipe.directions[0]?.id ?? 'iris_official';
}

export function makeDefaultAgencyNoticeBrief(recipeId: NoticeRecipeId = 'lab_recruitment'): AgencyNoticeBrief {
  const recipe = getNoticeRecipe(recipeId);
  return {
    recipe_id: recipe.id,
    direction_id: getDefaultDirectionId(recipe),
    organization_id: '00000000-0000-4000-8000-000000000001',
    author_id: 'demo-user',
    author_name: '사업 담당자',
    agency_name: '',
    title: '',
    program_type: recipe.id === 'rnd_support' ? 'support_program' : recipe.id,
    program_purpose: '',
    budget: '',
    program_period: '',
    eligibility_rules: '',
    support_details: '',
    evaluation_criteria: '',
    submission_method: '',
    required_documents: [],
    contact: '',
    legal_basis: '',
    privacy_policy: '',
    fair_competition_clause: '',
    appeal_process: '',
    lab_name: '',
    lab_intro: '',
    research_topics: '',
    target_applicants: '',
    openings: '',
    activities: '',
    required_qualifications: '',
    preferred_qualifications: '',
    activity_period: '',
    weekly_commitment: '',
    application_deadline: '',
    notes: '',
    references: [],
  };
}

export function applyRecipeDefaults(current: AgencyNoticeBrief, recipeId: NoticeRecipeId): AgencyNoticeBrief {
  const recipe = getNoticeRecipe(recipeId);
  return {
    ...current,
    recipe_id: recipe.id,
    direction_id: getDefaultDirectionId(recipe),
    program_type: recipe.id === 'rnd_support' ? 'support_program' : recipe.id,
  };
}

export function referenceKeywordFor(recipe: NoticeRecipe): string {
  return recipe.recommendedReferenceKeywords.slice(0, 2).join(' ');
}
