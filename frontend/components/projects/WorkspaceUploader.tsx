'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { ProjectFile } from '@/lib/types';

const KIND_LABELS: Record<ProjectFile['file_kind'], { label: string; className: string }> = {
  notice: { label: '공고', className: 'bg-[#245D50] text-white' },
  reference: { label: '참고', className: 'bg-[#EDF7F2] text-[#245D50]' },
  spreadsheet: { label: '데이터', className: 'bg-[#E7F1ED] text-[#3A7A68]' },
  image: { label: '이미지', className: 'bg-[#F8FBFA] text-[#65736E]' },
  unsupported: { label: '미지원', className: 'bg-amber-100 text-amber-800' },
};

export function WorkspaceUploader({
  files,
  busy,
  onUpload,
}: {
  files: ProjectFile[];
  busy: boolean;
  onUpload: (files: File[]) => void;
}) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length) onUpload(accepted);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: busy });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        data-testid="workspace-dropzone"
        className={[
          'cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center text-xs transition',
          isDragActive ? 'border-[#245D50] bg-[#EDF7F2]' : 'border-[#DDE7E2] bg-[#F8FBFA] hover:border-[#6A9C89]',
          busy ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <p className="font-bold text-[#24312D]">파일을 끌어다 놓거나 클릭해서 추가</p>
        <p className="mt-1 text-[#65736E]">공고문(PDF·HWPX·HWP) + 데이터(CSV) + 참고 문서</p>
      </div>

      {files.length ? (
        <ul className="space-y-2" data-testid="workspace-file-list">
          {files.map((file) => {
            const kind = KIND_LABELS[file.file_kind];
            return (
              <li key={file.id} className="rounded-xl border border-[#DDE7E2] bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kind.className}`}>{kind.label}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#24312D]">{file.filename}</span>
                </div>
                {file.warnings.length ? (
                  <p className="mt-1 text-[11px] leading-4 text-amber-700">{file.warnings[0]}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
