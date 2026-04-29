'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  description?: string;
  fileFormat?: string;
  children: React.ReactNode;
}

export function Tooltip({ description, fileFormat, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  if (!description && !fileFormat) return <>{children}</>;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="flex items-center gap-1 focus:outline-none"
      >
        {children}
        <span
          className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
          style={{
            background: open ? 'rgba(124,111,247,0.3)' : 'rgba(255,255,255,0.08)',
            color: open ? '#B89EFF' : 'rgba(255,255,255,0.35)',
            border: `1px solid ${open ? 'rgba(124,111,247,0.4)' : 'rgba(255,255,255,0.12)'}`,
          }}
        >
          ?
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl p-3 shadow-xl"
            style={{
              background: '#1C1C2A',
              border: '1px solid rgba(124,111,247,0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {description && (
              <p className="text-xs text-text2 leading-relaxed">{description}</p>
            )}
            {fileFormat && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] text-text3">형식:</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                  style={{ background: 'rgba(124,111,247,0.15)', color: '#B89EFF' }}
                >
                  {fileFormat}
                </span>
              </div>
            )}
            {/* 화살표 */}
            <div
              className="absolute -top-1.5 left-4 w-3 h-3 rotate-45"
              style={{ background: '#1C1C2A', border: '1px solid rgba(124,111,247,0.25)', borderBottom: 'none', borderRight: 'none' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
