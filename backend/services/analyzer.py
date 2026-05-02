import logging
import uuid
from datetime import date, datetime, timezone
from models.schemas import AnalysisResult, TimelineItem, ChecklistItem, DocumentSection

logger = logging.getLogger(__name__)

_FALLBACK_CHECKLIST: dict[str, list[dict]] = {
    "competition": [
        {"label": "신청서", "category": "required", "description": "지정 양식 사용", "file_format": "HWP, PDF"},
        {"label": "사업계획서", "category": "required", "description": "A4 10매 이내", "file_format": "HWP, PDF"},
        {"label": "팀 구성원 정보", "category": "optional", "description": "팀원별 역할 기재", "file_format": "PDF"},
    ],
    "research": [
        {"label": "연구계획서", "category": "required", "description": "지정 양식", "file_format": "HWP, PDF"},
        {"label": "연구책임자 이력서", "category": "required", "description": "책임연구자 기준", "file_format": "PDF"},
        {"label": "기관확인서", "category": "optional", "description": "소속 기관 인증", "file_format": "PDF"},
    ],
    "scholarship": [
        {"label": "장학금 신청서", "category": "required", "description": "지정 양식", "file_format": "HWP, PDF"},
        {"label": "성적증명서", "category": "required", "description": "직전 학기 발급", "file_format": "PDF"},
        {"label": "재학증명서", "category": "required", "description": "최근 1개월 이내 발급", "file_format": "PDF"},
    ],
    "startup": [
        {"label": "창업 신청서", "category": "required", "description": "지정 양식", "file_format": "HWP, PDF"},
        {"label": "사업계획서", "category": "required", "description": "A4 20매 이내", "file_format": "HWP, PDF"},
        {"label": "팀 구성원 이력서", "category": "optional", "description": "대표자 및 핵심 멤버", "file_format": "PDF"},
    ],
}

_FALLBACK_SECTIONS: dict[str, list[dict]] = {
    "competition": [
        {"title": "문제 정의", "hint": "해결하려는 사회적·기술적 문제와 현황을 데이터 기반으로 서술하세요.", "order": 1},
        {"title": "아이디어 개요", "hint": "핵심 아이디어를 한 문장으로 요약하고 경쟁 대비 차별점을 명확히 제시하세요.", "order": 2},
        {"title": "실현 방법", "hint": "구체적인 구현 방법, 기술 스택, 개발 일정을 기술하세요.", "order": 3},
        {"title": "기대 효과", "hint": "정량적·정성적 기대 효과와 사회적 파급력을 서술하세요.", "order": 4},
        {"title": "팀 소개", "hint": "팀원별 역할, 전공, 관련 경험을 간략히 소개하세요.", "order": 5},
    ],
    "research": [
        {"title": "연구 배경 및 필요성", "hint": "연구 주제의 사회적·학술적 필요성과 기존 연구와의 차별점을 서술하세요.", "order": 1},
        {"title": "연구 목적 및 목표", "hint": "측정 가능한 연구 목표를 명확하게 기술하세요.", "order": 2},
        {"title": "연구 내용 및 방법론", "hint": "수행 방법, 실험 설계, 데이터 수집 계획을 구체적으로 작성하세요.", "order": 3},
        {"title": "기대 성과 및 활용 방안", "hint": "논문·특허·기술이전 등 예상 성과와 산업 활용 계획을 서술하세요.", "order": 4},
        {"title": "연구팀 구성 및 역할", "hint": "연구책임자와 공동연구자의 전문성과 역할 분담을 기술하세요.", "order": 5},
    ],
    "scholarship": [
        {"title": "지원 동기", "hint": "이 장학금에 지원하게 된 구체적인 이유와 계기를 작성하세요.", "order": 1},
        {"title": "학업 성취 및 활동 실적", "hint": "학점, 수상 경력, 관련 활동을 구체적 수치와 함께 기재하세요.", "order": 2},
        {"title": "학업 계획", "hint": "장학금 수혜 후 구체적인 학업·연구 계획을 작성하세요.", "order": 3},
        {"title": "향후 목표 및 포부", "hint": "졸업 후 진로 방향과 장기적인 목표를 서술하세요.", "order": 4},
    ],
    "startup": [
        {"title": "문제 정의", "hint": "타겟 고객의 Pain Point와 시장 규모를 데이터로 제시하세요.", "order": 1},
        {"title": "솔루션 및 서비스 개요", "hint": "제품·서비스 핵심 기능과 경쟁사 대비 차별점을 명확히 하세요.", "order": 2},
        {"title": "비즈니스 모델", "hint": "수익 구조, 가격 정책, 고객 획득 전략을 구체적으로 작성하세요.", "order": 3},
        {"title": "시장 분석", "hint": "TAM/SAM/SOM 분석, 경쟁 현황, 진입 전략을 서술하세요.", "order": 4},
        {"title": "팀 구성 및 역량", "hint": "대표자와 핵심 멤버의 경력, 역할, 창업 동기를 소개하세요.", "order": 5},
        {"title": "투자 계획 및 성과 목표", "hint": "자금 조달 계획, 연차별 매출 목표, 핵심 KPI를 작성하세요.", "order": 6},
    ],
}


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
    """OpenAI 응답 dict를 AnalysisResult Pydantic 모델로 변환합니다."""
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

    doc_type = raw.get("doc_type", "competition")

    # 체크리스트가 비어있으면 doc_type별 폴백 사용
    if not checklist:
        logger.warning(f"체크리스트 비어있음 — {doc_type} 폴백 사용")
        fallback_items = _FALLBACK_CHECKLIST.get(doc_type, _FALLBACK_CHECKLIST["competition"])
        for i, item in enumerate(fallback_items):
            checklist.append(
                ChecklistItem(
                    id=f"check-{i + 1}",
                    label=item["label"],
                    category=item["category"],
                    description=item.get("description"),
                    file_format=item.get("file_format"),
                )
            )

    # 문서 섹션이 비어있으면 doc_type별 폴백 사용
    if not sections:
        logger.warning(f"문서 섹션 비어있음 — {doc_type} 폴백 사용")
        fallback_secs = _FALLBACK_SECTIONS.get(doc_type, _FALLBACK_SECTIONS["competition"])
        for item in fallback_secs:
            sections.append(
                DocumentSection(
                    id=f"section-{item['order']}",
                    title=item["title"],
                    hint=item["hint"],
                    order=item["order"],
                )
            )

    if not timeline:
        logger.warning("타임라인 비어있음 — 공고문에서 날짜를 추출하지 못했습니다")

    return AnalysisResult(
        id=result_id,
        doc_type=doc_type,
        title=raw.get("title", "제목 없음"),
        organization=raw.get("organization", "기관 미상"),
        timeline=timeline,
        checklist=checklist,
        document_template=sections,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
