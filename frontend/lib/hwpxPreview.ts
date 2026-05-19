'use client';

export type HwpxPreviewBlock = {
  id: string;
  text: string;
};

export type HwpxPreview = {
  imageUrl: string | null;
  blocks: HwpxPreviewBlock[];
  warnings: string[];
};

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
};

const decoder = new TextDecoder('utf-8');

export async function readHwpxPreview(file: File): Promise<HwpxPreview> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const entries = readZipEntries(bytes);
  const warnings: string[] = [];

  const imageEntry = entries.find((entry) => /^Preview\/PrvImage\.(png|jpg|jpeg)$/i.test(entry.name));
  const imageUrl = imageEntry ? await entryToObjectUrl(bytes, imageEntry) : null;

  const textEntry = entries.find((entry) => entry.name === 'Preview/PrvText.txt');
  const sectionEntries = entries
    .filter((entry) => /^Contents\/section\d+\.xml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  let blocks: HwpxPreviewBlock[] = [];
  if (textEntry) {
    const text = decoder.decode(await inflateEntry(bytes, textEntry));
    blocks = splitPreviewText(text);
  }

  if (!blocks.length && sectionEntries.length) {
    const sectionTexts = await Promise.all(sectionEntries.map(async (entry) => decoder.decode(await inflateEntry(bytes, entry))));
    blocks = extractTextBlocksFromSections(sectionTexts.join('\n'));
  }

  if (!imageUrl) warnings.push('HWPX 원본 미리보기 이미지를 찾지 못해 원문 텍스트 레이어로 표시합니다.');
  if (!blocks.length) warnings.push('HWPX 원문 텍스트를 추출하지 못했습니다.');

  return { imageUrl, blocks, warnings };
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error('HWPX ZIP 구조를 읽을 수 없습니다.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let cursor = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    const dataOffset = localDataOffset(bytes, localHeaderOffset);
    entries.push({ name, compression, compressedSize, uncompressedSize, dataOffset });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
}

function localDataOffset(bytes: Uint8Array, localHeaderOffset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) throw new Error('HWPX ZIP local header를 읽을 수 없습니다.');
  const fileNameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  return localHeaderOffset + 30 + fileNameLength + extraLength;
}

async function entryToObjectUrl(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const data = await inflateEntry(bytes, entry);
  const type = entry.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return URL.createObjectURL(new Blob([toArrayBuffer(data)], { type }));
}

async function inflateEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const compressed = bytes.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8) throw new Error(`지원하지 않는 HWPX 압축 방식입니다: ${entry.compression}`);

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('현재 브라우저에서 HWPX 압축 해제를 지원하지 않습니다.');
  }

  const stream = new Blob([toArrayBuffer(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  const inflated = new Uint8Array(buffer);
  return entry.uncompressedSize && inflated.length !== entry.uncompressedSize ? inflated.slice(0) : inflated;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function splitPreviewText(text: string): HwpxPreviewBlock[] {
  return text
    .replace(/\r/g, '')
    .split(/\n{2,}|\n(?=\s*(?:\d+\.|[가-힣A-Za-z]+[:：]))/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 80)
    .map((line, index) => ({ id: `hwpx-${index}`, text: line }));
}

function extractTextBlocksFromSections(xml: string): HwpxPreviewBlock[] {
  const matches = Array.from(xml.matchAll(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g));
  const texts = matches
    .map((match) => htmlDecode(match[1].replace(/<[^>]+>/g, '')))
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const blocks: string[] = [];
  let current = '';
  for (const text of texts) {
    const next = current ? `${current} ${text}` : text;
    if (next.length > 120) {
      blocks.push(current || text);
      current = current ? text : '';
    } else {
      current = next;
    }
  }
  if (current) blocks.push(current);

  return blocks.slice(0, 80).map((text, index) => ({ id: `hwpx-${index}`, text }));
}

function htmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
