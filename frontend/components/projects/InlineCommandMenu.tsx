'use client';

import type { InlineTransformCommand, VisualBlock } from '@/lib/types';

const COMMANDS: { command: InlineTransformCommand; label: string; allowed: (block: VisualBlock) => boolean }[] = [
  { command: 'to_table', label: '표로 변환', allowed: (block) => block.kind === 'paragraph' },
  { command: 'to_chart', label: '그래프로 변환', allowed: (block) => block.kind === 'table' },
  { command: 'rewrite', label: '다듬기', allowed: (block) => block.kind === 'paragraph' },
];

export function InlineCommandMenu({
  block,
  busy,
  onCommand,
}: {
  block: VisualBlock;
  busy: boolean;
  onCommand: (command: InlineTransformCommand) => void;
}) {
  const available = COMMANDS.filter((item) => item.allowed(block));
  if (!available.length) return null;

  return (
    <div
      data-testid="inline-command-menu"
      className="absolute -top-3 right-2 z-10 flex items-center gap-1 rounded-full border border-[#DDE7E2] bg-white px-1.5 py-1 shadow-md"
    >
      {available.map((item) => (
        <button
          key={item.command}
          type="button"
          data-testid={`command-${item.command}`}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onCommand(item.command);
          }}
          className="rounded-full px-2.5 py-1 text-[11px] font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
        >
          {busy ? '변환 중…' : item.label}
        </button>
      ))}
    </div>
  );
}
