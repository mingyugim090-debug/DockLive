import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { GeneratedDocument, WorkflowTask } from '@/data/workspaceTasks';

export function DocumentPreview({
  result,
  task,
  onRegenerate,
  onReset,
  onDownloadHwpx,
  onDownloadPdf,
  onDownloadMarkdown,
  downloadError,
  documentHref,
}: {
  result: GeneratedDocument;
  task: WorkflowTask | null;
  onRegenerate: () => void;
  onReset: () => void;
  onDownloadHwpx: () => void;
  onDownloadPdf: () => void;
  onDownloadMarkdown: () => void;
  downloadError?: string | null;
  documentHref: string;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#5263E8]">Step 6 · Result Preview</p>
          <h2 className="mt-1 text-2xl font-bold text-[#273044]">{result.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
            {task ? `${task.name} result is ready. Review it, then download a verified HWPX or PDF export.` : 'The generated result is ready.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onRegenerate}>Regenerate</Button>
          <Button type="button" variant="secondary" onClick={onReset}>New document</Button>
          <Link href={documentHref} className="inline-flex items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--theme-text)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--theme-surface-muted)]">
            Open workflow
          </Link>
          <Button type="button" variant="secondary" onClick={onDownloadMarkdown}>Markdown</Button>
          <Button type="button" onClick={onDownloadHwpx}>HWPX</Button>
          <Button type="button" variant="secondary" onClick={onDownloadPdf}>PDF</Button>
        </div>
      </div>

      {downloadError ? (
        <div className="mt-5 rounded-[18px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          {downloadError}
        </div>
      ) : null}

      {result.hwpxCompose ? (
        <div className="mt-5 grid gap-3 rounded-[22px] border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 lg:grid-cols-3">
          <div>
            <p className="font-bold">Template</p>
            <p className="mt-1">{result.hwpxCompose.template_id}</p>
          </div>
          <div>
            <p className="font-bold">HWPX validation</p>
            <p className="mt-1">
              {result.hwpxCompose.verification?.validation_passed ? 'Passed' : 'Needs review'}
              {result.hwpxCompose.verification?.structure_status ? ` · ${result.hwpxCompose.verification.structure_status}` : ''}
            </p>
          </div>
          <div>
            <p className="font-bold">Confirmation</p>
            <p className="mt-1">{result.hwpxCompose.confirmation_required?.length || 0} items</p>
          </div>
        </div>
      ) : null}

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

      {result.hwpxCompose?.generated_fields ? (
        <div className="mt-5 rounded-[24px] border border-[#ECECF1] bg-[#FBFBFD] p-5">
          <h3 className="font-bold text-[#273044]">Generated fields</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.entries(result.hwpxCompose.generated_fields)
              .filter(([key, value]) => value && !key.startsWith('_'))
              .slice(0, 10)
              .map(([key, value]) => (
                <div key={key} className="rounded-[18px] border border-[#ECECF1] bg-white p-4">
                  <p className="text-xs font-bold uppercase text-[#5263E8]">{key}</p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#6B7280]">{value}</p>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
