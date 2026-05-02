import json
import logging
import re
import time
from datetime import date

from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError

from core.config import settings
from core.errors import AnalysisError

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 60_000

SYSTEM_PROMPT = """당신은 한국의 공모전, 정부지원사업, 장학금, 연구과제, 창업지원 공고문을 분석하는 전문 AI입니다.
반드시 유효한 JSON 객체만 반환하세요. 마크다운 코드블록이나 설명 문장을 포함하지 마세요.
공고문에 없는 핵심 사실은 추측하지 말고 uncertain_fields에 기록하세요."""

ANALYSIS_PROMPT = """다음 공고문을 분석해 JSON으로만 응답하세요.

오늘 날짜: {today}

응답 JSON 형식:
{{
  "doc_type": "competition | research | scholarship | startup",
  "title": "공고문 제목",
  "organization": "주관/운영 기관명",
  "timeline": [
    {{
      "label": "일정 이름",
      "date": "YYYY-MM-DD",
      "is_deadline": true
    }}
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
    {{
      "title": "작성 항목 제목",
      "hint": "해당 항목 작성 가이드",
      "order": 1
    }}
  ],
  "eligibility": ["지원 자격"],
  "submission_method": "제출 방법",
  "evaluation_criteria": ["평가 기준"],
  "benefits": ["상금, 지원금, 멘토링 등 혜택"],
  "cautions": ["유의사항, 결격 사유, 제출 제한"],
  "uncertain_fields": ["공고문에서 불명확하거나 확인이 필요한 항목"]
}}

규칙:
- 모든 날짜는 YYYY-MM-DD로 변환하세요.
- 날짜를 확정할 수 없으면 timeline에 넣지 마세요.
- 제출 마감, 신청 기한, 접수 마감은 is_deadline=true로 표시하세요.
- checklist는 공고문에 명시된 제출 서류만 포함하세요.
- document_sections는 실제 양식 항목이 있으면 그대로 추출하고, 없으면 doc_type에 맞는 4~8개 섹션을 추론하세요.
- 제목, 기관명, 자격, 제출 방법, 지원 금액은 공고문에 근거가 없으면 추측하지 마세요.
- 모든 텍스트는 한국어로 작성하세요.

공고문 내용:
{text}"""


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
    for key in (
        "timeline",
        "checklist",
        "document_sections",
        "eligibility",
        "evaluation_criteria",
        "benefits",
        "cautions",
        "uncertain_fields",
    ):
        if not isinstance(data.get(key), list):
            data[key] = []
    if data.get("submission_method") is not None:
        data["submission_method"] = str(data["submission_method"])
    return data


def analyze_announcement(text: str) -> dict:
    """Analyze announcement text with OpenAI and return a validated dict."""
    if not settings.OPENAI_API_KEY:
        raise AnalysisError("OpenAI API 키가 설정되지 않았습니다. 환경변수를 확인해 주세요.")

    truncated_text = text[:MAX_TEXT_LENGTH]
    if len(text) > MAX_TEXT_LENGTH:
        truncated_text += "\n\n[이후 내용은 길이 제한으로 생략되었습니다.]"

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    today = date.today().isoformat()
    user_prompt = ANALYSIS_PROMPT.format(today=today, text=truncated_text)

    def _call_api(extra_hint: str = "") -> str:
        completion = client.chat.completions.create(
            model=settings.OPENAI_ANALYSIS_MODEL,
            max_tokens=4096,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt + extra_hint},
            ],
        )
        return completion.choices[0].message.content or ""

    try:
        t0 = time.time()
        response_text = _call_api()
        logger.info(f"OpenAI analysis response received ({time.time() - t0:.1f}s)")
        return _validate_result(json.loads(_clean_json(response_text)))
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
        hint = "\n\n반드시 JSON 객체만 다시 출력하세요. 설명 문장 없이 { 로 시작해서 } 로 끝내세요."
        response_text = _call_api(hint)
        return _validate_result(json.loads(_clean_json(response_text)))
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
