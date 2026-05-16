import type { GeneratedDocument, WorkflowTask } from '@/data/workspaceTasks';

function formatDateForFile(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function buildMarkdownResult({
  result,
  task,
  sourceFileName,
  instructions,
  createdAt = new Date(),
}: {
  result: GeneratedDocument;
  task: WorkflowTask | null;
  sourceFileName: string;
  instructions: string;
  createdAt?: Date;
}): string {
  return [
    `# ${result.title}`,
    '',
    '---',
    `원본 파일명: ${sourceFileName}`,
    `작업 유형: ${task?.name ?? '문서 자동화'}`,
    `생성 시간: ${formatDateTime(createdAt)}`,
    `사용자 추가 지시사항: ${instructions.trim() || '없음'}`,
    '---',
    '',
    result.markdown,
  ].join('\n');
}

export function downloadMarkdownResult({
  result,
  task,
  sourceFileName,
  instructions,
}: {
  result: GeneratedDocument;
  task: WorkflowTask | null;
  sourceFileName: string;
  instructions: string;
}): void {
  const createdAt = new Date();
  const content = buildMarkdownResult({ result, task, sourceFileName, instructions, createdAt });
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const taskSlug = task?.id ?? 'result';
  link.href = url;
  link.download = `docklive-${taskSlug}-${formatDateForFile(createdAt)}.md`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
