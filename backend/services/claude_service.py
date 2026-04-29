import json
import re
import anthropic
from datetime import date
from core.config import settings
from core.errors import AnalysisError

# 최대 전송 텍스트 길이 (토큰 절약: 약 60,000자 ≈ 20,000 토큰)
MAX_TEXT_LENGTH = 60_000

SYSTEM_PROMPT = """당신은 한국 공모전·정부사업·장학금·창업지원 공고문을 분석하는 전문가입니다.
공고문 텍스트를 분석하여 반드시 순수 JSON만 반환하세요. 마크다운 코드블록이나 설명 텍스트를 절대 포함하지 마세요."""

ANALYSIS_PROMPT = """다음 공고문을 분석하여 아래 JSON 형식으로만 응답하세요.

오늘 날짜: {today}

응답 형식:
{{
  "doc_type": "competition | research | scholarship | startup",
  "title": "공고문 제목 (원문 그대로)",
  "organization": "주관 기관명",
  "timeline": [
    {{
      "label": "일정 이름 (예: 접수 시작, 서류 마감, 결과 발표, 최종 선발)",
      "date": "YYYY-MM-DD",
      "is_deadline": true또는false
    }}
  ],
  "checklist": [
    {{
      "label": "제출 서류명",
      "category": "required 또는 optional",
      "description": "페이지 수, 양식, 제출 방법 등 구체적인 안내",
      "file_format": "PDF, HWP, ZIP 등 허용 형식"
    }}
  ],
  "document_sections": [
    {{
      "title": "사업계획서 섹션 제목 또는 주요 작성 항목",
      "hint": "이 섹션에 무엇을 어떻게 작성해야 하는지 구체적인 가이드. 평가 기준과 연결된 핵심 포인트 포함.",
      "order": 1
    }}
  ]
}}

규칙:
- 날짜는 반드시 YYYY-MM-DD 형식. 상대적 표현(\"14일 이내\")은 오늘({today}) 기준 절대 날짜로 변환
- 날짜 불명확 시 해당 timeline 항목 제외
- doc_type: competition(공모전), research(연구과제), scholarship(장학금), startup(창업지원) 중 하나
- checklist: 공고문에 명시된 제출 서류만 포함 (최소 1개, 최대 10개)
- document_sections: 사업계획서/제안서 작성 항목. 없으면 공고 내용 기반으로 추론하여 5~7개 작성
- is_deadline: true = 마감/제출 기한, false = 발표/설명회 등
- 모든 텍스트는 한국어
- JSON 외 절대 출력 금지

[공고문 내용]
{text}"""


def _clean_json(text: str) -> str:
    """코드블록 제거 후 순수 JSON 추출."""
    text = text.strip()

    # ```json ... ``` 또는 ``` ... ``` 제거
    code_block = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if code_block:
        return code_block.group(1).strip()

    # { 로 시작하는 JSON 부분만 추출
    json_match = re.search(r"\{[\s\S]+\}", text)
    if json_match:
        return json_match.group(0).strip()

    return text


def _validate_result(data: dict) -> dict:
    """분석 결과 필드 유효성 검사 및 기본값 보정."""
    valid_doc_types = {"competition", "research", "scholarship", "startup"}

    if data.get("doc_type") not in valid_doc_types:
        data["doc_type"] = "competition"

    if not data.get("title"):
        data["title"] = "제목 없음"

    if not data.get("organization"):
        data["organization"] = "기관 미상"

    if not isinstance(data.get("timeline"), list):
        data["timeline"] = []

    if not isinstance(data.get("checklist"), list):
        data["checklist"] = []

    if not isinstance(data.get("document_sections"), list):
        data["document_sections"] = []

    return data


def analyze_announcement(text: str) -> dict:
    """공고문 텍스트를 Claude API로 분석합니다. JSON 파싱 실패 시 1회 재시도."""
    if not settings.ANTHROPIC_API_KEY:
        raise AnalysisError("Anthropic API 키가 설정되지 않았습니다. .env 파일을 확인하세요.")

    # 텍스트 길이 제한 (토큰 절약)
    truncated_text = text[:MAX_TEXT_LENGTH]
    if len(text) > MAX_TEXT_LENGTH:
        truncated_text += "\n\n[이하 내용 생략 — 핵심 정보는 위에 포함됨]"

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    today = date.today().isoformat()
    user_prompt = ANALYSIS_PROMPT.format(today=today, text=truncated_text)

    def _call_api(temperature_hint: str = "") -> str:
        """Claude API 호출 후 응답 텍스트 반환."""
        messages = [{"role": "user", "content": user_prompt + temperature_hint}]
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        return message.content[0].text

    # 1차 시도
    try:
        response_text = _call_api()
        cleaned = _clean_json(response_text)
        result = json.loads(cleaned)
        return _validate_result(result)

    except json.JSONDecodeError:
        # JSON 파싱 실패 → 재시도 (JSON만 달라고 명시)
        pass
    except anthropic.AuthenticationError:
        raise AnalysisError("Anthropic API 키가 유효하지 않습니다.")
    except anthropic.APIConnectionError:
        raise AnalysisError("Claude API 연결에 실패했습니다. 네트워크를 확인해주세요.")
    except anthropic.RateLimitError:
        raise AnalysisError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.")
    except Exception as e:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {str(e)}")

    # 2차 시도 (재시도)
    try:
        hint = "\n\n반드시 JSON만 출력하세요. 다른 텍스트 없이 { 로 시작해서 } 로 끝내세요."
        response_text = _call_api(hint)
        cleaned = _clean_json(response_text)
        result = json.loads(cleaned)
        return _validate_result(result)

    except json.JSONDecodeError as e:
        raise AnalysisError(f"AI 응답 파싱에 실패했습니다. 공고문을 다시 확인해주세요. (오류: {e})")
    except anthropic.AuthenticationError:
        raise AnalysisError("Anthropic API 키가 유효하지 않습니다.")
    except anthropic.APIConnectionError:
        raise AnalysisError("Claude API 연결에 실패했습니다.")
    except anthropic.RateLimitError:
        raise AnalysisError("API 요청 한도를 초과했습니다.")
    except Exception as e:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {str(e)}")
