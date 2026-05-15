'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
  isLoading?: boolean;
}

export function DropZone({ onFileAccepted, isLoading = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
        onFileAccepted(acceptedFiles[0]);
      }
      setIsDragOver(false);
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.hancom.hwpx': ['.hwpx'],
      'application/x-hwp': ['.hwp'],
      'application/octet-stream': ['.hwp', '.hwpx'],
    },
    maxFiles: 1,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
        isDragOver ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-white/10 bg-white/3 hover:border-white/25 hover:bg-white/5'
      } ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <input {...getInputProps()} />
      <div className="relative flex flex-col items-center gap-4">
        <motion.div
          animate={isDragOver ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${
            isDragOver ? 'bg-primary/20' : 'bg-white/8'
          }`}
        >
          {selectedFile ? 'PDF' : '+'}
        </motion.div>

        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-base font-semibold text-text">{selectedFile.name}</p>
              <p className="text-sm text-text2">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              {!isLoading && <p className="mt-1 text-sm text-primary">클릭해서 다른 파일 선택</p>}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-base font-semibold text-text">
                {isDragOver ? 'PDF를 여기에 놓으세요' : 'PDF 공고문을 드래그하거나 클릭하세요'}
              </p>
              <p className="text-sm text-text2">최대 20MB · PDF 형식 지원</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
