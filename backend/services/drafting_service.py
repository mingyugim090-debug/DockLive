import json
import logging
import time
from datetime import datetime

from core.config import settings
from core.errors import AnalysisError
from models.schemas import (
    AnalysisResult,
    DraftSection,
    FinalDocument,
    UserInputField,
    WorkflowSession,
    utc_now_iso,
)

logger = logging.getLogger(__name__)


def create_input_fields(analysis: AnalysisResult) -> list[UserInputField]:
    fields: list[UserInputField] = [
        UserInputField(
            id="applicant_name",
            label="신청자 또는 팀명",
            required=True,
            description="공고에 제출할 대표 신청자명 또는 팀명을 입력하세요.",
            placeholder="예: 라이브독 팀",
        ),
        UserInputField(
            id="applicant_profile",
            label="신청자/팀 소개",
            required=True,
            description="전공, 역할, 경험, 강점 등 초안에 반영할 소개 정보를 적어 주세요.",
            placeholder="예: 컴퓨터공학 전공 대학생 3명으로 구성된 팀입니다...",
        ),
        UserInputField(
            id="project_summary",
            label="아이디어 또는 프로젝트 요약",
            required=True,
            description="지원하려는 아이디어, 연구, 활동 또는 사업의 핵심 내용을 적어 주세요.",
            placeholder="무엇을 만들고, 누구의 어떤 문제를 해결하는지 적어 주세요.",
        ),
        UserInputField(
            id="evidence",
            label="근거 자료와 성과",
            required=False,
            description="수상, 실험, 인터뷰, 시장 조사, 포트폴리오 등 근거로 쓸 내용을 적어 주세요.",
            placeholder="예: 사용자 인터뷰 12건, MVP 테스트 결과...",
        ),
    ]

    for section in sorted(analysis.document_template, key=lambda item: item.order):
        fields.append(
            UserInputField(
                id=f"section_input_{section.id}",
                label=f"{section.title}에 반영할 내용",
                required=False,
                section_id=section.id,
                description=section.hint,
                placeholder=f"{section.title} 초안에 꼭 들어가야 할 내용을 적어 주세요.",
            )
        )
    return fields


def create_workflow_session(analysis: AnalysisResult) -> WorkflowSession:
    now = utc_now_iso()
    return WorkflowSession(
        id=analysis.id,
        analysis=analysis,
        status="collecting_inputs",
        user_inputs=create_input_fields(analysis),
        draft_sections=[
            DraftSection(
                id=f"draft-{section.id}",
                section_id=section.id,
                title=section.title,
                status="empty",
            )
            for section in sorted(analysis.document_template, key=lambda item: item.order)
        ],
        created_at=now,
        updated_at=now,
    )


def update_inputs(workflow: WorkflowSession, updates: dict[str, str]) -> WorkflowSession:
    for field in workflow.user_inputs:
        if field.id in updates:
            field.value = updates[field.id].strip()
    workflow.updated_at = utc_now_iso()
    return workflow


def missing_required_inputs(workflow: WorkflowSession) -> list[str]:
    return [field.label for field in workflow.user_inputs if field.required and not field.value.strip()]


def _input_map(workflow: WorkflowSession) -> dict[str, str]:
    return {field.id: field.value for field in workflow.user_inputs if field.value.strip()}


def _mock_draft_section(workflow: WorkflowSession, draft: DraftSection) -> DraftSection:
    inputs = _input_map(workflow)
    applicant = inputs.get("applicant_name", "신청자")
    summary = inputs.get("project_summary", "사용자가 입력한 아이디어")
    section_specific = inputs.get(f"section_input_{draft.section_id}", "")

    body = [
        f"## {draft.title}",
        "",
        f"{applicant}은(는) 「{workflow.analysis.title}」의 취지에 맞춰 다음과 같은 방향으로 {draft.title} 항목을 제안합니다.",
        "",
        f"핵심 아이디어는 {summary}입니다. 공고문에서 요구하는 자격, 제출 서류, 평가 기준을 기준으로 실행 가능성과 차별성을 분명히 드러내겠습니다.",
    ]
    if section_specific:
        body.extend(["", f"사용자가 제공한 추가 정보: {section_specific}"])
    if workflow.analysis.evaluation_criteria:
        body.extend(["", "평가 기준 반영:", *[f"- {item}" for item in workflow.analysis.evaluation_criteria[:3]]])

    draft.content_markdown = "\n".join(body)
    draft.status = "drafted" if not draft.user_feedback else "revised"
    draft.needs_confirmation = workflow.analysis.uncertain_fields[:]
    draft.updated_at = utc_now_iso()
    return draft


def _call_openai_json(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    completion = client.chat.completions.create(
        model=settings.OPENAI_DRAFT_MODEL,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return json.loads(completion.choices[0].message.content or "{}")


def generate_drafts(workflow: WorkflowSession) -> WorkflowSession:
    missing = missing_required_inputs(workflow)
    workflow.status = "collecting_inputs" if missing else "drafting"

    if missing:
        for draft in workflow.draft_sections:
            draft.status = "needs_input"
            draft.needs_confirmation = [f"필수 입력 필요: {', '.join(missing)}"]
        workflow.updated_at = utc_now_iso()
        return workflow

    use_mock = (
        settings.MOCK_MODE
        or not settings.OPENAI_API_KEY
        or settings.OPENAI_API_KEY == "your_api_key_here"
        or settings.OPENAI_API_KEY.startswith("mock")
    )

    if use_mock:
        workflow.draft_sections = [_mock_draft_section(workflow, draft) for draft in workflow.draft_sections]
        workflow.status = "reviewing"
        workflow.updated_at = utc_now_iso()
        return workflow

    system_prompt = """당신은 한국 공모전/지원사업 제출 문서를 작성하는 AI Agent입니다.
공고 분석 결과와 사용자 입력만 근거로 섹션별 초안을 작성하세요.
마감일, 자격, 금액, 제출 방식 등 핵심 사실은 절대 추측하지 마세요.
반드시 JSON 객체만 반환하세요."""
    user_payload = {
        "analysis": workflow.analysis.model_dump(mode="json"),
        "user_inputs": [field.model_dump(mode="json") for field in workflow.user_inputs],
        "sections": [draft.model_dump(mode="json") for draft in workflow.draft_sections],
    }
    user_prompt = (
        "아래 정보를 바탕으로 모든 섹션 초안을 작성하세요. "
        "응답 형식은 {\"draft_sections\":[{\"section_id\":\"...\",\"content_markdown\":\"...\","
        "\"needs_confirmation\":[\"...\"]}]} 입니다.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)[: settings.MAX_DRAFT_INPUT_LENGTH]
    )

    try:
        t0 = time.time()
        data = _call_openai_json(system_prompt, user_prompt)
        logger.info(f"Draft response received ({time.time() - t0:.1f}s)")
        by_section = {item.get("section_id"): item for item in data.get("draft_sections", [])}
        for draft in workflow.draft_sections:
            item = by_section.get(draft.section_id)
            if not item:
                draft.status = "needs_input"
                draft.needs_confirmation = ["이 섹션 초안을 생성하지 못했습니다. 다시 시도해 주세요."]
                continue
            draft.content_markdown = str(item.get("content_markdown", "")).strip()
            draft.needs_confirmation = [str(v) for v in item.get("needs_confirmation", []) if str(v).strip()]
            draft.status = "drafted"
            draft.updated_at = utc_now_iso()
        workflow.status = "reviewing"
        workflow.updated_at = utc_now_iso()
        return workflow
    except Exception as e:
        raise AnalysisError(f"초안 생성 중 오류가 발생했습니다: {e}")


def revise_section(workflow: WorkflowSession, section_id: str) -> WorkflowSession:
    for draft in workflow.draft_sections:
        if draft.section_id == section_id:
            draft.content_markdown = (
                draft.content_markdown
                + "\n\n"
                + f"### 사용자 피드백 반영\n{draft.user_feedback or '추가 피드백이 없습니다.'}"
            ).strip()
            draft.status = "revised"
            draft.updated_at = utc_now_iso()
            break
    workflow.status = "reviewing"
    workflow.updated_at = utc_now_iso()
    return workflow


def confirm_workflow(workflow: WorkflowSession) -> WorkflowSession:
    now = utc_now_iso()
    workflow.status = "confirmed"
    workflow.confirmed_at = now
    workflow.updated_at = now
    for draft in workflow.draft_sections:
        if draft.content_markdown:
            draft.status = "confirmed"
    return workflow


def finalize_document(workflow: WorkflowSession) -> WorkflowSession:
    sections = [draft for draft in workflow.draft_sections if draft.content_markdown.strip()]
    if not sections:
        workflow = generate_drafts(workflow)
        sections = [draft for draft in workflow.draft_sections if draft.content_markdown.strip()]

    title = f"{workflow.analysis.title} 제출 초안"
    lines = [
        f"# {title}",
        "",
        f"- 주관 기관: {workflow.analysis.organization}",
        f"- 문서 유형: {workflow.analysis.doc_type}",
        "",
    ]
    if workflow.analysis.submission_method:
        lines.append(f"- 제출 방법: {workflow.analysis.submission_method}")
        lines.append("")
    if workflow.analysis.uncertain_fields:
        lines.extend(["## 확인 필요", "", *[f"- {item}" for item in workflow.analysis.uncertain_fields], ""])
    for draft in sections:
        lines.append(draft.content_markdown.strip())
        lines.append("")

    workflow.final_document = FinalDocument(
        title=title,
        content_markdown="\n".join(lines).strip(),
        created_at=datetime.utcnow().isoformat() + "Z",
    )
    workflow.status = "finalized"
    workflow.updated_at = utc_now_iso()
    return workflow
