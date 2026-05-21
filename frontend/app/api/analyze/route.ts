import { NextRequest, NextResponse } from 'next/server';
import { extractNoticeInfo } from '@/lib/claudeAnalysis';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANALYSIS_MODEL = 'anthropic/claude-3-5-sonnet'; // sonnet required for PDF vision

const PDF_EXTRACTION_PROMPT = `이 PDF 문서는 한국 공고문입니다. 핵심 정보를 분석하여 JSON으로 추출하세요.
정보가 없으면 빈 문자열 또는 빈 배열을 사용하세요.
반드시 아래 JSON 형식으로만 응답하세요 (설명 없이 JSON만):

{
  "noticeName": "공고명",
  "organization": "공고 기관명",
  "applicationPeriod": "신청·접수 기간",
  "deadline": "최종 마감일",
  "eligibility": "신청 자격 요건",
  "targetAudience": "모집 대상",
  "supportContent": "지원 내용 또는 혜택",
  "requiredDocuments": ["제출 서류 항목1", "항목2"],
  "evaluationCriteria": "선정·평가 기준",
  "submissionMethod": "접수 방법",
  "notes": "유의사항",
  "requiredWritingItems": ["직접 작성이 필요한 항목1", "항목2"],
  "itemsNeedingConfirmation": ["확인이 필요한 불확실한 정보1", "정보2"]
}`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'PDF 파일을 업로드해 주세요.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ success: false, error: 'PDF 파일만 지원합니다.' }, { status: 400 });
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('AI 분석 키가 설정되지 않았습니다.');

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Try Claude's PDF document vision
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://livedock.insforge.site',
        'X-Title': 'DockLive',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: PDF_EXTRACTION_PROMPT,
              },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${base64}` },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      // Fallback: treat the PDF file name as minimal input for Claude text analysis
      const fallback = await extractNoticeInfo(
        `파일명: ${file.name}\nPDF 분석 실패. 파일명 기반으로 기본 정보만 추출합니다.`,
        file.name.replace(/\.pdf$/i, ''),
      );
      return NextResponse.json({ success: true, data: fallback, warnings: ['PDF 비전 분석에 실패해 파일명 기반 기본 정보를 반환합니다.'] });
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 응답이 비어 있습니다.');

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const data = {
      noticeName: (parsed.noticeName as string) || file.name.replace(/\.pdf$/i, ''),
      organization: (parsed.organization as string) || '',
      applicationPeriod: (parsed.applicationPeriod as string) || '',
      deadline: (parsed.deadline as string) || '',
      eligibility: (parsed.eligibility as string) || '',
      targetAudience: (parsed.targetAudience as string) || '',
      supportContent: (parsed.supportContent as string) || '',
      requiredDocuments: Array.isArray(parsed.requiredDocuments) ? (parsed.requiredDocuments as string[]) : [],
      evaluationCriteria: (parsed.evaluationCriteria as string) || '',
      submissionMethod: (parsed.submissionMethod as string) || '',
      notes: (parsed.notes as string) || '',
      requiredWritingItems: Array.isArray(parsed.requiredWritingItems) ? (parsed.requiredWritingItems as string[]) : [],
      itemsNeedingConfirmation: Array.isArray(parsed.itemsNeedingConfirmation) ? (parsed.itemsNeedingConfirmation as string[]) : [],
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '분석 실패' },
      { status: 500 },
    );
  }
}
