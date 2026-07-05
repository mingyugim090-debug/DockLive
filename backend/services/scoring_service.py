import json
import logging

from models.schemas import RubricCriterionScore, RubricScore, WorkflowSession, utc_now_iso
from services.ai_provider import call_json, should_use_mock_ai

logger = logging.getLogger(__name__)

SCORE_SYSTEM_PROMPT = (
    "당신은 한국 정부지원사업 평가기준 기반 자가진단 채점 AI입니다. "
    "제공된 평가기준(rubric)과 확정된 초안 섹션 내용만 근거로 채점하세요. "
    "외부 지식이나 일반적인 심사 관행으로 점수를 매기지 마세요. "
    "confirmation_required가 남아있는 주장은 점수에 반영하지 말고 weakness에 '확인 필요' 사유로 표시하세요. "
    "감점 사유는 초안의 구체적인 문장을 인용해 설명하고, 개선 제안은 해당 섹션에서 무엇을 추가/수정할지 구체적으로 제시하세요. "
    "반드시 유효한 JSON 객체만 반환하세요."
)

SCORE_RESPONSE_SCHEMA = {
    "title": "rubric_score",
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "per_criterion": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "score": {"type": "integer"},
                    "max": {"type": "integer"},
                    "weakness": {"type": "string"},
                    "suggestion": {"type": "string"},
                    "target_section_id": {"type": ["string", "null"]},
                },
                "required": ["name", "score", "max", "weakness", "suggestion", "target_section_id"],
            },
        }
    },
    "required": ["per_criterion"],
}


def _score_prompt(workflow: WorkflowSession) -> str:
    rubric = workflow.analysis.rubric
    payload = {
        "rubric": rubric.model_dump(mode="json"),
        "draft_sections": [
            {
                "section_id": draft.section_id,
                "title": draft.title,
                "content_markdown": draft.content_markdown,
                "confirmation_required": draft.confirmation_required,
            }
            for draft in workflow.draft_sections
        ],
    }
    return (
        "아래 평가기준(rubric)과 초안 섹션만 근거로 항목별 점수를 채점하세요. "
        "응답 형식은 {\"per_criterion\":[{\"name\":\"...\",\"score\":0,\"max\":0,"
        "\"weakness\":\"...\",\"suggestion\":\"...\",\"target_section_id\":\"...\"}]} 입니다.\n\n"
        + json.dumps(payload, ensure_ascii=False)
    )


def _mock_score(workflow: WorkflowSession) -> RubricScore:
    rubric = workflow.analysis.rubric
    per_criterion = [
        RubricCriterionScore(
            name=criterion.name,
            score=criterion.weight,
            max=criterion.weight,
            weakness="MOCK_MODE: 채점을 시뮬레이션했습니다.",
            suggestion="실제 AI provider 연결 후 재채점하세요.",
            target_section_id=None,
        )
        for criterion in rubric.criteria
    ]
    total = sum(item.score for item in per_criterion)
    return RubricScore(per_criterion=per_criterion, total=total, grounded_only=True, scored_at=utc_now_iso())


def score_workflow(workflow: WorkflowSession) -> WorkflowSession:
    """Score confirmed draft sections against the notice's rubric, if one exists.

    No-op (rubric stays unset) when the notice has no rubric per the
    eval-rubric skill's Phase 2 rule: Score is always optional and never
    invents a rubric to score against.
    """
    rubric = workflow.analysis.rubric
    if rubric is None or not rubric.criteria:
        return workflow

    if should_use_mock_ai():
        workflow.rubric_score = _mock_score(workflow)
        return workflow

    try:
        data = call_json(
            "match",
            SCORE_SYSTEM_PROMPT,
            _score_prompt(workflow),
            json_schema=SCORE_RESPONSE_SCHEMA,
            schema_name="rubric_score",
        )
    except Exception:
        logger.exception("Rubric scoring failed; leaving rubric_score unset")
        return workflow

    valid_names = {criterion.name for criterion in rubric.criteria}
    per_criterion: list[RubricCriterionScore] = []
    for item in data.get("per_criterion", []):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if name not in valid_names:
            continue
        try:
            score = int(item.get("score") or 0)
            max_score = int(item.get("max") or 0)
        except (TypeError, ValueError):
            continue
        per_criterion.append(
            RubricCriterionScore(
                name=name,
                score=max(0, min(score, max_score) if max_score else max(score, 0)),
                max=max_score,
                weakness=str(item.get("weakness") or "").strip(),
                suggestion=str(item.get("suggestion") or "").strip(),
                target_section_id=item.get("target_section_id") or None,
            )
        )

    if not per_criterion:
        return workflow

    total = sum(item.score for item in per_criterion)
    workflow.rubric_score = RubricScore(per_criterion=per_criterion, total=total, grounded_only=True, scored_at=utc_now_iso())
    return workflow
