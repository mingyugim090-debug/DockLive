import { NextRequest, NextResponse } from 'next/server';
import { generateNoticeDraft } from '@/lib/claudeAnalysis';
import type { NoticeDocument } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let templateId = '';
    let inputs: Record<string, string> = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const payloadJson = formData.get('payload_json') as string | null;
      if (payloadJson) {
        const payload = JSON.parse(payloadJson) as { template_id?: string; inputs?: Record<string, string> };
        templateId = payload.template_id ?? '';
        inputs = payload.inputs ?? {};
      }
    } else {
      const body = await request.json() as { template_id?: string; inputs?: Record<string, string> };
      templateId = body.template_id ?? '';
      inputs = body.inputs ?? {};
    }

    const baseDraft: Partial<NoticeDocument> = {
      documentType: templateId,
      title: inputs.title || '',
      organization: inputs.organization || '',
      purpose: '',
      applicationMethod: inputs.applicationMethod || '',
      schedule: {
        applicationPeriod: inputs.applicationPeriod || '',
        eventPeriod: inputs.eventPeriod || '',
      },
      contact: {
        department: inputs.department || '',
        phone: inputs.phone || '',
        email: inputs.email || '',
      },
      attachments: inputs.attachments ? inputs.attachments.split('\n').filter(Boolean) : [],
    };

    const generated = await generateNoticeDraft(inputs, baseDraft);

    const document: NoticeDocument = {
      documentType: templateId,
      title: inputs.title || '제목 없음',
      organization: inputs.organization || '',
      purpose: generated.purpose,
      applicationMethod: generated.applicationMethod,
      sections: generated.sections,
      schedule: {
        applicationPeriod: inputs.applicationPeriod || '',
        eventPeriod: inputs.eventPeriod || '',
      },
      contact: {
        department: inputs.department || '',
        phone: inputs.phone || '',
        email: inputs.email || '',
      },
      attachments: inputs.attachments ? inputs.attachments.split('\n').filter(Boolean) : [],
    };

    return NextResponse.json({
      success: true,
      data: document,
      preview_markdown: '',
      warnings: ['AI가 생성한 초안입니다. 제출 전 내용을 반드시 검토하고 수정하세요.'],
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '초안 생성 실패' },
      { status: 500 },
    );
  }
}
