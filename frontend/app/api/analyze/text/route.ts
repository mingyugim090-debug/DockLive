import { NextRequest, NextResponse } from 'next/server';
import { extractNoticeInfo } from '@/lib/claudeAnalysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string; title?: string };
    const { text, title } = body;

    if (!text?.trim()) {
      return NextResponse.json({ success: false, error: '공고문 텍스트를 입력해 주세요.' }, { status: 400 });
    }

    try {
      const data = await extractNoticeInfo(text, title || '입력한 공고문');
      return NextResponse.json({ success: true, data });
    } catch (claudeErr) {
      // Claude failed — return partial result so the flow can continue
      return NextResponse.json({
        success: true,
        data: {
          noticeName: title || '입력한 공고문',
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
