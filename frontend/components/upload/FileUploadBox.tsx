'use client';

import { useRef, useState } from 'react';

export function FileUploadBox({
  fileName,
  onFile,
}: {
  fileName: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFirstFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        setFirstFile(event.dataTransfer.files);
      }}
      className={[
        'flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[32px] border-2 border-dashed p-8 text-center transition',
        dragging ? 'border-[#6C7DFF] bg-[#EEF2FF]' : 'border-[#D8DDFC] bg-white hover:bg-[#FBFBFD]',
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf,.hwp,.hwpx" className="hidden" onChange={(event) => setFirstFile(event.target.files)} />
      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#EEF2FF] text-2xl text-[#5263E8]">□</div>
      <h2 className="mt-6 text-xl font-bold text-[#273044]">{fileName || '공고문을 여기에 끌어오거나 선택하세요'}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#7B8190]">
        PDF, HWP, HWPX 공고문을 업로드하면 요구사항 분석부터 신청서 초안 작성까지 이어집니다.
      </p>
      <span className="mt-6 rounded-full border border-[#ECECF1] bg-[#FAFAF7] px-4 py-2 text-sm font-semibold text-[#6B7280]">파일 선택</span>
    </div>
  );
}
