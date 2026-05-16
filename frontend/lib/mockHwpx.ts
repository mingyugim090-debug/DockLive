import type { GeneratedDocument, WorkflowTask } from '@/data/workspaceTasks';

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();

function encode(text: string): Uint8Array {
  return encoder.encode(text);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s+/, '• ')
    .replace(/^\d+\.\s+/, '')
    .replace(/^>\s*/, '')
    .trim();
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    const byte = data[index];
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const stamp = dosDateTime();

  for (const entry of entries) {
    const name = encode(entry.name);
    const crc = crc32(entry.data);

    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, stamp.time);
    writeU16(localView, 12, stamp.date);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, entry.data.length);
    writeU32(localView, 22, entry.data.length);
    writeU16(localView, 26, name.length);
    writeU16(localView, 28, 0);
    localHeader.set(name, 30);

    localParts.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, stamp.time);
    writeU16(centralView, 14, stamp.date);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, entry.data.length);
    writeU32(centralView, 24, entry.data.length);
    writeU16(centralView, 28, name.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, localOffset);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + entry.data.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralDirectory.length);
  writeU32(endView, 16, localOffset);
  writeU16(endView, 20, 0);

  return concat([...localParts, centralDirectory, end]);
}

function buildSectionXml(result: GeneratedDocument, task: WorkflowTask | null, sourceFileName: string, instructions: string): string {
  const lines = [
    result.title,
    '',
    `작업 유형: ${task?.name ?? '문서 자동화'}`,
    `원본 파일: ${sourceFileName}`,
    instructions.trim() ? `추가 지시사항: ${instructions.trim()}` : '추가 지시사항: 없음',
    '',
    ...result.markdown.split('\n').map(stripMarkdown).filter(Boolean),
  ];

  const paragraphs = lines.map((line, index) => {
    const text = line || ' ';
    return [
      `  <hp:p id="${index + 1}" paraPrIDRef="0" styleIDRef="0">`,
      '    <hp:run charPrIDRef="0">',
      `      <hp:t>${escapeXml(text)}</hp:t>`,
      '    </hp:run>',
      '  </hp:p>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<hs:sec',
    '  xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"',
    '  xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">',
    ...paragraphs,
    '</hs:sec>',
  ].join('\n');
}

function buildHeaderXml(title: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<hh:head',
    '  xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"',
    '  xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"',
    '  xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">',
    '  <hh:docInfo>',
    `    <hh:docTitle>${escapeXml(title)}</hh:docTitle>`,
    '  </hh:docInfo>',
    '  <hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="0"/>',
    '  <hh:charPr id="0" height="1000" textColor="000000"/>',
    '</hh:head>',
  ].join('\n');
}

function buildManifestXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">',
    '  <manifest:file-entry manifest:media-type="application/hwp+zip" manifest:full-path="/"/>',
    '  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="version.xml"/>',
    '  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/content.hpf"/>',
    '  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/header.xml"/>',
    '  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="Contents/section0.xml"/>',
    '</manifest:manifest>',
  ].join('\n');
}

function buildContentHpf(title: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="1.0" unique-identifier="docklive-document">',
    '  <opf:metadata>',
    `    <opf:title>${escapeXml(title)}</opf:title>`,
    '    <opf:creator>DockLive MVP</opf:creator>',
    '  </opf:metadata>',
    '  <opf:manifest>',
    '    <opf:item id="header" href="header.xml" media-type="text/xml"/>',
    '    <opf:item id="section0" href="section0.xml" media-type="text/xml"/>',
    '  </opf:manifest>',
    '  <opf:spine>',
    '    <opf:itemref idref="section0"/>',
    '  </opf:spine>',
    '</opf:package>',
  ].join('\n');
}

export function createMockHwpxBlob({
  result,
  task,
  sourceFileName,
  instructions,
}: {
  result: GeneratedDocument;
  task: WorkflowTask | null;
  sourceFileName: string;
  instructions: string;
}): Blob {
  const entries: ZipEntry[] = [
    { name: 'mimetype', data: encode('application/hwp+zip') },
    { name: 'version.xml', data: encode('<?xml version="1.0" encoding="UTF-8"?><version app="DockLive" hwpx="1.0"/>') },
    { name: 'META-INF/manifest.xml', data: encode(buildManifestXml()) },
    { name: 'Contents/content.hpf', data: encode(buildContentHpf(result.title)) },
    { name: 'Contents/header.xml', data: encode(buildHeaderXml(result.title)) },
    { name: 'Contents/section0.xml', data: encode(buildSectionXml(result, task, sourceFileName, instructions)) },
  ];

  const zipBytes = createZip(entries);
  const arrayBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'application/vnd.hancom.hwpx' });
}
