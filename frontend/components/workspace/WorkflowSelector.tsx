import { workflowTasks, type WorkflowTaskId } from '@/data/workspaceTasks';

export function WorkflowSelector({
  selectedTaskId,
  onSelect,
}: {
  selectedTaskId: WorkflowTaskId | null;
  onSelect: (taskId: WorkflowTaskId) => void;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div>
        <p className="text-sm font-bold text-[#5263E8]">Step 2</p>
        <h2 className="mt-1 text-2xl font-bold text-[#273044]">문서 작업 유형 선택</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">MVP에서는 하나의 작업 유형을 선택해 끝까지 생성 흐름을 테스트합니다.</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflowTasks.map((task) => {
          const selected = selectedTaskId === task.id;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelect(task.id)}
              className={[
                'min-h-[190px] rounded-[24px] border p-5 text-left transition hover:-translate-y-0.5',
                selected ? 'border-[#B8C0FF] bg-[#EEF2FF] shadow-primary' : 'border-[#ECECF1] bg-[#FBFBFD] hover:bg-white',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white font-bold text-[#5263E8]">{selected ? '✓' : '□'}</span>
                {selected ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#5263E8]">선택됨</span> : null}
              </div>
              <h3 className="mt-5 text-lg font-bold text-[#273044]">{task.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{task.description}</p>
              <p className="mt-4 rounded-[16px] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#5263E8]">
                예시: {task.exampleOutput}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
