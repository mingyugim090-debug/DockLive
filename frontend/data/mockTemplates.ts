import type { MockTemplate } from './types';

export const mockTemplates: MockTemplate[] = [
  { id: 'tpl-meeting', name: '회의록 템플릿', description: '논의 안건, 결정 사항, 후속 작업을 깔끔하게 정리합니다.', recommendedFor: '회의 메모, 음성 기록 요약본', output: 'DOCX / Markdown' },
  { id: 'tpl-report', name: '보고서 템플릿', description: '배경, 분석, 결론, 제안 순서로 문서를 재구성합니다.', recommendedFor: '리서치 자료, 과제, 업무 보고', output: 'PDF / DOCX' },
  { id: 'tpl-plan', name: '기획서 템플릿', description: '문제 정의와 실행 계획을 중심으로 기획서 초안을 만듭니다.', recommendedFor: '제품 기획, 프로젝트 제안', output: 'DOCX / HWPX' },
  { id: 'tpl-assignment', name: '과제 정리 템플릿', description: '참고 자료를 주제별로 묶고 제출용 초안 흐름을 잡습니다.', recommendedFor: '대학 과제, 조사 보고서', output: 'Markdown / DOCX' },
  { id: 'tpl-official', name: '공문서 정리 템플릿', description: '공문 문체와 문단 구조에 맞춰 내용을 정돈합니다.', recommendedFor: '기관 제출 문서, 안내문', output: 'HWPX / PDF' },
  { id: 'tpl-slide', name: '발표자료 초안 템플릿', description: '문서 내용을 발표 흐름에 맞는 슬라이드 아웃라인으로 변환합니다.', recommendedFor: '발표 준비, 제안 발표', output: 'Markdown / PPT outline' },
];
