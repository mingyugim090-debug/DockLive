'use client';

import type { WorkspaceExportFormat } from '@/lib/api';

const FORMATS: { format: WorkspaceExportFormat; label: string; primary?: boolean }[] = [
  { format: 'hwpx', label: 'HWPX', primary: true },
  { format: 'pdf', label: 'PDF' },
  { format: 'docx', label: 'DOCX' },
  { format: 'markdown', label: 'Markdown' },
  { format: 'html', label: 'HTML' },
];

export function ExportBar({
  busy,
  onExport,
}: {
  busy: boolean;
  onExport: (format: WorkspaceExportFormat) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="export-bar">
      {FORMATS.map(({ format, label, primary }) => (
        <button
          key={format}
          type="button"
          data-testid={`export-${format}`}
          disabled={busy}
          onClick={() => onExport(format)}
          className={
            primary
              ? 'rounded-full bg-[#245D50] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50'
              : 'rounded-full border border-[#245D50] px-4 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50'
          }
        >
          {label} 다운로드
        </button>
      ))}
    </div>
  );
}
