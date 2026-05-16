export type WorkflowTaskId = 'summary' | 'minutes' | 'report' | 'format' | 'custom';

export interface WorkflowTask {
  id: WorkflowTaskId;
  name: string;
  description: string;
  exampleOutput: string;
  expectedFormat: string;
  instructionHint: string;
}

export interface GeneratedDocument {
  title: string;
  markdown: string;
  previewBlocks: Array<{
    title: string;
    body: string;
    items?: string[];
  }>;
}

export const workflowTasks: WorkflowTask[] = [
  {
    id: 'summary',
    name: '문서 요약',
    description: '긴 문서에서 핵심 내용, 주요 근거, 결론을 빠르게 정리합니다.',
    exampleOutput: '1페이지 요약본, 핵심 bullet point, 결론',
    expectedFormat: 'Markdown 요약 문서',
    instructionHint: '요약 분량, 강조할 항목, 표 포함 여부를 자유롭게 적어주세요.',
  },
  {
    id: 'minutes',
    name: '회의록 정리',
    description: '회의 메모나 녹취 정리본을 안건, 결정사항, TODO 중심으로 정리합니다.',
    exampleOutput: '참석자, 안건, 결정사항, 담당자별 TODO',
    expectedFormat: 'Markdown 회의록',
    instructionHint: '참석자, 회의 목적, TODO 정리 방식이 있으면 적어주세요.',
  },
  {
    id: 'report',
    name: '보고서 초안 생성',
    description: '자료 문서를 보고서 구조로 재구성하고 초안 흐름을 잡습니다.',
    exampleOutput: '제목, 개요, 본문 구조, 결론과 제안',
    expectedFormat: 'Markdown 보고서 초안',
    instructionHint: '보고 대상, 원하는 톤, 분량, 포함할 결론 방향을 적어주세요.',
  },
  {
    id: 'format',
    name: '문서 형식 정리',
    description: '흩어진 문서 내용을 읽기 좋은 제목, 문단, 표 구조로 정돈합니다.',
    exampleOutput: '정리 전/후 구조, 표준 문단 구성, 누락 항목',
    expectedFormat: 'Markdown 정리본',
    instructionHint: '기관 제출용, 학업용, 업무용 등 맞추고 싶은 형식을 적어주세요.',
  },
  {
    id: 'custom',
    name: '맞춤형 지시사항 입력',
    description: '사용자가 작성한 지시사항을 중심으로 원하는 결과물을 생성합니다.',
    exampleOutput: '사용자 지시를 반영한 맞춤 문서',
    expectedFormat: 'Markdown 맞춤 결과물',
    instructionHint: '예: 핵심 내용 중심으로 1페이지 요약해줘. 표 형태로 정리하고, 마지막에 결론을 추가해줘.',
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
  return ['.pdf', '.docx', '.hwp', '.hwpx'].includes(getFileExtension(file.name));
}

export function getTaskById(id: WorkflowTaskId): WorkflowTask {
  return workflowTasks.find((task) => task.id === id) ?? workflowTasks[0];
}

export function createMockGeneratedDocument(taskId: WorkflowTaskId, file: File, instructions: string): GeneratedDocument {
  const task = getTaskById(taskId);
  const instructionText = instructions.trim() || '추가 지시사항 없음';
  const baseTitle = file.name.replace(/\.[^.]+$/, '');

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
        '- 다운로드 파일은 MVP 기준 Markdown 형식으로 제공',
        '',
        '## TODO',
        '- 담당자별 후속 작업과 마감일 입력 필요',
        `- 사용자 지시사항 반영: ${instructionText}`,
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
      ].join('\n'),
      previewBlocks: [
        { title: '제목', body: `${baseTitle} 보고서 초안` },
        { title: '개요', body: '문서 내용을 보고서 흐름에 맞게 재구성했습니다.' },
        { title: '본문 구조', body: '배경, 분석, 제안, 기대 효과 순서로 구성했습니다.', items: ['문제 배경', '주요 발견', '실행 제안', '결론'] },
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
