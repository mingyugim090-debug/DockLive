'use client';

import type { GeneratedDocument, InlineTransformCommand } from '@/lib/types';
import { BlockRenderer } from './BlockRenderer';
import { InlineCommandMenu } from './InlineCommandMenu';

export function DocumentCanvas({
  document,
  selectedBlockId,
  transformBusy,
  onSelectBlock,
  onCommand,
}: {
  document: GeneratedDocument;
  selectedBlockId: string | null;
  transformBusy: boolean;
  onSelectBlock: (blockId: string | null) => void;
  onCommand: (blockId: string, command: InlineTransformCommand) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F0F4F2] px-4 py-6" onClick={() => onSelectBlock(null)}>
      <article
        data-testid="document-canvas"
        className="mx-auto min-h-[1120px] max-w-[760px] rounded-sm border border-[#DDE7E2] bg-white px-12 py-14 text-[14px] text-[#24312D] shadow-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <h1 className="mb-6 text-center text-xl font-extrabold text-[#24312D]">{document.title}</h1>
        {document.blocks.map((block) => {
          const selected = block.id === selectedBlockId;
          return (
            <div
              key={block.id}
              data-testid={`canvas-block-${block.id}`}
              className={[
                'relative -mx-3 cursor-pointer rounded-lg px-3 py-0.5 transition',
                selected ? 'ring-2 ring-[#6A9C89] ring-offset-1' : 'hover:bg-[#F8FBFA]',
              ].join(' ')}
              onClick={(event) => {
                event.stopPropagation();
                onSelectBlock(block.id);
              }}
            >
              {selected ? (
                <InlineCommandMenu block={block} busy={transformBusy} onCommand={(command) => onCommand(block.id, command)} />
              ) : null}
              <BlockRenderer block={block} />
            </div>
          );
        })}
        {document.warnings.length ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {document.warnings.map((warning) => (
              <p key={warning}>· {warning}</p>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
}
