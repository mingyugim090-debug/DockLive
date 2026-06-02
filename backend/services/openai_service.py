import json
import logging
import re
import time
from datetime import date

from core.config import settings
from core.errors import AnalysisError
from models.schemas import CompanyProfile
from services.ai_provider import call_json, provider_name

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 60_000
MIN_ANALYSIS_TEXT_CHARS = 20
UNSPECIFIED = "미명시"

SYSTEM_PROMPT = """[STRICT FACT MODE]
당신은 한국의 공모전, 정부지원사업, 장학금, 연구과제, 창업지원 공고를 분석하는 문서 자동화 AI입니다.

최상위 규칙:
1. 제공된 SOURCE_TEXT 안의 원문 텍스트와 표 데이터만 사용하세요.
2. 외부 지식, 일반적인 공고 관행, 추측, 보완 작성, 그럴듯한 기본값 생성을 금지합니다.
3. 문서에 명시되지 않은 값은 반드시 "미명시" 또는 빈 배열([])로 두고 uncertain_fields에 기록하세요.
4. title, organization, timeline, checklist, eligibility, submission_method, evaluation_criteria, benefits, cautions, document_sections의 모든 추출값은 source_evidence와 evidence_quotes로 원문 근거를 제공해야 합니다.
5. evidence_quotes의 모든 항목은 SOURCE_TEXT에 실제로 존재하는 짧은 원문 인용이어야 합니다. 원문에 없는 문장은 만들지 마세요.
6. 원문 근거가 없는 항목은 응답에 넣지 마세요. 마감일, 지원 대상, 제출 서류, 지원금, 연락처는 특히 절대 추측하지 마세요.
7. 반드시 유효한 JSON 객체만 반환하세요. 마크다운 코드블록이나 설명 문장은 포함하지 마세요."""

ANALYSIS_RESPONSE_SCHEMA = {
    "title": "announcement_analysis",
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "doc_type": {"type": "string", "enum": ["competition", "research", "scholarship", "startup", "government_rnd"]},
        "title": {"type": "string"},
        "organization": {"type": "string"},
        "summary": {"type": "string"},
        "timeline": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "date": {"type": "string"},
                    "is_deadline": {"type": "boolean"},
                },
                "required": ["label", "date", "is_deadline"],
            },
        },
        "checklist": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "category": {"type": "string", "enum": ["required", "optional"]},
                    "description": {"type": "string"},
                    "file_format": {"type": "string"},
                },
                "required": ["label", "category", "description", "file_format"],
            },
        },
        "document_sections": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string"},
                    "hint": {"type": "string"},
                    "order": {"type": "integer"},
                },
                "required": ["title", "hint", "order"],
            },
        },
        "eligibility": {"type": "array", "items": {"type": "string"}},
        "submission_method": {"type": "string"},
        "evaluation_criteria": {"type": "array", "items": {"type": "string"}},
        "benefits": {"type": "array", "items": {"type": "string"}},
        "support_programs": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "parent_program": {"type": "string"},
                    "sub_program": {"type": "string"},
                    "support_scale": {"type": "string"},
                    "development_period": {"type": "string"},
                    "support_limit": {"type": "string"},
                    "support_ratio": {"type": "string"},
                    "schedule": {"type": "string"},
                    "notes": {"type": "string"},
                    "source_evidence_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "parent_program",
                    "sub_program",
                    "support_scale",
                    "development_period",
                    "support_limit",
                    "support_ratio",
                    "schedule",
                    "notes",
                    "source_evidence_ids",
                ],
            },
        },
        "cautions": {"type": "array", "items": {"type": "string"}},
        "uncertain_fields": {"type": "array", "items": {"type": "string"}},
        "evidence_quotes": {"type": "array", "items": {"type": "string"}},
        "source_evidence": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "field": {"type": "string"},
                    "quote": {"type": "string"},
                    "page": {"type": ["integer", "null"]},
                    "note": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["field", "quote", "page", "note", "confidence"],
            },
        },
        "missing_questions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "question": {"type": "string"},
                    "reason": {"type": "string"},
                    "required_for": {"type": "string"},
                },
                "required": ["id", "question", "reason", "required_for"],
            },
        },
    },
    "required": [
        "doc_type",
        "title",
        "organization",
        "summary",
        "timeline",
        "checklist",
        "document_sections",
        "eligibility",
        "submission_method",
        "evaluation_criteria",
        "benefits",
        "support_programs",
        "cautions",
        "uncertain_fields",
        "evidence_quotes",
        "source_evidence",
        "missing_questions",
    ],
}

MATCH_RESPONSE_SCHEMA = {
    "title": "match_report",
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "verdict": {"type": "string"},
        "signals": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "status": {"type": "string", "enum": ["match", "gap", "unknown"]},
                    "detail": {"type": "string"},
                },
                "required": ["label", "status", "detail"],
            },
        },
        "missing_inputs": {"type": "array", "items": {"type": "string"}},
        "recommended_next_steps": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["score", "verdict", "signals", "missing_inputs", "recommended_next_steps"],
}

ANALYSIS_PROMPT = """다음 공고문을 분석해 JSON으로만 응답하세요.

오늘 날짜: {today}
출처: {source_name}

응답 JSON 형식:
{{
  "doc_type": "competition | research | scholarship | startup | government_rnd",
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
  "support_programs": [
    {{
      "parent_program": "상위 사업명",
      "sub_program": "내역사업명",
      "support_scale": "지원 규모",
      "development_period": "개발 기간",
      "support_limit": "지원 한도",
      "support_ratio": "지원 비율",
      "schedule": "세부사업별 공고/접수/선정 일정",
      "notes": "원문 근거가 있는 확인 필요 항목",
      "source_evidence_ids": ["support_program_table"]
    }}
  ],
  "cautions": ["주의사항, 결격 사유, 제출 제한"],
  "uncertain_fields": ["문서에서 불명확하거나 확인이 필요한 항목"],
  "evidence_quotes": ["SOURCE_TEXT에 실제 존재하는 원문 인용"],
  "source_evidence": [
    {{"field": "title", "quote": "원문 근거 문장", "page": 1, "note": "선택 메모", "confidence": 0.9}}
  ],
  "missing_questions": [
    {{"id": "q1", "question": "초안 작성을 위해 사용자에게 물어볼 질문", "reason": "질문이 필요한 이유", "required_for": "section_id 또는 required_documents"}}
  ]
}}

규칙:
- 모든 날짜는 YYYY-MM-DD로 변환하세요.
- 날짜를 확정할 수 없으면 timeline에 넣지 말고 uncertain_fields에 적으세요.
- 제출 마감, 신청 기한, 접수 마감은 is_deadline=true로 표시하세요.
- checklist에는 공고문에 명시된 제출 서류만 포함하세요.
- document_sections는 실제 작성 양식 항목이 있으면 그대로 추출하고, 없으면 빈 배열([])로 두세요. doc_type에 맞춰 섹션을 제안하지 마세요.
- IRIS/정부 R&D 통합공고에 지원사업 현황표가 있으면 support_programs에 세부사업별로 분리하세요. 월 단위 추진일정을 하나의 확정 제출 마감일로 만들지 마세요.
- 제목, 기관명, 자격, 제출 방법, 지원금액처럼 중요한 값은 근거가 없으면 "미명시"로 처리하고 uncertain_fields에 남기세요.
- 모든 source_evidence.quote와 evidence_quotes 항목은 아래 SOURCE_TEXT에 실제로 존재하는 원문 일부여야 합니다.
- 원문 근거를 찾지 못한 항목은 목록에서 제외하세요.
- 초안 작성에 필요한 사용자 정보가 문서에 없으면 missing_questions로 질문하세요.
- 모든 텍스트는 한국어로 작성하세요.

SOURCE_TEXT:
{text}"""

MATCH_PROMPT = """아래 공고 분석 결과와 사용자 프로필을 비교해 지원 적합성을 JSON으로 평가하세요.

응답 JSON 형식:
{{
  "score": 0,
  "verdict": "지원 적합성 판단 문장",
  "signals": [
    {{"label": "항목", "status": "match | gap | unknown", "detail": "근거"}}
  ],
  "missing_inputs": ["판단에 필요한 정보"],
  "recommended_next_steps": ["다음 액션"]
}}

규칙:
- eligibility와 company_profile이 직접 맞는지 확인하세요.
- 정보가 부족하면 unknown으로 두고 missing_inputs에 적으세요.
- 탈락 가능성이 있는 조건은 gap으로 명확히 표시하세요.

공고 분석:
{analysis}

사용자 프로필:
{profile}"""


_FIELD_ALIASES = {
    "title": {"title", "announcement_title", "공고명", "제목"},
    "organization": {"organization", "organizer", "agency", "기관", "주관"},
    "timeline": {"timeline", "schedule", "deadline", "date", "일정", "마감", "기간"},
    "checklist": {"checklist", "attachments", "documents", "required_documents", "제출서류", "서류"},
    "document_sections": {"document_sections", "sections", "template", "form", "작성항목", "양식"},
    "eligibility": {"eligibility", "qualification", "target", "지원자격", "대상"},
    "submission_method": {"submission_method", "submission", "apply", "접수", "제출방법"},
    "evaluation_criteria": {"evaluation_criteria", "criteria", "평가", "심사"},
    "benefits": {"benefits", "support", "prize", "지원금", "혜택"},
    "support_programs": {"support_programs", "support_program_table", "program", "sub_program", "지원사업", "세부사업", "내역사업"},
    "cautions": {"cautions", "restrictions", "notice", "유의", "주의", "제한"},
}


def _clean_source_text(text: str) -> str:
    cleaned = (text or "").replace("\x00", "")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{4,}", "\n\n\n", cleaned)
    return cleaned.strip()


def _format_source_context(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(f"L{index:04d}: {line}" for index, line in enumerate(lines, start=1))


def _normalize_for_lookup(value: str) -> str:
    return re.sub(r"\s+", "", value or "").lower()


def _strip_line_prefix(value: str) -> str:
    return re.sub(r"^L\d{1,5}\s*[:|]\s*", "", value or "").strip()


def _quote_in_source(quote: str, source_text: str) -> bool:
    cleaned_quote = _strip_line_prefix(str(quote))
    if len(_normalize_for_lookup(cleaned_quote)) < 3:
        return False
    return _normalize_for_lookup(cleaned_quote) in _normalize_for_lookup(source_text)


def _append_unique(items: list[str], value: str) -> None:
    cleaned = str(value or "").strip()
    if cleaned and cleaned not in items:
        items.append(cleaned)


def _append_uncertain(data: dict, message: str) -> None:
    if not isinstance(data.get("uncertain_fields"), list):
        data["uncertain_fields"] = []
    _append_unique(data["uncertain_fields"], message)


def _has_evidence_for_field(field: str, evidence: list[dict]) -> bool:
    aliases = _FIELD_ALIASES.get(field, {field})
    for item in evidence:
        raw_field = _normalize_for_lookup(str(item.get("field", "")))
        if any(_normalize_for_lookup(alias) in raw_field for alias in aliases):
            return True
    return False


def _value_in_source(value: str, source_text: str) -> bool:
    cleaned = str(value or "").strip()
    if not cleaned or cleaned in {UNSPECIFIED, "정보 없음", "제목 미상", "기관 미상"}:
        return True
    if len(_normalize_for_lookup(cleaned)) < 3:
        return False
    return _normalize_for_lookup(cleaned) in _normalize_for_lookup(source_text)


def _item_text_in_source(item: object, source_text: str) -> bool:
    if isinstance(item, str):
        return _value_in_source(item, source_text)
    if isinstance(item, dict):
        for value in item.values():
            if isinstance(value, str) and value not in {"required", "optional", "true", "false"}:
                if _value_in_source(value, source_text):
                    return True
    return False


def _filter_unsupported_list(data: dict, key: str, source_text: str, evidence: list[dict]) -> None:
    values = data.get(key)
    if not isinstance(values, list) or not values or not source_text:
        return
    if key == "timeline" and _has_evidence_for_field(key, evidence):
        return
    filtered = [item for item in values if _item_text_in_source(item, source_text)]
    if len(filtered) != len(values):
        data[key] = filtered
        _append_uncertain(data, f"{key}: 원문 근거가 확인되지 않은 항목을 제외했습니다.")


def _validated_evidence(data: dict, source_text: str) -> list[dict]:
    evidence: list[dict] = []
    rejected = 0
    for item in data.get("source_evidence", []):
        if not isinstance(item, dict):
            rejected += 1
            continue
        quote = str(item.get("quote") or "").strip()
        field = str(item.get("field") or "").strip()
        if not field or not quote or (source_text and not _quote_in_source(quote, source_text)):
            rejected += 1
            continue
        try:
            confidence = max(0.0, min(1.0, float(item.get("confidence", 0.7))))
        except (TypeError, ValueError):
            confidence = 0.7
        page = item.get("page")
        evidence.append(
            {
                "field": field,
                "quote": _strip_line_prefix(quote)[:500],
                "page": page if isinstance(page, int) else None,
                "note": str(item.get("note") or "").strip(),
                "confidence": confidence,
            }
        )
    if rejected:
        _append_uncertain(data, "근거 인용이 원문에서 확인되지 않은 항목을 제외했습니다.")
    return evidence


def _validated_evidence_quotes(data: dict, source_text: str, evidence: list[dict]) -> list[str]:
    quotes: list[str] = []
    for quote in data.get("evidence_quotes", []):
        if isinstance(quote, str) and (not source_text or _quote_in_source(quote, source_text)):
            _append_unique(quotes, _strip_line_prefix(quote)[:500])
    for item in evidence:
        _append_unique(quotes, str(item.get("quote", ""))[:500])
    if data.get("evidence_quotes") and len(quotes) < len(data.get("evidence_quotes", [])):
        _append_uncertain(data, "원문에 존재하지 않는 evidence_quotes를 제외했습니다.")
    return quotes


def _validate_result(data: dict, source_text: str = "") -> dict:
    if not isinstance(data, dict):
        raise AnalysisError("AI 분석 응답 형식이 올바르지 않습니다.")

    data = dict(data)
    valid_doc_types = {"competition", "research", "scholarship", "startup", "government_rnd"}
    if data.get("doc_type") not in valid_doc_types:
        data["doc_type"] = "competition"
    data.setdefault("title", UNSPECIFIED)
    data.setdefault("organization", UNSPECIFIED)
    data.setdefault("summary", "")
    for key in (
        "timeline",
        "checklist",
        "document_sections",
        "eligibility",
        "evaluation_criteria",
        "benefits",
        "support_programs",
        "cautions",
        "uncertain_fields",
        "evidence_quotes",
        "source_evidence",
        "missing_questions",
    ):
        if not isinstance(data.get(key), list):
            data[key] = []
    if data.get("submission_method") is not None:
        data["submission_method"] = str(data["submission_method"])
    else:
        data["submission_method"] = UNSPECIFIED

    evidence = _validated_evidence(data, source_text)
    data["source_evidence"] = evidence
    data["evidence_quotes"] = _validated_evidence_quotes(data, source_text, evidence)

    for key in ("title", "organization", "submission_method"):
        value = str(data.get(key) or "").strip()
        if not _has_evidence_for_field(key, evidence) and source_text and not _value_in_source(value, source_text):
            data[key] = UNSPECIFIED
            _append_uncertain(data, f"{key}: 원문 근거가 없어 미명시로 처리했습니다.")

    for key in (
        "timeline",
        "checklist",
        "document_sections",
        "eligibility",
        "evaluation_criteria",
        "benefits",
        "support_programs",
        "cautions",
    ):
        _filter_unsupported_list(data, key, source_text, evidence)

    if source_text and not data["evidence_quotes"]:
        data["summary"] = "원문 근거 인용이 없어 자동 요약을 보류했습니다."
        _append_uncertain(data, "분석 결과에 검증 가능한 원문 인용이 없습니다.")
    return data


def analyze_announcement(text: str, source_name: str = "uploaded document") -> dict:
    """Analyze announcement text with the configured AI provider."""
    source_text = _clean_source_text(text)
    if len(_normalize_for_lookup(source_text)) < MIN_ANALYSIS_TEXT_CHARS:
        raise AnalysisError("문서에서 분석 가능한 텍스트를 충분히 찾지 못했습니다. HWP/HWPX 파싱 결과를 확인해 주세요.")

    truncated_text = source_text[:MAX_TEXT_LENGTH]
    if len(source_text) > MAX_TEXT_LENGTH:
        truncated_text += "\n\n[이후 내용은 길이 제한으로 생략되었습니다.]"
    source_context = _format_source_context(truncated_text)
    logger.info(
        "analysis source dump: source=%s chars=%d lines=%d preview=%r",
        source_name,
        len(truncated_text),
        source_context.count("\n") + 1 if source_context else 0,
        truncated_text[:1200],
    )

    today = date.today().isoformat()
    user_prompt = ANALYSIS_PROMPT.format(today=today, source_name=source_name, text=source_context)

    try:
        t0 = time.time()
        data = call_json(
            "analysis",
            SYSTEM_PROMPT,
            user_prompt,
            json_schema=ANALYSIS_RESPONSE_SCHEMA,
            schema_name="announcement_analysis",
        )
        logger.info("%s analysis response received (%.1fs)", provider_name(), time.time() - t0)
        return _validate_result(data, truncated_text)
    except json.JSONDecodeError:
        logger.warning("Initial JSON parsing failed; retrying once")
    except AnalysisError:
        raise
    except Exception as exc:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {exc}") from exc

    try:
        retry_prompt = user_prompt + "\n\n반드시 JSON 객체만 다시 출력하세요. 설명 없이 { 로 시작해서 } 로 끝내세요."
        data = call_json(
            "analysis",
            SYSTEM_PROMPT,
            retry_prompt,
            json_schema=ANALYSIS_RESPONSE_SCHEMA,
            schema_name="announcement_analysis",
        )
        return _validate_result(data, truncated_text)
    except json.JSONDecodeError as exc:
        raise AnalysisError(f"AI 응답을 JSON으로 해석하지 못했습니다. 공고문을 다시 확인해 주세요. ({exc})") from exc
    except AnalysisError:
        raise
    except Exception as exc:
        raise AnalysisError(f"분석 중 오류가 발생했습니다: {exc}") from exc


def evaluate_match(analysis: dict, company_profile: CompanyProfile) -> dict:
    """Evaluate announcement fit for a user or team profile."""
    if settings.MOCK_MODE:
        return _mock_match_report(company_profile)

    prompt = MATCH_PROMPT.format(
        analysis=json.dumps(analysis, ensure_ascii=False),
        profile=company_profile.model_dump_json(),
    )
    try:
        data = call_json("match", SYSTEM_PROMPT, prompt, max_tokens=2048, json_schema=MATCH_RESPONSE_SCHEMA, schema_name="match_report")
        data["score"] = max(0, min(100, int(data.get("score", 0))))
        return data
    except Exception as exc:
        logger.warning("Match evaluation failed; using heuristic report: %s", exc)
        return _mock_match_report(company_profile)


def _mock_match_report(company_profile: CompanyProfile) -> dict:
    has_profile = bool(company_profile.name or company_profile.industry or company_profile.strengths)
    score = 68 if has_profile else 45
    return {
        "score": score,
        "verdict": "기본 요건은 검토 가능하지만 세부 자격은 공고 원문과 사용자 정보를 추가 확인해야 합니다.",
        "signals": [
            {
                "label": "지원 자격",
                "status": "unknown",
                "detail": "사용자 정보와 공고의 자격 조건을 대조할 추가 정보가 필요합니다.",
            },
            {
                "label": "작성 가능성",
                "status": "match" if has_profile else "unknown",
                "detail": "프로필 정보가 있으면 초안에 바로 반영할 수 있습니다.",
            },
        ],
        "missing_inputs": ["소속/학적 상태", "팀 역할", "최근 실적", "지원 제외 이력"],
        "recommended_next_steps": ["필수 제출 서류를 확인하세요.", "불확실한 자격 조건은 주관 기관에 확인하세요."],
    }
