import logging
import uuid
from datetime import date, datetime, timezone

from models.schemas import AnalysisResult, ChecklistItem, DocumentSection, SourceEvidence, TimelineItem

logger = logging.getLogger(__name__)

_FALLBACK_CHECKLIST: dict[str, list[dict[str, str]]] = {
    "competition": [
        {"label": "참가 신청서", "category": "required", "description": "공고에서 지정한 신청 양식", "file_format": "HWP, PDF"},
        {"label": "제안서 또는 활동 계획서", "category": "required", "description": "분량과 양식은 공고 원문 확인 필요", "file_format": "HWP, PDF"},
        {"label": "팀 구성원 정보", "category": "optional", "description": "팀 참가 시 제출", "file_format": "PDF"},
    ],
    "research": [
        {"label": "연구계획서", "category": "required", "description": "지원기관 지정 양식", "file_format": "HWP, PDF"},
        {"label": "연구책임자 이력서", "category": "required", "description": "책임연구자 기준", "file_format": "PDF"},
    ],
    "scholarship": [
        {"label": "장학금 신청서", "category": "required", "description": "지원기관 지정 양식", "file_format": "HWP, PDF"},
        {"label": "성적증명서", "category": "required", "description": "최근 발급본", "file_format": "PDF"},
        {"label": "재학증명서", "category": "required", "description": "최근 발급본", "file_format": "PDF"},
    ],
    "startup": [
        {"label": "창업 신청서", "category": "required", "description": "지원기관 지정 양식", "file_format": "HWP, PDF"},
        {"label": "사업계획서", "category": "required", "description": "공고 양식과 분량 확인 필요", "file_format": "HWP, PDF"},
        {"label": "팀 구성원 이력서", "category": "optional", "description": "팀 참가 시 제출", "file_format": "PDF"},
    ],
}

_FALLBACK_SECTIONS: dict[str, list[dict[str, str | int]]] = {
    "competition": [
        {"title": "문제 정의", "hint": "해결하려는 문제와 배경을 구체적으로 작성하세요.", "order": 1},
        {"title": "아이디어 개요", "hint": "제안하는 아이디어와 차별점을 요약하세요.", "order": 2},
        {"title": "실행 방법", "hint": "구현 방식, 일정, 필요한 자원을 설명하세요.", "order": 3},
        {"title": "기대 효과", "hint": "정량적/정성적 효과를 작성하세요.", "order": 4},
        {"title": "팀 소개", "hint": "팀원의 역할과 관련 경험을 소개하세요.", "order": 5},
    ],
    "research": [
        {"title": "연구 배경", "hint": "연구 필요성과 기존 연구 대비 차별점을 작성하세요.", "order": 1},
        {"title": "연구 목적", "hint": "측정 가능한 연구 목표를 명확히 작성하세요.", "order": 2},
        {"title": "연구 방법", "hint": "수행 방법, 실험 설계, 데이터 수집 계획을 작성하세요.", "order": 3},
        {"title": "기대 성과", "hint": "학술적/사회적 활용 방안을 작성하세요.", "order": 4},
    ],
    "scholarship": [
        {"title": "지원 동기", "hint": "장학금이 필요한 이유와 계기를 작성하세요.", "order": 1},
        {"title": "학업 성과", "hint": "성적, 활동, 수상 경험을 작성하세요.", "order": 2},
        {"title": "학업 계획", "hint": "장학금 수혜 후 학업 계획을 작성하세요.", "order": 3},
        {"title": "향후 목표", "hint": "진로 방향과 장기 목표를 작성하세요.", "order": 4},
    ],
    "startup": [
        {"title": "문제 정의", "hint": "고객 pain point와 시장 문제를 작성하세요.", "order": 1},
        {"title": "솔루션 개요", "hint": "제품/서비스의 핵심 기능과 차별점을 작성하세요.", "order": 2},
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


def _normalize_date(date_str: str) -> str:
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


def _as_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _source_evidence(value) -> list[SourceEvidence]:
    if not isinstance(value, list):
        return []
    evidence: list[SourceEvidence] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field", "")).strip()
        quote = str(item.get("quote", "")).strip()
        if not field or not quote:
            continue
        evidence.append(
            SourceEvidence(
                field=field,
                quote=quote[:500],
                page=item.get("page") if isinstance(item.get("page"), int) else None,
                note=str(item.get("note")).strip() if item.get("note") else None,
            )
        )
    return evidence


def build_analysis_result(raw: dict, source_type: str = "pdf", source_name: str | None = None) -> AnalysisResult:
    result_id = str(uuid.uuid4())

    timeline: list[TimelineItem] = []
    seen_dates: set[str] = set()
    for i, item in enumerate(raw.get("timeline", [])):
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
    if doc_type not in ("competition", "research", "scholarship", "startup"):
        doc_type = "competition"

    if not checklist:
        logger.warning("Checklist is empty; using fallback items")
        for i, item in enumerate(_FALLBACK_CHECKLIST.get(doc_type, _FALLBACK_CHECKLIST["competition"])):
            checklist.append(
                ChecklistItem(
                    id=f"check-{i + 1}",
                    label=item["label"],
                    category=item["category"],
                    description=item.get("description"),
                    file_format=item.get("file_format"),
                )
            )

    if not sections:
        logger.warning("Document sections are empty; using fallback sections")
        for item in _FALLBACK_SECTIONS.get(doc_type, _FALLBACK_SECTIONS["competition"]):
            sections.append(
                DocumentSection(
                    id=f"section-{item['order']}",
                    title=str(item["title"]),
                    hint=str(item["hint"]),
                    order=int(item["order"]),
                )
            )

    if not timeline:
        logger.warning("Timeline is empty; no reliable dates were extracted")

    return AnalysisResult(
        id=result_id,
        source_type=source_type,
        source_name=source_name,
        summary=raw.get("summary") or "",
        doc_type=doc_type,
        title=raw.get("title") or "제목 미상",
        organization=raw.get("organization") or "기관 미상",
        timeline=timeline,
        checklist=checklist,
        document_template=sections,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        eligibility=_as_list(raw.get("eligibility")),
        submission_method=raw.get("submission_method") or None,
        evaluation_criteria=_as_list(raw.get("evaluation_criteria")),
        benefits=_as_list(raw.get("benefits")),
        cautions=_as_list(raw.get("cautions")),
        uncertain_fields=_as_list(raw.get("uncertain_fields")),
        source_evidence=_source_evidence(raw.get("source_evidence")),
    )
