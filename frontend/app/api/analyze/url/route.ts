import { NextRequest, NextResponse } from 'next/server';
import { extractNoticeInfo } from '@/lib/claudeAnalysis';

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DockLive/1.0; +https://dock-live.vercel.app)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`페이지를 가져오지 못했습니다 (${res.status})`);

  const html = await res.text();
  // Strip HTML tags and excessive whitespace to get readable text
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string };
    const { url } = body;

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'URL을 입력해 주세요.' }, { status: 400 });
    }

    let pageText: string;
    try {
      pageText = await fetchPageText(url);
    } catch (fetchErr) {
      return NextResponse.json(
        { success: false, error: `URL 접근 실패: ${fetchErr instanceof Error ? fetchErr.message : '알 수 없는 오류'}` },
        { status: 422 },
      );
    }

    if (pageText.length < 100) {
      return NextResponse.json({ success: false, error: '페이지에서 충분한 텍스트를 추출하지 못했습니다.' }, { status: 422 });
    }

    try {
      const data = await extractNoticeInfo(pageText, 'URL 공고문');
      return NextResponse.json({ success: true, data });
    } catch (claudeErr) {
      return NextResponse.json({
        success: true,
        data: {
          noticeName: 'URL 공고문',
          organization: '', applicationPeriod: '', deadline: '', eligibility: '',
          targetAudience: '', supportContent: '', requiredDocuments: [],
          evaluationCriteria: '', submissionMethod: '', notes: '',
          requiredWritingItems: ['신청 동기', '활동 계획', '기대 효과'],
          itemsNeedingConfirmation: [claudeErr instanceof Error ? claudeErr.message : 'AI 분석 실패. 아래 단계에서 직접 입력해 주세요.'],
        },
        warnings: ['AI 분석에 실패했습니다. 정보 보완 단계에서 직접 입력해 주세요.'],
      });
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '분석 실패' },
      { status: 500 },
    );
  }
}
