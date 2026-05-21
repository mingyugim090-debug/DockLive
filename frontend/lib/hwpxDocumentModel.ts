import type {
  HwpxBlock,
  HwpxCheckboxGroupBlock,
  HwpxDocumentModel,
  HwpxPage,
  HwpxTemplateAnalysisResponse,
  HwpxTemplateBlock,
} from './types';

export const FORBIDDEN_DOCUMENT_TEXT = [
  'LiveDock 자동작성 내용',
  'LiveDock: 자동작성 내용',
  'DockLive: 자동작성 내용',
  '자동작성 초안',
  '요약',
  '추가 입력 필요',
  '문서 제목:',
  'JSON 문자열',
  "{'",
  "'학과'",
  "'개인정보 수집",
  'documentType',
  'sections',
  'contact',
  'metadata',
];

export function sanitizeDocumentText(value: string) {
  let next = value || '';
  for (const term of FORBIDDEN_DOCUMENT_TEXT) {
    next = next.replaceAll(term, '');
  }
  next = next.replace(/\{\s*["'](?:documentType|sections|contact|metadata)["'][\s\S]*$/g, '');
  next = next.replace(/```(?:json)?[\s\S]*?```/gi, '');
  return next.replace(/\n{3,}/g, '\n\n').trim();
}

export function sanitizeHwpxDocumentModel(model: HwpxDocumentModel): HwpxDocumentModel {
  return {
    ...model,
    title: sanitizeDocumentText(model.title) || model.title,
    pages: model.pages
      .map((page) => ({
        ...page,
        blocks: page.blocks.map(sanitizeBlock).filter(Boolean) as HwpxBlock[],
      }))
      .filter((page) => page.blocks.length),
    metadata: {
      ...model.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

function sanitizeBlock(block: HwpxBlock): HwpxBlock | null {
  if (block.type === 'paragraph') {
    const text = sanitizeDocumentText(block.text);
    return text ? { ...block, text } : null;
  }
  if (block.type === 'heading') {
    const text = sanitizeDocumentText(block.text);
    return text ? { ...block, text } : null;
  }
  if (block.type === 'checkboxGroup') {
    const label = block.label ? sanitizeDocumentText(block.label) : undefined;
    const options = block.options
      .map((option) => ({ ...option, label: sanitizeDocumentText(option.label) }))
      .filter((option) => option.label);
    return options.length ? { ...block, label, options } : null;
  }
  if (block.type === 'signature') {
    return {
      ...block,
      dateText: sanitizeDocumentText(block.dateText),
      signerLabel: sanitizeDocumentText(block.signerLabel),
      organizationText: block.organizationText ? sanitizeDocumentText(block.organizationText) : undefined,
    };
  }
  if (block.type === 'table') {
    const rows = block.rows
      .map((row) => ({
        cells: row.cells
          .map((cell) => ({ ...cell, text: sanitizeDocumentText(cell.text) }))
          .filter((cell) => cell.text || cell.editable),
      }))
      .filter((row) => row.cells.length);
    return rows.length ? { ...block, rows } : null;
  }
  return block;
}

export function analysisToHwpxDocumentModel(analysis: HwpxTemplateAnalysisResponse, sourceFileName: string): HwpxDocumentModel {
  const pages: HwpxPage[] = [{ id: 'uploaded-page-1', blocks: [] }];
  let pageIndex = 0;

  analysis.blocks.forEach((block, blockIndex) => {
    const converted = convertTemplateBlock(block, blockIndex);
    if (!converted) return;
    const text = 'text' in converted ? converted.text : '';
    if (converted.type === 'heading' && /개인정보\s*수집|개인정보\s*활용|동의서/.test(text) && pages[pageIndex].blocks.length > 0) {
      pageIndex += 1;
      pages.push({ id: `uploaded-page-${pageIndex + 1}`, blocks: [] });
    }
    pages[pageIndex].blocks.push(converted);
  });

  if (!pages.some((page) => page.blocks.length)) {
    pages[0].blocks.push({
      id: 'uploaded-empty',
      type: 'paragraph',
      text: '업로드한 HWPX에서 표시 가능한 본문을 찾지 못했습니다.',
      editable: true,
    });
  }

  return sanitizeHwpxDocumentModel({
    id: `uploaded-${Date.now()}`,
    title: sanitizeDocumentText(analysis.title) || sourceFileName.replace(/\.(hwp|hwpx)$/i, ''),
    sourceFileName,
    pages: pages.filter((page) => page.blocks.length),
    metadata: {
      documentType: 'uploaded-hwpx',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
}

function convertTemplateBlock(block: HwpxTemplateBlock, index: number): HwpxBlock | null {
  if (containsForbidden(block.text)) return null;
  if (block.type === 'table') {
    return {
      id: block.id || `uploaded-table-${index}`,
      type: 'table',
      style: { borderCollapse: true, width: '100%' },
      rows: block.rows.map((row, rowIndex) => ({
        cells: row.map((cell, cellIndex) => ({
          id: cell.id ?? `${block.id}-r${rowIndex}-c${cellIndex}`,
          text: sanitizeDocumentText(cell.text),
          rowSpan: cell.row_span,
          colSpan: cell.col_span,
          width: cell.width,
          align: cell.align ?? (rowIndex === 0 || cellIndex === 0 ? 'center' : 'left'),
          verticalAlign: cell.vertical_align === 'bottom' ? 'bottom' : cell.vertical_align === 'top' ? 'top' : 'middle',
          background: cell.background ?? (rowIndex === 0 || cellIndex === 0 ? '#f1f5f2' : undefined),
          editable: cell.editable ?? cellIndex > 0,
        })),
      })),
    };
  }

  const text = sanitizeDocumentText(block.text);
  if (!text) return null;
  const checkbox = checkboxFromText(block.id, text);
  if (checkbox) return checkbox;
  if (block.type === 'heading' || block.role === 'heading' || block.role === 'title') {
    return {
      id: block.id || `uploaded-heading-${index}`,
      type: 'heading',
      text,
      level: block.role === 'title' ? 1 : 2,
      style: {
        align: block.style?.align ?? (block.role === 'title' ? 'center' : 'left'),
        bold: block.style?.bold ?? true,
        fontSize: block.style?.fontSize ?? (block.role === 'title' ? 22 : 15),
      },
      editable: true,
    };
  }
  return {
    id: block.id || `uploaded-paragraph-${index}`,
    type: 'paragraph',
    text,
    style: block.style,
    editable: true,
  };
}

function checkboxFromText(id: string, text: string): HwpxCheckboxGroupBlock | null {
  if (!/[□☐☑■]/.test(text)) return null;
  const parts = text.split(/(?=[□☐☑■])/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  return {
    id: id || `checkbox-${Date.now()}`,
    type: 'checkboxGroup',
    label: '체크 항목',
    editable: true,
    options: parts.map((part, index) => ({
      id: `${id}-option-${index}`,
      checked: /^[☑■]/.test(part),
      label: sanitizeDocumentText(part.replace(/^[□☐☑■]\s*/, '')),
    })),
  };
}

function containsForbidden(value: string) {
  return FORBIDDEN_DOCUMENT_TEXT.some((term) => value.includes(term)) || /\{\s*["'](?:documentType|sections|contact|metadata)["']/.test(value);
}

export function findFirstEditableId(model: HwpxDocumentModel): string {
  for (const page of model.pages) {
    for (const block of page.blocks) {
      if (block.type === 'table') {
        const cell = block.rows.flatMap((row) => row.cells).find((item) => item.editable);
        if (cell) return cell.id;
      }
      if ('editable' in block && block.editable) return block.id;
    }
  }
  return model.pages[0]?.blocks[0]?.id ?? '';
}
