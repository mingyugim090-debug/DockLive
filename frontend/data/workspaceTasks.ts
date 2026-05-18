import type { HwpxComposeResponse } from '@/lib/types';

export type WorkflowTaskId = 'summary' | 'minutes' | 'report' | 'plan' | 'format' | 'official' | 'custom';
export type OutputFormat = 'HWPX' | 'Markdown' | 'DOCX' | 'PDF';
export type ProcessingMode = '간결한 공고문' | '상세한 공고문' | '행정 공고문';

export interface WorkflowTask {
  id: WorkflowTaskId;
  name: string;
  description: string;
  exampleOutput: string;
  expectedFormat: string;
  instructionHint: string;
  recommendedInput: string;
}

export interface GeneratedDocument {
  title: string;
  markdown: string;
  workflowId?: string;
  previewBlocks: Array<{
    title: string;
    body: string;
    items?: string[];
  }>;
  hwpxCompose?: HwpxComposeResponse;
}

export const workflowTasks: WorkflowTask[] = [
  {
    id: 'summary',
    name: '문서 요약',
    description: '긴 문서에서 핵심 내용, 주요 근거, 결론을 빠르게 정리합니다.',
    exampleOutput: '1페이지 요약본, 핵심 bullet point, 결론',
    expectedFormat: 'HWPX 요약 문서',
    instructionHint: '요약 분량, 강조할 항목, 표 포함 여부를 자유롭게 적어주세요.',
    recommendedInput: '공고문, 보고서, 긴 PDF, 리서치 자료',
  },
  {
    id: 'minutes',
    name: '회의록 정리',
    description: '회의 메모나 녹취 정리본을 안건, 결정사항, TODO 중심으로 정리합니다.',
    exampleOutput: '참석자, 안건, 결정사항, 담당자별 TODO',
    expectedFormat: 'HWPX 회의록',
    instructionHint: '참석자, 회의 목적, TODO 정리 방식이 있으면 적어주세요.',
    recommendedInput: '회의 메모, 녹취 요약본, 인터뷰 기록',
  },
  {
    id: 'report',
    name: '보고서 초안 생성',
    description: '자료 문서를 보고서 구조로 재구성하고 초안 흐름을 잡습니다.',
    exampleOutput: '제목, 개요, 본문 구조, 결론과 제안',
    expectedFormat: 'HWPX 보고서 초안',
    instructionHint: '보고 대상, 원하는 톤, 분량, 포함할 결론 방향을 적어주세요.',
    recommendedInput: '조사 자료, 과제 자료, 업무 보고 메모',
  },
  {
    id: 'plan',
    name: '기획서 초안 생성',
    description: '아이디어와 자료를 문제 정의, 목표, 실행 계획 중심의 기획서로 바꿉니다.',
    exampleOutput: '문제 정의, 목표, 핵심 기능, 실행 계획, 기대 효과',
    expectedFormat: 'HWPX 기획서 초안',
    instructionHint: '대상 사용자, 핵심 문제, 반드시 포함할 기능이나 일정이 있으면 적어주세요.',
    recommendedInput: '기획 메모, 프로젝트 제안 자료, 제품 아이디어',
  },
  {
    id: 'format',
    name: '문서 형식 정리',
    description: '흩어진 문서 내용을 읽기 좋은 제목, 문단, 표 구조로 정돈합니다.',
    exampleOutput: '정리 전/후 구조, 표준 문단 구성, 누락 항목',
    expectedFormat: 'HWPX 정리본',
    instructionHint: '기관 제출용, 학업용, 업무용 등 맞추고 싶은 형식을 적어주세요.',
    recommendedInput: '형식이 흐트러진 DOCX/HWPX/PDF 문서',
  },
  {
    id: 'official',
    name: '공문서 정리',
    description: '요청 배경, 주요 내용, 첨부 항목을 공문서 흐름으로 정리합니다.',
    exampleOutput: '제목, 수신, 발신, 요청 배경, 주요 내용, 첨부 목록',
    expectedFormat: 'HWPX 공문서 초안',
    instructionHint: '수신 기관, 요청 목적, 포함해야 할 첨부 항목을 입력하세요.',
    recommendedInput: '공문 초안, 기관 제출 문서, 안내문',
  },
  {
    id: 'custom',
    name: '맞춤형 지시사항 입력',
    description: '사용자가 작성한 지시사항을 중심으로 원하는 결과물을 생성합니다.',
    exampleOutput: '사용자 지시를 반영한 맞춤 문서',
    expectedFormat: 'HWPX 맞춤 결과물',
    instructionHint: '예: 핵심 내용 중심으로 1페이지 요약해줘. 표 형태로 정리하고, 마지막에 결론을 추가해줘.',
    recommendedInput: '사용자 지시가 중요한 모든 문서',
  },
];

export const processingSteps = [
  '문서 업로드 확인 중',
  '문서 내용 분석 중',
  '작업 유형에 맞게 문서 생성 중',
  '결과 파일 구성 중',
  '완료',
];

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

export function isSupportedDocument(file: File): boolean {
  return ['.pdf', '.docx', '.hwp', '.hwpx', '.txt', '.md'].includes(getFileExtension(file.name));
}

export function getTaskById(id: WorkflowTaskId): WorkflowTask {
  return workflowTasks.find((task) => task.id === id) ?? workflowTasks[0];
}

export function taskToJobType(taskId: WorkflowTaskId): '요약' | '변환' | '템플릿 적용' | '키워드 추출' | '서식 정리' | '자동 작성' {
  if (taskId === 'summary') return '요약';
  if (taskId === 'format' || taskId === 'official') return '서식 정리';
  if (taskId === 'custom') return '자동 작성';
  if (taskId === 'minutes') return '변환';
  return '자동 작성';
}

export function createMockGeneratedDocument(
  taskId: WorkflowTaskId,
  file: File,
  instructions: string,
  options: { processingMode?: ProcessingMode; templateName?: string | null } = {},
): GeneratedDocument {
  const task = getTaskById(taskId);
  const instructionText = instructions.trim() || '추가 지시사항 없음';
  const baseTitle = file.name.replace(/\.[^.]+$/, '');
  const modeNote = options.processingMode ? `처리 옵션: ${options.processingMode}` : '처리 옵션: 기본';
  const templateNote = options.templateName ? `적용 템플릿: ${options.templateName}` : '적용 템플릿: 없음';

  if (taskId === 'minutes') {
    return {
      title: `${baseTitle} 회의록 정리본`,
      markdown: [
        `# ${baseTitle} 회의록 정리본`,
        '',
        '## 참석자',
        '- 참석자 정보는 원문 또는 사용자 입력에서 확인 필요',
        '',
        '## 주요 안건',
        '- 문서 자동화 MVP 진행 범위 확인',
        '- 업로드, 작업 선택, 결과 다운로드 흐름 정리',
        '- 후속 구현 우선순위 결정',
        '',
        '## 결정사항',
        '- 사용자는 한 화면에서 문서 생성 흐름을 끝까지 테스트할 수 있어야 함',
        '- 다운로드 파일은 MVP 기준 HWPX 형식으로 제공',
        '',
        '## TODO',
        '- 담당자별 후속 작업과 마감일 입력 필요',
        `- 사용자 지시사항 반영: ${instructionText}`,
        `- ${modeNote}`,
      ].join('\n'),
      previewBlocks: [
        { title: '참석자', body: '참석자 정보는 원문 또는 사용자 입력에서 확인이 필요합니다.' },
        { title: '안건', body: '문서 자동화 MVP 흐름과 후속 구현 범위를 정리했습니다.', items: ['업로드', '작업 선택', '결과 다운로드'] },
        { title: 'TODO', body: '담당자와 마감일은 추가 확인 후 완성할 수 있습니다.' },
      ],
    };
  }

  if (taskId === 'report') {
    return {
      title: `${baseTitle} 보고서 초안`,
      markdown: [
        `# ${baseTitle} 보고서 초안`,
        '',
        '## 개요',
        '본 문서는 업로드된 자료를 바탕으로 핵심 배경, 분석 내용, 결론을 보고서 형식으로 재구성한 초안입니다.',
        '',
        '## 본문 구조',
        '1. 문제 배경과 현재 상황',
        '2. 주요 발견 사항',
        '3. 실행 가능한 제안',
        '4. 기대 효과와 보완 필요 사항',
        '',
        '## 결론',
        '현재 자료만으로는 일부 세부 근거 확인이 필요하지만, 제출용 보고서 초안의 기본 구조는 완성되었습니다.',
        '',
        `> 사용자 지시사항: ${instructionText}`,
        `> ${templateNote}`,
      ].join('\n'),
      previewBlocks: [
        { title: '제목', body: `${baseTitle} 보고서 초안` },
        { title: '개요', body: '문서 내용을 보고서 흐름에 맞게 재구성했습니다.' },
        { title: '본문 구조', body: '배경, 분석, 제안, 기대 효과 순서로 구성했습니다.', items: ['문제 배경', '주요 발견', '실행 제안', '결론'] },
      ],
    };
  }

  if (taskId === 'plan') {
    return {
      title: `${baseTitle} 기획서 초안`,
      markdown: [
        `# ${baseTitle} 기획서 초안`,
        '',
        '## 문제 정의',
        '현재 사용자는 문서 업로드 후 실제 결과 생성까지 이어지는 명확한 흐름을 필요로 합니다.',
        '',
        '## 목표',
        '업로드, 작업 선택, 지시사항 입력, 결과 다운로드까지 한 번에 체험 가능한 MVP를 제공합니다.',
        '',
        '## 핵심 기능',
        '- 파일 업로드와 확장자 검증',
        '- 작업 유형별 결과 생성',
        '- HWPX 및 Markdown 다운로드',
        '- 문서 목록과 작업 이력 저장',
        '',
        '## 실행 계획',
        '1. 프론트엔드 mock workflow 완성',
        '2. 백엔드 문서 파싱 API 연결',
        '3. 검증된 HWPX export로 교체',
        '',
        '## 기대 효과',
        '사용자는 실제 제품처럼 문서 자동화 흐름을 검증할 수 있습니다.',
        '',
        `> 사용자 지시사항: ${instructionText}`,
        `> ${modeNote}`,
      ].join('\n'),
      previewBlocks: [
        { title: '문제 정의', body: '사용자가 끝까지 테스트할 수 있는 문서 자동화 흐름이 필요합니다.' },
        { title: '핵심 기능', body: '업로드부터 다운로드까지 MVP 기능을 연결했습니다.', items: ['업로드', '작업 선택', '결과 생성', '다운로드'] },
        { title: '실행 계획', body: '프론트 mock 이후 실제 API와 HWPX export로 확장합니다.' },
      ],
    };
  }

  if (taskId === 'format') {
    return {
      title: `${baseTitle} 형식 정리본`,
      markdown: [
        `# ${baseTitle} 형식 정리본`,
        '',
        '## 정리 전 구조',
        '- 제목과 본문 구분이 약함',
        '- 핵심 항목이 긴 문단에 섞여 있음',
        '- 제출 전 확인 항목이 별도로 분리되지 않음',
        '',
        '## 정리 후 구조',
        '- 문서 제목',
        '- 핵심 요약',
        '- 세부 항목',
        '- 제출 전 체크리스트',
        '',
        '## 보완 필요',
        '- 표와 첨부 파일이 있는 경우 원본 서식 확인 필요',
        `- 사용자 지시사항: ${instructionText}`,
      ].join('\n'),
      previewBlocks: [
        { title: '정리 전', body: '긴 문단과 항목이 섞여 있어 빠르게 검토하기 어렵습니다.' },
        { title: '정리 후', body: '제목, 요약, 세부 항목, 체크리스트로 구분했습니다.' },
        { title: '보완 필요', body: '표/이미지/첨부가 있는 경우 원본 서식 검증이 필요합니다.' },
      ],
    };
  }

  if (taskId === 'official') {
    return {
      title: `${baseTitle} 공문서 정리본`,
      markdown: [
        `# ${baseTitle} 공문서 정리본`,
        '',
        '## 제목',
        '문서 자동화 MVP 기능 검토 및 테스트 요청',
        '',
        '## 수신',
        '관련 부서 또는 검토 담당자',
        '',
        '## 발신',
        'DockLive 문서 자동화 팀',
        '',
        '## 요청 배경',
        '현재 UI 중심 화면을 실제 테스트 가능한 MVP workflow로 개선하기 위해 기능 검토가 필요합니다.',
        '',
        '## 주요 내용',
        '- 문서 업로드 및 작업 유형 선택 기능',
        '- mock 문서 생성 및 결과 미리보기',
        '- HWPX/Markdown 다운로드',
        '- Documents 및 History 반영',
        '',
        '## 첨부 목록',
        '- 생성 결과 미리보기',
        '- 작업 이력',
        '',
        `> 사용자 지시사항: ${instructionText}`,
      ].join('\n'),
      previewBlocks: [
        { title: '제목', body: '문서 자동화 MVP 기능 검토 및 테스트 요청' },
        { title: '주요 내용', body: '업로드부터 다운로드까지 필요한 기능을 공문서 흐름으로 정리했습니다.' },
        { title: '첨부 목록', body: '생성 결과와 작업 이력을 첨부 항목으로 분리했습니다.' },
      ],
    };
  }

  if (taskId === 'custom') {
    return {
      title: `${baseTitle} 맞춤 생성 결과`,
      markdown: [
        `# ${baseTitle} 맞춤 생성 결과`,
        '',
        '## 요청 반영',
        instructions.trim()
          ? `사용자 지시사항 "${instructions.trim()}"을 중심으로 문서를 재구성했습니다.`
          : '구체적인 지시사항이 없어 기본 문서 자동화 결과로 생성했습니다.',
        '',
        '## 생성 내용',
        '- 핵심 내용을 먼저 요약',
        '- 세부 항목을 읽기 쉬운 bullet point로 정리',
        '- 마지막에 결론과 확인 필요 항목 추가',
        '',
        '## 결론',
        '사용자 의도에 맞춰 바로 수정 가능한 초안 형태로 결과를 구성했습니다.',
      ].join('\n'),
      previewBlocks: [
        { title: '요청 반영', body: instructions.trim() || '기본 문서 자동화 방식으로 생성했습니다.' },
        { title: '생성 내용', body: '핵심 요약, 세부 항목, 결론 순서로 정리했습니다.' },
      ],
    };
  }

  return {
    title: `${baseTitle} 요약본`,
    markdown: [
      `# ${baseTitle} 요약본`,
      '',
      '## 요약',
      '업로드한 문서의 핵심 내용을 1페이지 분량으로 압축했습니다. 중요한 일정, 요구사항, 결정이 필요한 항목을 먼저 확인할 수 있도록 구성했습니다.',
      '',
      '## 핵심 포인트',
      '- 문서의 목적과 주요 내용을 빠르게 파악할 수 있도록 정리',
      '- 제출 또는 공유 전에 확인해야 할 항목 분리',
      '- 후속 작업에 필요한 질문과 보완 사항 도출',
      '',
      '## 결론',
      '현재 문서는 바로 검토 가능한 요약본 형태로 정리되었으며, 필요한 경우 보고서나 공식 문서 형식으로 확장할 수 있습니다.',
      '',
      `> 사용자 지시사항: ${instructionText}`,
    ].join('\n'),
    previewBlocks: [
      { title: '요약', body: '핵심 내용을 1페이지 분량으로 압축했습니다.' },
      { title: '핵심 포인트', body: '검토자가 먼저 봐야 할 항목을 bullet point로 정리했습니다.', items: ['목적', '요구사항', '확인 필요 항목'] },
      { title: '결론', body: '후속 작업으로 보고서화 또는 서식 정리를 이어갈 수 있습니다.' },
    ],
  };
}
