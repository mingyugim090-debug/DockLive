'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatFileSize, getFileExtension } from '@/data/workspaceTasks';

export function FileUpload({
  file,
  error,
  onFile,
  onRemove,
}: {
  file: File | null;
  error: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const next = files?.[0];
    if (next) onFile(next);
  };

  return (
    <section className="rounded-[30px] border border-[var(--theme-border)] bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-[#5263E8]">Step 1</p>
        <h2 className="text-2xl font-bold text-[#273044]">문서 업로드</h2>
        <p className="text-sm leading-6 text-[#6B7280]">PDF, DOCX, HWP, HWPX, TXT, MD 파일을 올리고 문서 자동화 작업을 시작하세요.</p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={[
          'mt-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-6 text-center transition',
          dragging ? 'border-[#6C7DFF] bg-[#EEF2FF]' : 'border-[#D8DDFC] bg-[#FBFBFD] hover:bg-[#F6F8FB]',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.hwp,.hwpx,.txt,.md"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-2xl text-[#5263E8] shadow-sm">↑</div>
        <p className="mt-5 text-lg font-bold text-[#273044]">{file ? file.name : '문서를 끌어오거나 클릭해서 선택하세요'}</p>
        <p className="mt-2 text-sm text-[#7B8190]">지원 형식: .pdf, .docx, .hwp, .hwpx, .txt, .md</p>
        <span className="mt-5 rounded-full border border-[#ECECF1] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280]">파일 선택</span>
      </div>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {file ? (
        <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-[#ECECF1] bg-[#FBFBFD] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-[#273044]">{file.name}</p>
            <p className="mt-1 text-sm text-[#7B8190]">
              {getFileExtension(file.name).toUpperCase()} · {formatFileSize(file.size)}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onRemove}>파일 제거</Button>
        </div>
      ) : null}
    </section>
  );
}
