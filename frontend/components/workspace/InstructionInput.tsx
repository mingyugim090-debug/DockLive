import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import type { WorkflowTask } from '@/data/workspaceTasks';

const MAX_LENGTH = 600;

export function InstructionInput({
  task,
  value,
  onChange,
  onBack,
  onNext,
}: {
  task: WorkflowTask | null;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div>
        <p className="text-sm font-bold text-[#5263E8]">Step 3</p>
        <h2 className="mt-1 text-2xl font-bold text-[#273044]">추가 지시사항 입력</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
          입력하지 않아도 진행할 수 있습니다. 선택한 작업 유형에 맞춰 기본 결과가 생성됩니다.
        </p>
      </div>

      <div className="mt-6 rounded-[22px] border border-[#ECECF1] bg-[#FBFBFD] p-4">
        <p className="text-sm font-bold text-[#273044]">{task ? `${task.name} 안내` : '작업 안내'}</p>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
          {task?.instructionHint ?? '원하는 결과물 스타일을 자유롭게 입력하세요.'}
        </p>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-[#6B7280]">결과물 스타일</span>
        <Textarea
          className="mt-2 min-h-[160px] resize-y"
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="예: 핵심 내용 중심으로 1페이지 요약해줘. 표 형태로 정리하고, 마지막에 결론을 추가해줘."
        />
      </label>
      <div className="mt-2 flex justify-end text-xs font-semibold text-[#8A91A0]">{value.length}/{MAX_LENGTH}</div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onBack}>이전 단계</Button>
        <Button type="button" onClick={onNext}>실행 전 확인</Button>
      </div>
    </section>
  );
}
