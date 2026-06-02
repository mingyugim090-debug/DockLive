import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any

from models.schemas import AnalysisResult, ChecklistItem, DocumentSection, MissingQuestion, SourceEvidence, TimelineItem

logger = logging.getLogger(__name__)

_FALLBACK_CHECKLIST: dict[str, list[dict[str, str]]] = {
    "competition": [
        {"label": "참가 신청서", "category": "required", "description": "공고에서 지정한 신청 양식", "file_format": "HWP, HWPX, PDF"},
        {"label": "제안서 또는 활동 계획서", "category": "required", "description": "분량과 양식은 공고 원문 확인 필요", "file_format": "HWP, HWPX, PDF"},
        {"label": "팀 구성원 정보", "category": "optional", "description": "팀 참가 시 제출", "file_format": "PDF"},
    ],
    "research": [
        {"label": "연구계획서", "category": "required", "description": "지원기관 지정 양식", "file_format": "HWP, HWPX, PDF"},
        {"label": "연구책임자 이력서", "category": "required", "description": "책임연구자 기준", "file_format": "PDF"},
    ],
    "scholarship": [
        {"label": "장학금 신청서", "category": "required", "description": "지원기관 지정 양식", "file_format": "HWP, HWPX, PDF"},
        {"label": "성적증명서", "category": "required", "description": "최근 발급본", "file_format": "PDF"},
        {"label": "재학증명서", "category": "required", "description": "최근 발급본", "file_format": "PDF"},
    ],
    "startup": [
        {"label": "창업 지원 신청서", "category": "required", "description": "지원기관 지정 양식", "file_format": "HWP, HWPX, PDF"},
        {"label": "사업계획서", "category": "required", "description": "공고 양식과 분량 확인 필요", "file_format": "HWP, HWPX, PDF"},
        {"label": "팀 구성원 이력서", "category": "optional", "description": "팀 참가 시 제출", "file_format": "PDF"},
    ],
}

_FALLBACK_SECTIONS: dict[str, list[dict[str, str | int]]] = {
    "competition": [
        {"title": "문제 정의", "hint": "해결하려는 문제와 배경을 구체적으로 작성하세요.", "order": 1},
        {"title": "아이디어 개요", "hint": "제안하는 아이디어와 차별점을 요약하세요.", "order": 2},
        {"title": "실행 방법", "hint": "구현 방식, 일정, 필요한 자원을 설명하세요.", "order": 3},
        {"title": "기대 효과", "hint": "정량적·정성적 효과를 작성하세요.", "order": 4},
        {"title": "팀 소개", "hint": "팀원의 역할과 관련 경험을 소개하세요.", "order": 5},
    ],
    "research": [
        {"title": "연구 배경", "hint": "연구 필요성과 기존 연구 대비 차별점을 작성하세요.", "order": 1},
        {"title": "연구 목적", "hint": "측정 가능한 연구 목표를 명확히 작성하세요.", "order": 2},
        {"title": "연구 방법", "hint": "수행 방법, 실험 설계, 데이터 수집 계획을 작성하세요.", "order": 3},
        {"title": "기대 성과", "hint": "학술적·사회적 활용 방안을 작성하세요.", "order": 4},
    ],
    "scholarship": [
        {"title": "지원 동기", "hint": "장학금이 필요한 이유와 계기를 작성하세요.", "order": 1},
        {"title": "학업 성과", "hint": "성적, 활동, 수상 경험을 작성하세요.", "order": 2},
        {"title": "학업 계획", "hint": "장학금 수혜 후의 학업 계획을 작성하세요.", "order": 3},
        {"title": "향후 목표", "hint": "진로 방향과 장기 목표를 작성하세요.", "order": 4},
    ],
    "startup": [
        {"title": "문제 정의", "hint": "고객 pain point와 시장 문제를 작성하세요.", "order": 1},
        {"title": "솔루션 개요", "hint": "제품 또는 서비스의 핵심 기능과 차별점을 작성하세요.", "order": 2},
        {"title": "비즈니스 모델", "hint": "수익 구조, 고객, 가격 전략을 작성하세요.", "order": 3},
        {"title": "시장 분석", "hint": "시장 규모, 경쟁 상황, 진입 전략을 작성하세요.", "order": 4},
        {"title": "팀 구성", "hint": "팀원의 역할과 역량을 작성하세요.", "order": 5},
    ],
}


def _calculate_d_day(date_str: str) -> int:
    try:
        target = date.fromisoformat(date_str)
        return (target - date.today()).days
    except (ValueError, TypeError):
        return 0


def _get_d_day_status(d_day: int) -> str:
    if d_day < 0:
        return "passed"
    if d_day <= 3:
        return "danger"
    if d_day <= 7:
        return "warning"
    return "safe"


def _normalize_date(date_str: Any) -> str:
    if not date_str:
        return ""
    value = str(date_str).strip()
    try:
        date.fromisoformat(value)
        return value
    except ValueError:
        pass

    for sep in (".", "/"):
        parts = [part.strip() for part in value.split(sep) if part.strip()]
        if len(parts) == 3:
            try:
                normalized = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                date.fromisoformat(normalized)
                return normalized
            except (ValueError, IndexError):
                continue
    return ""


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _source_evidence(value: Any) -> list[SourceEvidence]:
    if not isinstance(value, list):
        return []
    evidence: list[SourceEvidence] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field", "")).strip()
        quote = str(item.get("quote") or item.get("sourceText") or item.get("source_text") or "").strip()
        if not field or not quote:
            continue
        raw_confidence = item.get("confidence", 0.7)
        try:
            confidence = max(0.0, min(1.0, float(raw_confidence)))
        except (TypeError, ValueError):
            confidence = 0.7
        page = item.get("page")
        if not isinstance(page, int):
            page = item.get("sourcePage") if isinstance(item.get("sourcePage"), int) else None
        evidence.append(
            SourceEvidence(
                field=field,
                quote=quote[:500],
                page=page,
                note=str(item.get("note")).strip() if item.get("note") else None,
                confidence=confidence,
            )
        )
    return evidence


def _ensure_deadline_evidence(evidence: list[SourceEvidence], timeline: list[TimelineItem]) -> list[SourceEvidence]:
    # Never synthesize evidence from normalized fields. Evidence must be a real
    # quote passed through from the extraction model and verified upstream.
    return evidence


def _evidence_quotes(value: Any, evidence: list[SourceEvidence]) -> list[str]:
    quotes: list[str] = []
    for quote in _as_list(value):
        if quote not in quotes:
            quotes.append(quote[:500])
    for item in evidence:
        if item.quote and item.quote not in quotes:
            quotes.append(item.quote[:500])
    return quotes


def _missing_questions(value: Any) -> list[MissingQuestion]:
    if not isinstance(value, list):
        return []
    questions: list[MissingQuestion] = []
    seen: set[str] = set()
    for index, item in enumerate(value[:8]):
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        if not question or question in seen:
            continue
        seen.add(question)
        question_id = str(item.get("id", "")).strip() or f"missing-q-{index + 1}"
        questions.append(
            MissingQuestion(
                id=question_id,
                question=question,
                reason=str(item.get("reason", "")).strip() or "초안 작성을 위해 추가 확인이 필요합니다.",
                required_for=str(item.get("required_for") or item.get("requiredFor") or "").strip() or "section_draft",
            )
        )
    return questions


def _derive_missing_questions(
    raw_questions: list[MissingQuestion],
    uncertain_fields: list[str],
    sections: list[DocumentSection],
    checklist: list[ChecklistItem],
    submission_method: str | None,
) -> list[MissingQuestion]:
    questions = list(raw_questions)
    seen = {item.question for item in questions}

    def add(question: str, reason: str, required_for: str) -> None:
        if question in seen or len(questions) >= 8:
            return
        seen.add(question)
        questions.append(
            MissingQuestion(
                id=f"missing-q-{len(questions) + 1}",
                question=question,
                reason=reason,
                required_for=required_for,
            )
        )

    for field in uncertain_fields[:3]:
        add(f"{field} 항목을 확인해 주실 수 있나요?", "공고 원문에서 불명확한 핵심 조건입니다.", "analysis_confirmation")

    if not submission_method:
        add(
            "제출 방식이나 접수 경로를 알고 있나요?",
            "제출 방법이 명확하지 않으면 최종 안내 문구를 확정할 수 없습니다.",
            "submission_method",
        )

    if checklist:
        required_docs = [item.label for item in checklist if item.category == "required"][:3]
        if required_docs:
            add(
                f"{', '.join(required_docs)}에 넣을 본인 또는 팀 정보를 준비했나요?",
                "필수 제출서류 초안은 실제 제출자 정보에 맞춰 작성해야 합니다.",
                "required_documents",
            )

    if sections:
        first_section = sections[0].title
        add(
            f"{first_section} 섹션에 반드시 넣어야 할 경험, 성과, 수치가 있나요?",
            "섹션별 초안은 사용자가 제공한 사실만 근거로 작성해야 합니다.",
            sections[0].id,
        )
    else:
        add(
            "작성해야 할 항목이나 공식 서식 목차가 별도로 있나요?",
            "원문에서 작성 양식 항목을 확인하지 못했습니다.",
            "document_sections",
        )

    add(
        "지원자 또는 팀의 핵심 강점과 증명 가능한 성과는 무엇인가요?",
        "평가 기준에 맞는 제출 문장을 만들기 위해 필요합니다.",
        "draft_quality",
    )
    return questions


def build_analysis_result(raw: dict, source_type: str = "pdf", source_name: str | None = None) -> AnalysisResult:
    result_id = str(uuid.uuid4())

    timeline: list[TimelineItem] = []
    seen_dates: set[str] = set()
    for i, item in enumerate(raw.get("timeline", [])):
        if not isinstance(item, dict):
            continue
        date_str = _normalize_date(item.get("date", ""))
        if not date_str:
            continue
        label = str(item.get("label", "")).strip() or "일정"
        dedup_key = f"{date_str}:{label}"
        if dedup_key in seen_dates:
            continue
        seen_dates.add(dedup_key)

        d_day = _calculate_d_day(date_str)
        timeline.append(
            TimelineItem(
                id=f"timeline-{i + 1}",
                label=label,
                date=date_str,
                d_day=d_day,
                is_deadline=bool(item.get("is_deadline", False)),
                status=_get_d_day_status(d_day),
            )
        )

    checklist: list[ChecklistItem] = []
    for i, item in enumerate(raw.get("checklist", [])):
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip()
        if not label:
            continue
        category = item.get("category", "required")
        if category not in ("required", "optional"):
            category = "required"
        checklist.append(
            ChecklistItem(
                id=f"check-{i + 1}",
                label=label,
                category=category,
                description=item.get("description") or None,
                file_format=item.get("file_format") or None,
            )
        )

    sections: list[DocumentSection] = []
    for i, item in enumerate(raw.get("document_sections", [])):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        sections.append(
            DocumentSection(
                id=f"section-{i + 1}",
                title=title,
                hint=str(item.get("hint", "")).strip() or "작성 내용을 구체적으로 입력하세요.",
                order=int(item.get("order", i + 1)),
            )
        )

    doc_type = raw.get("doc_type", "competition")
    if doc_type not in ("competition", "research", "scholarship", "startup", "government_rnd"):
        doc_type = "competition"
    uncertain_fields = _as_list(raw.get("uncertain_fields"))

    if not checklist:
        logger.warning("Checklist is empty; leaving submission documents unspecified")
        if "제출 서류: 원문에서 명시된 항목을 확인하지 못했습니다." not in uncertain_fields:
            uncertain_fields.append("제출 서류: 원문에서 명시된 항목을 확인하지 못했습니다.")

    if not sections:
        logger.warning("Document sections are empty; leaving document template unspecified")
        if "작성 항목: 원문에서 공식 작성 항목을 확인하지 못했습니다." not in uncertain_fields:
            uncertain_fields.append("작성 항목: 원문에서 공식 작성 항목을 확인하지 못했습니다.")

    if not timeline:
        logger.warning("Timeline is empty; no reliable dates were extracted")

    source_evidence = _ensure_deadline_evidence(_source_evidence(raw.get("source_evidence")), timeline)
    evidence_quotes = _evidence_quotes(raw.get("evidence_quotes"), source_evidence)
    submission_method = raw.get("submission_method") or None
    missing_questions = _derive_missing_questions(
        _missing_questions(raw.get("missing_questions")),
        uncertain_fields,
        sections,
        checklist,
        submission_method,
    )

    return AnalysisResult(
        id=result_id,
        source_type=source_type,
        source_name=source_name,
        summary=raw.get("summary") or "",
        doc_type=doc_type,
        title=raw.get("title") or "미명시",
        organization=raw.get("organization") or "미명시",
        timeline=timeline,
        checklist=checklist,
        document_template=sections,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        eligibility=_as_list(raw.get("eligibility")),
        submission_method=submission_method,
        evaluation_criteria=_as_list(raw.get("evaluation_criteria")),
        benefits=_as_list(raw.get("benefits")),
        cautions=_as_list(raw.get("cautions")),
        uncertain_fields=uncertain_fields,
        evidence_quotes=evidence_quotes,
        source_evidence=source_evidence,
        missing_questions=missing_questions,
    )
