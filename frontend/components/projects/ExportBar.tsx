'use client';

const STUB_FORMATS = ['DOCX', 'HWPX', 'PDF'] as const;

export function ExportBar({
  busy,
  onExport,
}: {
  busy: boolean;
  onExport: (format: 'markdown' | 'html') => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="export-bar">
      <button
        type="button"
        data-testid="export-markdown"
        disabled={busy}
        onClick={() => onExport('markdown')}
        className="rounded-full bg-[#245D50] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
      >
        Markdown 다운로드
      </button>
      <button
        type="button"
        data-testid="export-html"
        disabled={busy}
        onClick={() => onExport('html')}
        className="rounded-full border border-[#245D50] px-4 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
      >
        HTML 다운로드
      </button>
      {STUB_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          disabled
          title="2차 지원 예정입니다."
          className="cursor-not-allowed rounded-full border border-[#DDE7E2] px-4 py-2 text-xs font-bold text-[#65736E] opacity-60"
        >
          {format} (2차 예정)
        </button>
      ))}
    </div>
  );
}
