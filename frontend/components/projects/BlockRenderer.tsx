'use client';

import { useMemo, type ReactNode } from 'react';
import type { VisualBlock, WorkspaceTableCell } from '@/lib/types';
import { ChartBlock } from './ChartBlock';

function MarkdownContent({ content }: { content: string }) {
  const nodes = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return [<p key="empty" className="text-xs italic opacity-60">내용이 비어 있습니다.</p>];
    const elements: ReactNode[] = [];
    let listItems: string[] = [];
    const flushList = () => {
      if (!listItems.length) return;
      const current = listItems;
      listItems = [];
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-5">
          {current.map((item, i) => (
            <li key={`${i}-${item.slice(0, 12)}`} className="list-disc leading-7">
              {item}
            </li>
          ))}
        </ul>,
      );
    };

    for (const rawLine of trimmed.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        flushList();
        continue;
      }
      const list = line.match(/^[-*]\s+(.+)$/);
      if (list) {
        listItems.push(list[1]);
        continue;
      }
      flushList();
      elements.push(
        <p key={`p-${elements.length}`} className="my-1.5 leading-7">
          {line}
        </p>,
      );
    }
    flushList();
    return elements;
  }, [content]);

  return <>{nodes}</>;
}

function TableContent({ rows }: { rows: WorkspaceTableCell[][] }) {
  if (!rows.length) return null;
  const [header, ...body] = rows;
  return (
    <table className="my-3 w-full border-collapse text-[0.95em]">
      <thead>
        <tr>
          {header.map((cell, i) => (
            <th key={`${i}-${cell.text}`} className="border border-[#DDE7E2] bg-[#EDF7F2] px-3 py-1.5 text-left font-bold text-[#245D50]">
              {cell.text}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, rowIndex) => (
          <tr key={`row-${rowIndex}`}>
            {row.map((cell, cellIndex) => (
              <td key={`${cellIndex}-${cell.text}`} className="border border-[#DDE7E2] px-3 py-1.5 align-top">
                {cell.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BlockRenderer({ block }: { block: VisualBlock }) {
  if (block.kind === 'heading') {
    return <h2 className="mt-4 border-b-2 border-[#245D50] pb-1 text-[1.15em] font-extrabold text-[#245D50]">{block.markdown}</h2>;
  }
  if (block.kind === 'paragraph') {
    return (
      <div className={block.status === 'needs_input' ? 'rounded-lg border border-dashed border-[#6A9C89] bg-[#F8FBFA] px-3 py-2 text-[#65736E]' : undefined}>
        <MarkdownContent content={block.markdown} />
      </div>
    );
  }
  if (block.kind === 'table') {
    return <TableContent rows={block.rows} />;
  }
  if (block.kind === 'chart' && block.chart) {
    return <ChartBlock chart={block.chart} />;
  }
  return null;
}
