import uuid
from datetime import date, datetime, timezone
from models.schemas import AnalysisResult, TimelineItem, ChecklistItem, DocumentSection


def _calculate_d_day(date_str: str) -> int:
    """날짜 문자열로부터 D-Day를 계산합니다."""
    try:
        target = date.fromisoformat(date_str)
        today = date.today()
        return (target - today).days
    except (ValueError, TypeError):
        return 0


def _get_d_day_status(d_day: int) -> str:
    """D-Day 값으로 상태를 반환합니다."""
    if d_day < 0:
        return "passed"
    if d_day <= 3:
        return "danger"
    if d_day <= 7:
        return "warning"
    return "safe"


def _normalize_date(date_str: str) -> str:
    """YYYY-MM-DD 형식을 보장합니다. 변환 불가능하면 빈 문자열 반환."""
    if not date_str:
        return ""
    date_str = date_str.strip()
    # 이미 YYYY-MM-DD
    try:
        date.fromisoformat(date_str)
        return date_str
    except ValueError:
        pass
    # YYYY.MM.DD 또는 YYYY/MM/DD 변환
    for sep in (".", "/"):
        parts = date_str.split(sep)
        if len(parts) == 3:
            try:
                normalized = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                date.fromisoformat(normalized)
                return normalized
            except (ValueError, IndexError):
                continue
    return ""


def build_analysis_result(raw: dict) -> AnalysisResult:
    """Claude 응답 dict를 AnalysisResult Pydantic 모델로 변환합니다."""
    result_id = str(uuid.uuid4())

    # 타임라인 처리
    timeline: list[TimelineItem] = []
    seen_dates: set[str] = set()
    for i, item in enumerate(raw.get("timeline", [])):
        raw_date = item.get("date", "")
        date_str = _normalize_date(raw_date)
        if not date_str:
            continue
        # 같은 날짜 + 같은 라벨 중복 제거
        dedup_key = f"{date_str}:{item.get('label', '')}"
        if dedup_key in seen_dates:
            continue
        seen_dates.add(dedup_key)

        d_day = _calculate_d_day(date_str)
        status = _get_d_day_status(d_day)
        timeline.append(
            TimelineItem(
                id=f"timeline-{i + 1}",
                label=item.get("label", ""),
                date=date_str,
                d_day=d_day,
                is_deadline=bool(item.get("is_deadline", False)),
                status=status,
            )
        )

    # 체크리스트 처리
    checklist: list[ChecklistItem] = []
    for i, item in enumerate(raw.get("checklist", [])):
        label = item.get("label", "").strip()
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

    # 문서 섹션 처리
    sections: list[DocumentSection] = []
    for i, item in enumerate(raw.get("document_sections", [])):
        title = item.get("title", "").strip()
        hint = item.get("hint", "").strip()
        if not title:
            continue
        sections.append(
            DocumentSection(
                id=f"section-{i + 1}",
                title=title,
                hint=hint or "작성 내용을 구체적으로 기술하세요.",
                order=item.get("order", i + 1),
            )
        )

    return AnalysisResult(
        id=result_id,
        doc_type=raw.get("doc_type", "competition"),
        title=raw.get("title", "제목 없음"),
        organization=raw.get("organization", "기관 미상"),
        timeline=timeline,
        checklist=checklist,
        document_template=sections,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
