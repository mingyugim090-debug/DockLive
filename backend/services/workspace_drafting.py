"""LLM paragraph synthesis for workspace documents (phase 2).

Mock/no-key mode returns the rule-based document unchanged, so offline tests
and keyless deployments behave exactly like v1. In real mode the LLM may only
rewrite existing paragraph blocks using facts already present in the payload
(analysis + uploaded file excerpts); headings, tables, charts and
needs-input placeholders are never touched. Any failure falls back to the
rule-based content — generation never fails because the LLM did.
"""

import json
import logging

from core.config import settings
from models.schemas import DocumentWorkspace, GeneratedDocument
from services.ai_provider import call_json, should_use_mock_ai
from services.drafting_service import OFFICIAL_STYLE_RULES

logger = logging.getLogger(__name__)

WORKSPACE_DRAFT_SYSTEM_PROMPT = (
    "당신은 한국 정부지원사업 제출 문서를 작성하는 전문가입니다. "
    "제공된 공고 분석 결과와 업로드 자료 발췌에 있는 사실만 사용해 각 문단을 개조식 공식 문체로 다시 작성하세요. "
    "없는 예산, 날짜, 수치, 자격 요건을 절대 만들지 마세요. "
    "근거가 부족한 문단은 기존 내용을 그대로 유지하세요.\n" + OFFICIAL_STYLE_RULES
)

WORKSPACE_DRAFT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "blocks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "block_id": {"type": "string"},
                    "markdown": {"type": "string"},
                },
                "required": ["block_id", "markdown"],
            },
        }
    },
    "required": ["blocks"],
}

REWRITE_SYSTEM_PROMPT = (
    "당신은 한국 공문서 편집자입니다. 주어진 문단을 개조식 공식 문체로 다듬으세요. "
    "본문에 없는 사실, 숫자, 날짜, 기관명을 새로 만들지 마세요. 의미를 바꾸지 마세요.\n"
    + OFFICIAL_STYLE_RULES
)

REWRITE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {"markdown": {"type": "string"}},
    "required": ["markdown"],
}


def _analysis_facts(workspace: DocumentWorkspace) -> dict:
    analysis = workspace.analysis
    if analysis is None:
        return {}
    return {
        "title": analysis.title,
        "organization": analysis.organization,
        "summary": analysis.summary,
        "eligibility": analysis.eligibility,
        "checklist": [item.label for item in analysis.checklist],
        "timeline": [{"label": item.label, "date": item.date} for item in analysis.timeline],
        "evaluation_criteria": analysis.evaluation_criteria,
        "cautions": analysis.cautions,
    }


def _file_excerpts(workspace: DocumentWorkspace, limit_per_file: int = 4000) -> list[dict]:
    excerpts = []
    for project_file in workspace.files:
        if project_file.text:
            excerpts.append({"filename": project_file.filename, "text": project_file.text[:limit_per_file]})
    return excerpts


def synthesize_paragraphs(workspace: DocumentWorkspace, document: GeneratedDocument) -> GeneratedDocument:
    """Rewrite paragraph blocks with the LLM, grounded to workspace facts only."""
    if should_use_mock_ai():
        return document

    targets = [
        block
        for block in document.blocks
        if block.kind == "paragraph" and block.status != "needs_input" and block.markdown.strip()
    ]
    if not targets:
        return document

    section_titles = {
        block.id: next(
            (b.markdown for b in document.blocks if b.kind == "heading" and b.section_id == block.section_id),
            "",
        )
        for block in targets
    }
    payload = {
        "document_title": document.title,
        "analysis": _analysis_facts(workspace),
        "file_excerpts": _file_excerpts(workspace),
        "paragraphs": [
            {"block_id": block.id, "section": section_titles.get(block.id, ""), "current_markdown": block.markdown}
            for block in targets
        ],
    }
    user_prompt = json.dumps(payload, ensure_ascii=False)[: settings.MAX_DRAFT_INPUT_LENGTH]

    try:
        result = call_json(
            "draft",
            WORKSPACE_DRAFT_SYSTEM_PROMPT,
            user_prompt,
            json_schema=WORKSPACE_DRAFT_SCHEMA,
            schema_name="workspace_paragraphs",
        )
    except Exception as e:
        logger.warning(f"Workspace paragraph synthesis failed; keeping rule-based content: {e}")
        return document

    rows = result.get("blocks") if isinstance(result, dict) else None
    revised = {
        str(row.get("block_id")): str(row.get("markdown") or "").strip()
        for row in (rows if isinstance(rows, list) else [])
        if isinstance(row, dict)
    }
    target_ids = {block.id for block in targets}
    for block in document.blocks:
        if block.id in target_ids and revised.get(block.id):
            block.markdown = revised[block.id]
    return document


def ai_rewrite_paragraph(markdown: str, instruction: str = "") -> str:
    """Rewrite one paragraph via the LLM. Falls back to the input on failure."""
    payload = {"paragraph": markdown}
    if instruction.strip():
        payload["instruction"] = instruction.strip()
    try:
        result = call_json(
            "draft",
            REWRITE_SYSTEM_PROMPT,
            json.dumps(payload, ensure_ascii=False),
            json_schema=REWRITE_SCHEMA,
            schema_name="workspace_rewrite",
        )
        rewritten = str(result.get("markdown") or "").strip() if isinstance(result, dict) else ""
        return rewritten or markdown
    except Exception as e:
        logger.warning(f"Workspace paragraph rewrite failed; keeping original: {e}")
        return markdown
