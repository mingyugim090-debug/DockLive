import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { extractNoticeInfo } from '@/lib/claudeAnalysis';
import type { NoticeAnalysisResult } from '@/lib/types';

// ---------------------------------------------------------------------------
// HWPX (ZIP-based) text extraction
// ---------------------------------------------------------------------------

async function extractHwpxText(buffer: ArrayBuffer): Promise<{ text: string; title: string; warnings: string[] }> {
  const warnings: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('ZIP 파싱 실패 — 구 .hwp 형식이거나 손상된 파일입니다.');
  }

  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /Contents\/section\d+\.xml$/i.test(name))
    .sort();

  if (sectionFiles.length === 0) {
    warnings.push('HWPX 섹션 파일을 찾지 못했습니다.');
    return { text: '', title: '', warnings };
  }

  const allTexts: string[] = [];
  for (const sectionFile of sectionFiles.slice(0, 8)) {
    try {
      const xml = await zip.files[sectionFile].async('text');
      const matches = xml.match(/<hp:t[^>]*>([^<]*)<\/hp:t>/g) ?? [];
      const sectionText = matches
        .map((m) => m.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ');
      if (sectionText) allTexts.push(sectionText);
    } catch {
      // skip
    }
  }

  let title = '';
  try {
    const headerXml = await zip.files['Contents/header.xml']?.async('text');
    if (headerXml) {
      const m = headerXml.match(/<hp:title[^>]*>([^<]+)<\/hp:title>/);
      title = m?.[1]?.trim() ?? '';
    }
  } catch {
    // ignore
  }

  const text = allTexts.join('\n\n');
  if (!text) warnings.push('HWPX 파일에서 텍스트를 추출하지 못했습니다.');

  return { text, title, warnings };
}

// ---------------------------------------------------------------------------
// Old .hwp binary text extraction (UTF-16LE scan)
// ---------------------------------------------------------------------------

function extractHwpBinaryText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const runs: string[] = [];
  let i = 0;

  while (i < bytes.length - 1) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    // Korean syllable block (0xAC00–0xD7A3) or common CJK
    if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318F)) {
      let run = '';
      while (i < bytes.length - 1) {
        const c = bytes[i] | (bytes[i + 1] << 8);
        if (
          (c >= 0xAC00 && c <= 0xD7A3) || // Hangul syllables
          (c >= 0x3131 && c <= 0x318F) || // Hangul jamo
          (c >= 0x0020 && c <= 0x007E) || // ASCII printable
          c === 0x0020
        ) {
          run += String.fromCharCode(c);
          i += 2;
        } else {
          break;
        }
      }
      if (run.trim().length >= 2) runs.push(run.trim());
    } else {
      i += 2;
    }
    if (runs.length > 400) break;
  }

  return runs.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 8000);
}

// ---------------------------------------------------------------------------
// Basic regex-based analysis (fallback when Claude is unavailable)
// ---------------------------------------------------------------------------

function parseTextToBasicAnalysis(text: string, fallbackName: string): NoticeAnalysisResult {
  const find = (...patterns: string[]) => {
    for (const p of patterns) {
      const m = text.match(new RegExp(`${p}[\\s:：]+([^\n]{2,100})`, 'i'));
      if (m) return m[1].trim();
    }
    return '';
  };

  const dateRange = text.match(/(\d{4}[\.\-]\s*\d{1,2}[\.\-]\s*\d{1,2}[.\s]?[~～–-]\s*\d{4}[\.\-]\s*\d{1,2}[\.\-]\s*\d{1,2})/);

  return {
    noticeName: find('공고명', '사업명', '과제명') || fallbackName,
    organization: find('주관기관', '공고기관', '운영기관', '기관명', '소속'),
    applicationPeriod: dateRange?.[1] || find('접수기간', '신청기간', '공고기간'),
    deadline: find('마감일', '제출기한', '접수마감'),
    eligibility: find('신청자격', '지원자격', '참여자격', '신청 자격'),
    targetAudience: find('모집대상', '신청대상', '참여대상', '모집 대상'),
    supportContent: find('지원내용', '지원 내용', '혜택', '제공내용'),
    requiredDocuments: [],
    evaluationCriteria: find('선정기준', '평가기준', '선정 기준'),
    submissionMethod: find('접수방법', '신청방법', '제출방법', '접수 방법'),
    notes: find('유의사항', '주의사항'),
    requiredWritingItems: [],
    itemsNeedingConfirmation: ['자동 분석이므로 누락 항목이 있을 수 있습니다. 정보 보완 단계에서 확인해 주세요.'],
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let baseName = '업로드한 문서';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '파일을 업로드해 주세요.' }, { status: 400 });
    }
    if (!/\.(hwp|hwpx)$/i.test(file.name)) {
      return NextResponse.json({ success: false, error: 'HWPX 또는 HWP 파일만 지원합니다.' }, { status: 400 });
    }

    baseName = file.name.replace(/\.(hwp|hwpx)$/i, '').replace(/[_+]+/g, ' ').trim() || baseName;

    const arrayBuffer = await file.arrayBuffer();
    let extractedText = '';
    let extractedTitle = '';
    const warnings: string[] = [];

    // Step 1: try HWPX (ZIP) parsing
    try {
      const res = await extractHwpxText(arrayBuffer);
      extractedText = res.text;
      extractedTitle = res.title;
      warnings.push(...res.warnings);
    } catch {
      // Step 2: try old HWP binary scan
      extractedText = extractHwpBinaryText(arrayBuffer);
      if (!extractedText) {
        warnings.push('HWP/HWPX 파일에서 텍스트를 추출하지 못했습니다.');
      }
    }

    const noticeText = extractedTitle
      ? `공고명: ${extractedTitle}\n\n${extractedText}`
      : extractedText;

    // Step 3: if we have text, try Claude; else return basic analysis
    if (noticeText.trim()) {
      try {
        const data = await extractNoticeInfo(noticeText, extractedTitle || baseName);
        return NextResponse.json({ success: true, data, warnings });
      } catch {
        // Step 4: Claude failed — fall back to regex-based analysis
        const data = parseTextToBasicAnalysis(noticeText, extractedTitle || baseName);
        warnings.push('AI 분석에 실패해 텍스트 기반 기본 분석 결과를 반환합니다.');
        return NextResponse.json({ success: true, data, warnings });
      }
    }

    // Step 5: no text at all — return filename-only fallback
    const fallback: NoticeAnalysisResult = {
      noticeName: extractedTitle || baseName,
      organization: '',
      applicationPeriod: '',
      deadline: '',
      eligibility: '',
      targetAudience: '',
      supportContent: '',
      requiredDocuments: [],
      evaluationCriteria: '',
      submissionMethod: '',
      notes: '',
      requiredWritingItems: [],
      itemsNeedingConfirmation: ['파일에서 텍스트를 추출하지 못했습니다. 정보 보완 단계에서 직접 입력해 주세요.'],
    };
    return NextResponse.json({ success: true, data: fallback, warnings });

  } catch (err) {
    // Last resort — still return success with minimal data to keep the flow going
    const fallback: NoticeAnalysisResult = {
      noticeName: baseName,
      organization: '',
      applicationPeriod: '',
      deadline: '',
      eligibility: '',
      targetAudience: '',
      supportContent: '',
      requiredDocuments: [],
      evaluationCriteria: '',
      submissionMethod: '',
      notes: '',
      requiredWritingItems: [],
      itemsNeedingConfirmation: [err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다. 정보 보완 단계에서 직접 입력해 주세요.'],
    };
    return NextResponse.json({ success: true, data: fallback, warnings: [] });
  }
}
