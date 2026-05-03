import json
import logging
import re
import time
from datetime import date

from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError

from core.config import settings
from core.errors import AnalysisError
from models.schemas import CompanyProfile

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 60_000

SYSTEM_PROMPT = """당신은 한국의 공모전, 정부지원사업, 장학금, 연구과제, 창업지원 공고를 분석하는 전문 AI입니다.
반드시 유효한 JSON 객체만 반환하세요. 마크다운 코드블록이나 설명 문장은 포함하지 마세요.
문서에 없는 핵심 사실은 추측하지 말고 uncertain_fields에 기록하세요.
분석 결과에는 가능한 경우 source_evidence를 포함해 각 핵심 필드가 원문 어디에 근거하는지 짧은 인용으로 남기세요."""

ANALYSIS_PROMPT = """다음 공고문을 분석해 JSON으로만 응답하세요.

오늘 날짜: {today}
출처: {source_name}

응답 JSON 형식:
{{
  "doc_type": "competition | research | scholarship | startup",
  "title": "공고문 제목",
  "organization": "주관/운영 기관명",
  "summary": "핵심 내용을 2~3문장으로 요약",
  "timeline": [
    {{"label": "일정 이름", "date": "YYYY-MM-DD", "is_deadline": true}}
  ],
  "checklist": [
    {{
      "label": "제출 서류명",
      "category": "required | optional",
      "description": "분량, 양식, 첨부 방식 등 구체 안내",
      "file_format": "PDF, HWP, ZIP 등"
    }}
  ],
  "document_sections": [
    {{"title": "작성 항목 제목", "hint": "해당 항목 작성 가이드", "order": 1}}
  ],
  "eligibility": ["지원 자격"],
  "submission_method": "제출 방법",
  "evaluation_criteria": ["평가 기준"],
  "benefits": ["상금, 지원금, 멘토링 등 혜택"],
  "cautions": ["유의사항, 결격 사유, 제출 제한"],
  "uncertain_fields": ["문서에서 불명확하거나 확인이 필요한 항목"],
  "source_evidence": [
    {{"field": "title", "quote": "원문 근거 문장", "page": 1, "note": "선택 메모"}}
  ]
}}

규칙:
- 모든 날짜는 YYYY-MM-DD로 변환하세요.
- 날짜를 확정할 수 없으면 timeline에 넣지 말고 uncertain_fields에 적으세요.
- 제출 마감, 신청 기한, 접수 마감은 is_deadline=true로 표시하세요.
- checklist에는 공고문에 명시된 제출 서류만 포함하세요.
- document_sections는 실제 양식 항목이 있으면 그대로 추출하고, 없으면 doc_type에 맞는 4~8개 섹션을 제안하세요.
- 제목, 기관명, 자격, 제출 방법, 지원금액은 근거가 없으면 추측하지 마세요.
- 모든 텍스트는 한국어로 작성하세요.

공고문 내용:
{text}"""

MATCH_PROMPT = """아래 공고 분석 결과와 사용자/팀 프로필을 비교해 지원 적합성을 JSON으로 평가하세요.

응답 JSON 형식:
{{
  "score": 0,
  "verdict": "지원 적합성 판단 문장",
  "signals": [
    {{"label": "항목", "status": "match | gap | unknown", "detail": "근거"}}
  ],
  "missing_inputs": ["판단을 위해 더 필요한 정보"],
  "recommended_next_steps": ["다음 액션"]
}}

규칙:
- eligibility와 company_profile이 직접 맞는지 확인하세요.
- 정보가 부족하면 unknown으로 두고 missing_inputs에 넣으세요.
- 탈락 가능성이 있는 요건은 gap으로 명확히 표시하세요.

공고 분석:
{analysis}

사용자/팀 프로필:
{profile}"""


def _clean_json(text: str) -> str:
    text = text.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if code_block:
        return code_block.group(1).strip()
    json_match = re.search(r"\{[\s\S]+\}", text)
    if json_match:
        return json_match.group(0).strip()
    return text


def _validate_result(data: dict) -> dict:
    valid_doc_types = {"competition", "research", "scholarship", "startup"}
    if data.get("doc_type") not in valid_doc_types:
        data["doc_type"] = "competition"
    data.setdefault("title", "제목 미상")
    data.setdefault("organization", "기관 미상")
    data.setdefault("summary", "")
    for key in (
        "timeline",
        "checklist",
        "document_sections",
        "eligibility",
        "evaluation_criteria",
        "benefits",
        "cautions",
        "uncertain_fields",
        "source_evidence",
    ):
        if not isinstance(data.get(key), list):
            data[key] = []
    if data.get("submission_method") is not None:
        data["submission_method"] = str(data["submission_method"])
    return data


def _call_json(model: str, system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    completion = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return json.loads(_clean_json(completion.choices[0].message.content or "{}"))


def analyze_announcement(text: str, source_name: str = "uploaded document") -> dict:
    """Analyze announcement text with OpenAI and return a validated dict."""
    if not settings.OPENAI_API_KEY:
        raise AnalysisError("OpenAI API 키가 설정되지 않았습니다. 환경변수를 확인해 주세요.")

    truncated_text = text[:MAX_TEXT_LENGTH]
    if len(text) > MAX_TEXT_LENGTH:
        truncated_text += "\n\n[이후 내용은 길이 제한으로 생략되었습니다.]"

    today = date.today().isoformat()
    user_prompt = ANALYSIS_PROMPT.format(today=today, source_name=source_name, text=truncated_text)

    try:
        t0 = time.time()
        data = _call_json(settings.OPENAI_ANALYSIS_MODEL, SYSTEM_PROMPT, user_prompt)
        logger.info(f"OpenAI analysis response received ({time.time() - t0:.1f}s)")
        return _validate_result(data)
    except json.JSONDecodeError:
        logger.warning("Initial JSON parsing failed; retrying once")
    except AuthenticationError:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.")
    except APIConnectionError:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크를 확인해 주세요.")
    except RateLimitError:
        raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.")
    except Exception as e:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {str(e)}")

    try:
        retry_prompt = user_prompt + "\n\n반드시 JSON 객체만 다시 출력하세요. 설명 없이 { 로 시작해서 } 로 끝내세요."
        data = _call_json(settings.OPENAI_ANALYSIS_MODEL, SYSTEM_PROMPT, retry_prompt)
        return _validate_result(data)
    except json.JSONDecodeError as e:
        raise AnalysisError(f"AI 응답을 JSON으로 해석하지 못했습니다. 공고문을 다시 확인해 주세요. ({e})")
    except AuthenticationError:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.")
    except APIConnectionError:
        raise AnalysisError("OpenAI API 연결에 실패했습니다.")
    except RateLimitError:
        raise AnalysisError("OpenAI API 요청 한도를 초과했습니다.")
    except Exception as e:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {str(e)}")


def evaluate_match(analysis: dict, company_profile: CompanyProfile) -> dict:
    """Evaluate announcement fit for a user or team profile."""
    if not settings.OPENAI_API_KEY:
        return _mock_match_report(company_profile)

    prompt = MATCH_PROMPT.format(
        analysis=json.dumps(analysis, ensure_ascii=False),
        profile=company_profile.model_dump_json(),
    )
    try:
        data = _call_json(settings.OPENAI_ANALYSIS_MODEL, SYSTEM_PROMPT, prompt, max_tokens=2048)
        data["score"] = max(0, min(100, int(data.get("score", 0))))
        return data
    except Exception as e:
        logger.warning(f"Match evaluation failed; using heuristic report: {e}")
        return _mock_match_report(company_profile)


def _mock_match_report(company_profile: CompanyProfile) -> dict:
    has_profile = bool(company_profile.name or company_profile.industry or company_profile.strengths)
    score = 68 if has_profile else 45
    return {
        "score": score,
        "verdict": "기본 요건은 검토 가능하지만, 세부 자격은 공고 원문과 사용자 정보를 추가 확인해야 합니다.",
        "signals": [
            {
                "label": "지원 자격",
                "status": "unknown",
                "detail": "사용자/팀 정보와 공고의 자격 조건을 더 대조해야 합니다.",
            },
            {
                "label": "작성 가능성",
                "status": "match" if has_profile else "unknown",
                "detail": "프로필 정보가 있으면 초안에 바로 반영할 수 있습니다.",
            },
        ],
        "missing_inputs": ["소속/재학 상태", "역할", "최근 실적", "지원 제외 이력"],
        "recommended_next_steps": ["필수 제출 서류를 확인하세요.", "불확실한 자격 조건은 주관 기관에 확인하세요."],
    }
