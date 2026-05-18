import type { MockJob } from './types';

export const mockJobs: MockJob[] = [
  { id: 'job-001', name: '창업캠프 모집 공고문 작성', documentName: '2026_청년창업캠프_모집공고.hwpx', type: '자동 작성', status: '완료', duration: '1분 12초', createdAt: '2026.05.15 09:40' },
  { id: 'job-002', name: '지원사업 참여기업 모집 공고문 작성', documentName: '지역특화_지원사업_참여기업_모집공고.pdf', type: '자동 작성', status: '진행 중', duration: '42초', createdAt: '2026.05.15 09:28' },
  { id: 'job-003', name: '교육 프로그램 수강생 모집 공고문 작성', documentName: '평생교육_수강생_모집공고.docx', type: '자동 작성', status: '완료', duration: '2분 04초', createdAt: '2026.05.14 17:10' },
  { id: 'job-004', name: '행사 참가자 모집 공고문 템플릿 적용', documentName: '도시혁신포럼_참가자_모집공고.hwpx', type: '템플릿 적용', status: '완료', duration: '1분 05초', createdAt: '2026.05.14 14:36' },
];
