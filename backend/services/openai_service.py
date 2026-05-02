import json
import logging
import re
import time
from datetime import date
from openai import OpenAI, AuthenticationError, APIConnectionError, RateLimitError
from core.config import settings
from core.errors import AnalysisError

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 60_000

SYSTEM_PROMPT = """당신은 한국 공모전·정부사업·장학금·창업지원 공고문 분석 전문 AI입니다.
공고문 텍스트를 분석하여 반드시 순수 JSON만 반환하세요. 마크다운 코드블록이나 설명 텍스트를 절대 포함하지 마세요."""

ANALYSIS_PROMPT = """다음 공고문을 분석하여 JSON으로만 응답하세요.

오늘 날짜: {today}

=== 응답 JSON 형식 ===
{{
  "doc_type": "competition | research | scholarship | startup",
  "title": "공고문 제목 (원문 그대로, 없으면 주제 요약)",
  "organization": "주관 기관명 (주최/주관/운영 기관명 원문 그대로)",
  "timeline": [
    {{
      "label": "일정 이름 (예: 접수 시작, 서류 마감, 결과 발표, 최종 선발, 협약 체결)",
      "date": "YYYY-MM-DD",
      "is_deadline": true
    }}
  ],
  "checklist": [
    {{
      "label": "제출 서류명",
      "category": "required 또는 optional",
      "description": "분량·양식·첨부 방법 등 구체 안내 (없으면 null)",
      "file_format": "허용 파일 형식 (예: PDF, HWP, ZIP)"
    }}
  ],
  "document_sections": [
    {{
      "title": "사업계획서/제안서/지원서 작성 항목 제목",
      "hint": "이 항목에 무엇을 어떻게 작성해야 하는지 100자 이내 구체 가이드",
      "order": 1
    }}
  ]
}}

=== 규칙 ===

[날짜 처리 — 오늘={today}]
- 모든 날짜를 YYYY-MM-DD 형식으로 변환 (반드시)
- 상대적 표현 변환 예시:
  · "공고일로부터 30일" → {today} 기준 +30일 계산
  · "접수 마감 후 2주 이내" → 접수마감일 + 14일
  · "2025년 5월 중" → 2025-05-31 (월 단위는 말일)
  · "상반기 중", "추후 공고" → 특정 불가 → timeline 항목 제외
- 날짜를 YYYY-MM-DD로 확정할 수 없으면 해당 timeline 항목 전체 제외 (null 금지)
- 동일 날짜+라벨 중복 제외

[doc_type 분류 기준]
- competition: 공모전, 아이디어 경진대회, 챌린지, 콘테스트, 해커톤, 경연대회
- research: 연구과제, 위탁연구, 학술용역, 연구비 지원, R&D, 과제 공모
- scholarship: 장학금, 장학생, 학비 지원, 생활비 지원, 성적 우수 장학
- startup: 창업지원, 창업팀, 스타트업, 액셀러레이터, 창업경진, 투자 연계

[checklist]
- 공고문에 명시된 제출 서류만 포함 (최소 1개, 최대 10개)
- 신청서·지원서·사업계획서는 반드시 required
- 선택/권장 서류(해당자에 한함, 선택 제출)는 optional
- 별도 양식이 있으면 file_format에 "지정 양식" 포함

[document_sections — 5~8개 작성]
- 공고문에 작성 항목이 명시되어 있으면 원문 기준으로 추출
- 명시 없으면 doc_type에 맞게 추론:
  · competition → 문제 정의 / 아이디어 개요 / 실현 방법 / 기대 효과 / 팀 소개
  · research → 연구 배경 / 연구 목적 / 연구 방법 / 기대 성과 / 연구팀 구성
  · scholarship → 지원 동기 / 학업 성취 실적 / 학업 계획 / 향후 목표
  · startup → 문제 정의 / 솔루션 개요 / 비즈니스 모델 / 시장 분석 / 팀 구성 / 투자 계획

[공통]
- is_deadline: true = 마감·제출·신청 기한 / false = 발표·설명회·오리엔테이션 등
- 모든 텍스트는 한국어
- JSON 외 절대 출력 금지

=== 공고문 내용 ===
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
    """공고문 텍스트를 OpenAI API로 분석합니다. JSON 파싱 실패 시 1회 재시도."""
    if not settings.OPENAI_API_KEY:
        raise AnalysisError("OpenAI API 키가 설정되지 않았습니다. 환경변수를 확인하세요.")

    truncated_text = text[:MAX_TEXT_LENGTH]
    if len(text) > MAX_TEXT_LENGTH:
        truncated_text += "\n\n[이하 내용 생략 — 핵심 정보는 위에 포함됨]"

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    today = date.today().isoformat()
    user_prompt = ANALYSIS_PROMPT.format(today=today, text=truncated_text)

    def _call_api(extra_hint: str = "") -> str:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=4096,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt + extra_hint},
            ],
        )
        return completion.choices[0].message.content

    try:
        t0 = time.time()
        response_text = _call_api()
        logger.info(f"OpenAI 응답 수신 ({time.time() - t0:.1f}s)")
        cleaned = _clean_json(response_text)
        result = json.loads(cleaned)
        return _validate_result(result)

    except json.JSONDecodeError:
        logger.warning("1차 JSON 파싱 실패, 재시도")
    except AuthenticationError:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.")
    except APIConnectionError:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크를 확인해주세요.")
    except RateLimitError:
        raise AnalysisError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.")
    except Exception as e:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {str(e)}")

    try:
        hint = "\n\n반드시 JSON만 출력하세요. 다른 텍스트 없이 { 로 시작해서 } 로 끝내세요."
        response_text = _call_api(hint)
        cleaned = _clean_json(response_text)
        result = json.loads(cleaned)
        return _validate_result(result)

    except json.JSONDecodeError as e:
        raise AnalysisError(f"AI 응답 파싱에 실패했습니다. 공고문을 다시 확인해주세요. (오류: {e})")
    except AuthenticationError:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.")
    except APIConnectionError:
        raise AnalysisError("OpenAI API 연결에 실패했습니다.")
    except RateLimitError:
        raise AnalysisError("API 요청 한도를 초과했습니다.")
    except Exception as e:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {str(e)}")
