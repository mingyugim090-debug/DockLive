import { Button } from '@/components/ui/Button';
import type { GeneratedDocument, WorkflowTask } from '@/data/workspaceTasks';

export function DocumentPreview({
  result,
  task,
  onRegenerate,
  onReset,
  onDownload,
}: {
  result: GeneratedDocument;
  task: WorkflowTask | null;
  onRegenerate: () => void;
  onReset: () => void;
  onDownload: () => void;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#5263E8]">Step 6 · 결과 미리보기</p>
          <h2 className="mt-1 text-2xl font-bold text-[#273044]">{result.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
            {task ? `${task.name} 결과가 생성되었습니다. 미리보기를 확인한 뒤 Markdown 파일로 다운로드할 수 있습니다.` : '생성 결과가 준비되었습니다.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onRegenerate}>다시 생성하기</Button>
          <Button type="button" variant="secondary" onClick={onReset}>새 문서 업로드</Button>
          <Button type="button" onClick={onDownload}>다운로드</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          {result.previewBlocks.map((block) => (
            <div key={block.title} className="rounded-[22px] border border-[#ECECF1] bg-[#FBFBFD] p-5">
              <h3 className="font-bold text-[#273044]">{block.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{block.body}</p>
              {block.items?.length ? (
                <ul className="mt-3 space-y-1 text-sm leading-6 text-[#6B7280]">
                  {block.items.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-[#ECECF1] bg-[#FBFBFD] p-5">
          <div className="document-preview whitespace-pre-wrap rounded-[18px] bg-white p-5 text-sm leading-7 text-[#6B7280]">
            {result.markdown}
          </div>
        </div>
      </div>
    </section>
  );
}
