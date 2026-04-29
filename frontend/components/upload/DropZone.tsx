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
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative overflow-hidden
        border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
        transition-all duration-300
        ${
          isDragOver
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-white/10 hover:border-white/25 bg-white/3 hover:bg-white/5'
        }
        ${isLoading ? 'cursor-not-allowed opacity-60' : ''}
      `}
    >
      <input {...getInputProps()} />

      {/* 배경 글로우 */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/5 rounded-2xl" />
      )}

      <div className="relative flex flex-col items-center gap-4">
        {/* 아이콘 */}
        <motion.div
          animate={isDragOver ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center text-3xl
            ${isDragOver ? 'bg-primary/20' : 'bg-white/8'}
          `}
        >
          {selectedFile ? '📄' : '📂'}
        </motion.div>

        {/* 텍스트 */}
        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-text font-semibold text-base">{selectedFile.name}</p>
              <p className="text-text2 text-sm">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {!isLoading && (
                <p className="text-primary text-sm mt-1">클릭하여 다른 파일 선택</p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-text font-semibold text-base">
                {isDragOver ? 'PDF를 놓으세요!' : 'PDF 파일을 드래그하거나 클릭하세요'}
              </p>
              <p className="text-text2 text-sm">최대 20MB · PDF 형식만 지원</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
