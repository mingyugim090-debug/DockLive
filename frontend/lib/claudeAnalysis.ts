import type { NoticeAnalysisResult, NoticeDocument } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANALYSIS_MODEL = 'anthropic/claude-3-5-haiku';
const GENERATION_MODEL = 'anthropic/claude-3-5-sonnet';

const EXTRACTION_PROMPT = `다음 한국 공고문을 분석하여 핵심 정보를 JSON으로 추출하세요.
정보가 없으면 빈 문자열 또는 빈 배열을 사용하세요.
추측하지 말고, 명시된 정보만 추출하세요.
반드시 아래 JSON 형식으로만 응답하세요 (설명 없이 JSON만):

{
  "noticeName": "공고명",
  "organization": "공고 기관명",
  "applicationPeriod": "신청·접수 기간 (예: 2026. 6. 1. ~ 6. 20.)",
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

function openrouterHeaders(key: string) {
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://dock-live.vercel.app',
    'X-Title': 'DockLive',
  };
}

function emptyAnalysis(noticeName: string): NoticeAnalysisResult {
  return {
    noticeName,
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
    itemsNeedingConfirmation: [],
  };
}

export async function extractNoticeInfo(
  noticeText: string,
  fallbackName = '공고문',
): Promise<NoticeAnalysisResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI 분석 키가 설정되지 않았습니다.');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: openrouterHeaders(key),
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: 'user', content: `${EXTRACTION_PROMPT}\n\n---\n${noticeText.slice(0, 12000)}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI 분석 실패 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있습니다.');

  try {
    const parsed = JSON.parse(content) as Partial<NoticeAnalysisResult>;
    const base = emptyAnalysis(parsed.noticeName || fallbackName);
    return {
      ...base,
      ...parsed,
      requiredDocuments: Array.isArray(parsed.requiredDocuments) ? parsed.requiredDocuments : [],
      requiredWritingItems: Array.isArray(parsed.requiredWritingItems) ? parsed.requiredWritingItems : [],
      itemsNeedingConfirmation: Array.isArray(parsed.itemsNeedingConfirmation) ? parsed.itemsNeedingConfirmation : [],
    };
  } catch {
    throw new Error('AI 응답 파싱에 실패했습니다.');
  }
}

// ---------------------------------------------------------------------------
// Draft generation
// ---------------------------------------------------------------------------

const DRAFT_SYSTEM = `당신은 한국 공모전·지원사업 신청서 작성 전문가입니다.
아래 공고 정보와 신청자 정보를 바탕으로 실제 제출 가능한 신청서 각 섹션의 본문을 작성하세요.

규칙:
- 각 섹션은 완결된 문장으로 구성하세요.
- 신청자 정보가 없는 항목은 [확인 필요]로 표시하세요.
- 과장하거나 사실과 다른 내용을 만들지 마세요.
- 반드시 아래 JSON 형식으로만 응답하세요.`;

const DRAFT_PROMPT_TEMPLATE = (inputs: Record<string, string>) => `
공고 및 신청자 정보:
${Object.entries(inputs)
  .filter(([, v]) => v?.trim())
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

다음 JSON 형식으로 신청서 초안을 작성하세요:
{
  "purpose": "공고 목적 한 줄 요약",
  "applicationMethod": "접수 방법",
  "sections": [
    {"heading": "1. 신청 개요", "body": "내용"},
    {"heading": "2. 신청 동기 및 필요성", "body": "내용"},
    {"heading": "3. 세부 추진 계획", "body": "내용"},
    {"heading": "4. 기대 효과", "body": "내용"}
  ]
}`;

export async function generateNoticeDraft(
  inputs: Record<string, string>,
  baseDraft: Partial<NoticeDocument>,
): Promise<Pick<NoticeDocument, 'purpose' | 'applicationMethod' | 'sections'>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI 생성 키가 설정되지 않았습니다.');

  const enrichedInputs = {
    title: baseDraft.title || inputs.title || '',
    organization: baseDraft.organization || inputs.organization || '',
    ...inputs,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: openrouterHeaders(key),
    body: JSON.stringify({
      model: GENERATION_MODEL,
      messages: [
        { role: 'system', content: DRAFT_SYSTEM },
        { role: 'user', content: DRAFT_PROMPT_TEMPLATE(enrichedInputs) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI 초안 생성 실패 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있습니다.');

  const parsed = JSON.parse(content) as {
    purpose?: string;
    applicationMethod?: string;
    sections?: { heading: string; body: string }[];
  };

  return {
    purpose: parsed.purpose || baseDraft.purpose || '',
    applicationMethod: parsed.applicationMethod || baseDraft.applicationMethod || '',
    sections: Array.isArray(parsed.sections) && parsed.sections.length > 0
      ? parsed.sections
      : (baseDraft.sections ?? []),
  };
}
