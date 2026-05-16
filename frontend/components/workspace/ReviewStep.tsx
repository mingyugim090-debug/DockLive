import { Button } from '@/components/ui/Button';
import { formatFileSize, getFileExtension, type WorkflowTask } from '@/data/workspaceTasks';

export function ReviewStep({
  file,
  task,
  instructions,
  onBack,
  onStart,
}: {
  file: File | null;
  task: WorkflowTask | null;
  instructions: string;
  onBack: () => void;
  onStart: () => void;
}) {
  const rows = [
    ['업로드한 파일명', file?.name ?? '-'],
    ['파일 형식', file ? getFileExtension(file.name).toUpperCase() : '-'],
    ['파일 크기', file ? formatFileSize(file.size) : '-'],
    ['선택한 작업 유형', task?.name ?? '-'],
    ['추가 지시사항', instructions.trim() || '입력하지 않음'],
    ['예상 출력 형식', task?.expectedFormat ?? 'HWPX 문서'],
  ];

  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div>
        <p className="text-sm font-bold text-[#5263E8]">Step 4</p>
        <h2 className="mt-1 text-2xl font-bold text-[#273044]">실행 전 확인</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">선택한 정보를 확인한 뒤 문서 생성을 시작하세요.</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-[#ECECF1]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-2 border-b border-[#ECECF1] bg-white px-5 py-4 last:border-b-0 sm:grid-cols-[180px_1fr]">
            <p className="text-sm font-bold text-[#8A91A0]">{label}</p>
            <p className="text-sm leading-6 text-[#273044]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onBack}>이전 단계</Button>
        <Button type="button" onClick={onStart}>문서 생성 시작</Button>
      </div>
    </section>
  );
}
