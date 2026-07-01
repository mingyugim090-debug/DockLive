from __future__ import annotations

import math
import re
from uuid import uuid4

from core.errors import AnalysisError
from models.schemas import (
    AgencyNoticeBrief,
    AgencyPriorNotice,
    AgencyPriorNoticeCreateRequest,
    AgencyPriorNoticeRecallItem,
    AgencyPriorNoticeRecallRequest,
    AgencySourceEvidence,
)
from services import storage
from services.ai_provider import embed_text


def create_prior_notice(request: AgencyPriorNoticeCreateRequest) -> AgencyPriorNotice:
    text = (request.text or "").strip()
    if not text:
        raise AnalysisError("과거 공고 텍스트가 필요합니다.")
    notice_id = f"prior-{uuid4()}"
    title = request.title.strip() or _extract_title(text)
    budget = request.budget.strip() or _extract_budget(text)
    program_period = request.program_period.strip() or _extract_period(text)
    summary = _summarize_prior_notice(text)
    embedding, model = embed_text(_recall_text(title, request.program_type, budget, program_period, text))
    notice = AgencyPriorNotice(
        id=notice_id,
        organization_id=request.organization_id,
        title=title,
        program_type=request.program_type.strip() or "support_program",
        budget=budget,
        budget_band=_budget_band(budget),
        program_period=program_period,
        summary=summary,
        text=text[:60_000],
        source_filename=request.source_filename,
        source_evidence=[
            AgencySourceEvidence(
                id=f"prior:{notice_id}:text",
                label=title,
                quote=text[:500],
                source_type="prior_notice",
                confidence=0.85,
            )
        ],
        embedding=embedding,
        embedding_model=model,
        embedding_dimension=len(embedding),
    )
    storage.save_agency_prior_notice(notice.id, notice.model_dump(mode="json"))
    return notice


def recall_prior_notices(request: AgencyPriorNoticeRecallRequest) -> list[AgencyPriorNoticeRecallItem]:
    query = _query_from_request(request)
    if not query.strip():
        raise AnalysisError("유사 과거 공고 검색에 사용할 브리프가 필요합니다.")
    query_embedding, _model = embed_text(query)
    query_tokens = _tokens(query)
    query_band = _budget_band(request.brief.budget if request.brief else request.budget)
    query_program_type = (request.brief.program_type if request.brief else request.program_type) or "support_program"

    results: list[AgencyPriorNoticeRecallItem] = []
    for payload in storage.list_agency_prior_notices(request.organization_id):
        notice = AgencyPriorNotice.model_validate(payload)
        semantic = _cosine(query_embedding, notice.embedding)
        lexical = _jaccard(query_tokens, _tokens(_notice_search_text(notice)))
        score = max(semantic, lexical)
        if notice.program_type == query_program_type:
            score += 0.15
        if query_band != "unspecified" and notice.budget_band == query_band:
            score += 0.05
        score = max(0.0, min(1.0, score))
        results.append(
            AgencyPriorNoticeRecallItem(
                id=notice.id,
                title=notice.title,
                program_type=notice.program_type,
                budget_band=notice.budget_band,
                program_period=notice.program_period,
                summary=notice.summary,
                similarity=round(score, 4),
                source_evidence=notice.source_evidence,
            )
        )
    return sorted(results, key=lambda item: item.similarity, reverse=True)[: request.limit]


def _query_from_request(request: AgencyPriorNoticeRecallRequest) -> str:
    if request.brief:
        return _recall_text(
            request.brief.title,
            request.brief.program_type,
            request.brief.budget,
            request.brief.program_period,
            "\n".join(
                [
                    request.brief.program_purpose,
                    request.brief.support_details,
                    request.brief.eligibility_rules,
                    request.brief.evaluation_criteria,
                ]
            ),
        )
    return _recall_text(
        request.title,
        request.program_type,
        request.budget,
        request.program_period,
        "\n".join([request.program_purpose, request.eligibility_rules]),
    )


def _notice_search_text(notice: AgencyPriorNotice) -> str:
    return _recall_text(notice.title, notice.program_type, notice.budget, notice.program_period, notice.text)


def _recall_text(title: str, program_type: str, budget: str, period: str, body: str) -> str:
    return "\n".join([title or "", program_type or "", budget or "", period or "", body or ""]).strip()


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[0-9A-Za-z가-힣]+", (text or "").lower()))


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, numerator / (left_norm * right_norm)))


def _extract_title(text: str) -> str:
    for line in text.splitlines():
        cleaned = line.strip(" #\t")
        if len(cleaned) >= 4:
            return cleaned[:120]
    return "과거 공고"


def _extract_budget(text: str) -> str:
    match = re.search(r"([0-9][0-9,]*(?:\.\d+)?\s*(?:원|만원|억원))", text)
    return match.group(1) if match else ""


def _extract_period(text: str) -> str:
    match = re.search(r"20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}[^.\n]{0,40}", text)
    return match.group(0).strip() if match else ""


def _summarize_prior_notice(text: str) -> str:
    compact = " ".join(line.strip() for line in text.splitlines() if line.strip())
    return compact[:220]


def _budget_band(budget: str) -> str:
    text = budget or ""
    match = re.search(r"([0-9][0-9,]*(?:\.\d+)?)\s*(억원|만원|원)?", text)
    if not match:
        return "unspecified"
    amount = float(match.group(1).replace(",", ""))
    unit = match.group(2) or "원"
    if unit == "억원":
        amount_won = amount * 100_000_000
    elif unit == "만원":
        amount_won = amount * 10_000
    else:
        amount_won = amount
    if amount_won < 100_000_000:
        return "under_100m"
    if amount_won < 500_000_000:
        return "100m_to_500m"
    if amount_won < 1_000_000_000:
        return "500m_to_1b"
    return "over_1b"


def prior_notice_reference(notice: AgencyPriorNotice) -> AgencyNoticeBrief:
    return AgencyNoticeBrief(
        organization_id=notice.organization_id,
        title=notice.title,
        program_type=notice.program_type,
        budget=notice.budget,
        program_period=notice.program_period,
        program_purpose=notice.summary,
    )
