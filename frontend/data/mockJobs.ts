import type { MockJob } from './types';

export const mockJobs: MockJob[] = [
  { id: 'job-001', name: '지원사업 공고 요약', documentName: '2026_지원사업_신청안내.pdf', type: '요약', status: '완료', duration: '1분 12초', createdAt: '2026.05.15 09:40' },
  { id: 'job-002', name: '회의록 형식 변환', documentName: '주간_회의록_초안.docx', type: '변환', status: '진행 중', duration: '42초', createdAt: '2026.05.15 09:28' },
  { id: 'job-003', name: '기획서 템플릿 적용', documentName: '제품기획서_v2.hwpx', type: '템플릿 적용', status: '완료', duration: '2분 04초', createdAt: '2026.05.14 17:10' },
  { id: 'job-004', name: '인터뷰 키워드 추출', documentName: '인터뷰_메모.txt', type: '키워드 추출', status: '대기', duration: '-', createdAt: '2026.05.14 14:36' },
  { id: 'job-005', name: '공문서 서식 정리', documentName: '공문_서식_정리본.hwpx', type: '서식 정리', status: '오류', duration: '18초', createdAt: '2026.05.13 11:20' },
  { id: 'job-006', name: '과제 제출 초안 작성', documentName: '과제_자료_모음.pdf', type: '자동 작성', status: '완료', duration: '2분 36초', createdAt: '2026.05.12 18:08' },
];
