"""AI-assisted rewriting for a single agency notice section.

Grounding rule: the rewrite may only rephrase what is already in the
section — no new facts, figures, dates, or clauses. In mock mode the
content passes through a deterministic whitespace normalization so tests
can assert that nothing is invented.
"""

import logging
import re

from core.errors import AnalysisError
from models.schemas import AgencyNoticeDraft
from services.agency_noticeops import get_agency_notice_draft, update_agency_notice_section
from services.ai_provider import should_use_mock_ai, stream_text
from services.drafting_service import OFFICIAL_STYLE_RULES

logger = logging.getLogger(__name__)

_AI_REVISE_SYSTEM_PROMPT = (
    "당신은 한국 정부기관 공고문 편집 전문가입니다. "
    "주어진 섹션 본문을 요청에 맞게 다듬어 한국어 마크다운으로만 출력하세요. "
    "본문에 없는 사실, 수치, 날짜, 조항을 새로 만들지 마세요. 비어 있는 값은 그대로 '확인 필요'로 두세요. "
    "JSON, 코드블록, 설명 문구 없이 다듬어진 본문만 출력하세요."
    + OFFICIAL_STYLE_RULES
)

DEFAULT_INSTRUCTION = "개조식·행정문체로 간결하게 다듬어 주세요."


def _normalize_whitespace(content: str) -> str:
    normalized = "\n".join(line.rstrip() for line in content.strip().splitlines())
    return re.sub(r"\n{3,}", "\n\n", normalized)


def ai_revise_section(draft_id: str, section_id: str, instruction: str = "") -> AgencyNoticeDraft:
    instruction = instruction.strip() or DEFAULT_INSTRUCTION
    draft = get_agency_notice_draft(draft_id)
    section = next((item for item in draft.sections if item.id == section_id), None)
    if section is None:
        raise AnalysisError("다듬을 공고 섹션을 찾을 수 없습니다.")

    if should_use_mock_ai():
        new_content = _normalize_whitespace(section.content_markdown)
    else:
        user_prompt = (
            f"섹션 제목: {section.title}\n\n"
            f"현재 본문:\n{section.content_markdown}\n\n"
            f"다듬기 요청: {instruction}\n\n"
            "위 본문을 요청에 맞게 다듬어 본문만 출력하세요."
        )
        try:
            new_content = "".join(stream_text("draft", _AI_REVISE_SYSTEM_PROMPT, user_prompt)).strip()
        except Exception as exc:
            raise AnalysisError(f"AI 다듬기에 실패했습니다: {exc}") from exc
        if not new_content:
            raise AnalysisError("AI 다듬기 결과가 비어 있습니다. 다시 시도해 주세요.")

    return update_agency_notice_section(
        draft_id,
        section_id,
        new_content,
        change_summary=f"AI 다듬기: {instruction[:60]}",
        actor_id="ai-assistant",
    )
