import base64
import html
import json
import logging
import re
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path

from core.config import settings
from core.errors import AnalysisError
from models.schemas import (
    AnalysisResult,
    CompanyProfile,
    DraftSection,
    FinalDocument,
    MatchReport,
    UserInputField,
    WorkflowSession,
    utc_now_iso,
)

logger = logging.getLogger(__name__)


def create_input_fields(analysis: AnalysisResult, company_profile: CompanyProfile | None = None) -> list[UserInputField]:
    fields: list[UserInputField] = [
        UserInputField(
            id="applicant_name",
            label="신청자 또는 팀/회사명",
            required=True,
            description="공고에 제출할 신청자명, 팀명 또는 회사명을 입력하세요.",
            placeholder="예: 라이브독 팀",
            value=company_profile.name if company_profile else "",
        ),
        UserInputField(
            id="applicant_profile",
            label="신청자/팀 소개",
            required=True,
            description="전공, 역할, 경험, 강점, 업종, 성장 단계 등 초안에 반영할 정보를 적어 주세요.",
            placeholder="예: AI 문서 자동화 서비스를 만드는 초기 팀입니다.",
            value=_profile_to_text(company_profile) if company_profile else "",
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
            placeholder="예: 사용자 인터뷰 12건, MVP 테스트 결과, 이전 수상 이력...",
            value=company_profile.strengths if company_profile else "",
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


def create_workflow_session(
    analysis: AnalysisResult,
    company_profile: CompanyProfile | None = None,
    match_report: MatchReport | None = None,
) -> WorkflowSession:
    now = utc_now_iso()
    return WorkflowSession(
        id=analysis.id,
        analysis=analysis,
        company_profile=company_profile,
        match_report=match_report,
        status="collecting_inputs",
        user_inputs=create_input_fields(analysis, company_profile),
        draft_sections=[
            DraftSection(id=f"draft-{section.id}", section_id=section.id, title=section.title, status="empty")
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


def _profile_to_text(profile: CompanyProfile | None) -> str:
    if not profile:
        return ""
    parts = [
        f"이름: {profile.name}",
        f"업종: {profile.industry}",
        f"단계: {profile.stage}",
        f"지역: {profile.region}",
        f"팀 규모: {profile.team_size}명" if profile.team_size else "",
        f"강점: {profile.strengths}",
        f"필요 지원: {profile.needs}",
        f"이전 지원사업: {profile.previous_support}",
    ]
    return "\n".join(part for part in parts if part and not part.endswith(": "))


def _confirmation_items(workflow: WorkflowSession) -> list[str]:
    items = list(workflow.analysis.uncertain_fields)
    if workflow.analysis.source_evidence:
        return items
    items.append("핵심 주장과 수치가 공고 원문 및 사용자 입력에 근거하는지 확인하세요.")
    return items


def _mock_draft_section(workflow: WorkflowSession, draft: DraftSection) -> DraftSection:
    inputs = _input_map(workflow)
    applicant = inputs.get("applicant_name", "신청자")
    profile = inputs.get("applicant_profile", "")
    summary = inputs.get("project_summary", "사용자가 입력한 프로젝트")
    evidence = inputs.get("evidence", "")
    section_specific = inputs.get(f"section_input_{draft.section_id}", "")

    body = [
        f"## {draft.title}",
        "",
        f"{applicant}은(는) {workflow.analysis.title}의 목적과 요구사항에 맞춰 다음과 같이 {draft.title} 항목을 제안합니다.",
        "",
        f"핵심 제안은 {summary}입니다. 이 내용은 공고에서 요구하는 제출 서류, 평가 기준, 지원 취지에 맞춰 실행 가능성과 차별성을 중심으로 구성했습니다.",
    ]
    if profile:
        body.extend(["", f"신청 주체 소개: {profile}"])
    if evidence:
        body.extend(["", f"근거 및 성과: {evidence}"])
    if section_specific:
        body.extend(["", f"섹션별 추가 반영 사항: {section_specific}"])
    if workflow.analysis.evaluation_criteria:
        body.extend(["", "평가 기준 반영:", *[f"- {item}" for item in workflow.analysis.evaluation_criteria[:3]]])

    confirmations = _confirmation_items(workflow)
    draft.content_markdown = "\n".join(body)
    draft.status = "drafted" if not draft.user_feedback else "revised"
    draft.needs_confirmation = confirmations
    draft.confirmation_required = confirmations
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
            draft.confirmation_required = draft.needs_confirmation
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
마감일, 자격, 금액, 제출 방법 같은 핵심 사실은 새로 만들지 마세요.
불확실하거나 검증이 필요한 주장은 needs_confirmation에 넣으세요.
반드시 JSON 객체만 반환하세요."""
    user_payload = {
        "analysis": workflow.analysis.model_dump(mode="json"),
        "match_report": workflow.match_report.model_dump(mode="json") if workflow.match_report else None,
        "company_profile": workflow.company_profile.model_dump(mode="json") if workflow.company_profile else None,
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
                draft.confirmation_required = draft.needs_confirmation
                continue
            confirmations = [str(v) for v in item.get("needs_confirmation", []) if str(v).strip()]
            draft.content_markdown = str(item.get("content_markdown", "")).strip()
            draft.needs_confirmation = confirmations
            draft.confirmation_required = confirmations
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
        f"- 출처: {workflow.analysis.source_name or workflow.analysis.source_type}",
        "",
    ]
    if workflow.analysis.summary:
        lines.extend(["## AI 요약", "", workflow.analysis.summary, ""])
    if workflow.match_report:
        lines.extend(
            [
                "## 지원 적합성",
                "",
                f"- 점수: {workflow.match_report.score}/100",
                f"- 판정: {workflow.match_report.verdict}",
                "",
            ]
        )
    if workflow.analysis.submission_method:
        lines.extend([f"- 제출 방법: {workflow.analysis.submission_method}", ""])
    confirmations = sorted({item for draft in sections for item in draft.confirmation_required} | set(workflow.analysis.uncertain_fields))
    if confirmations:
        lines.extend(["## 제출 전 확인 필요", "", *[f"- {item}" for item in confirmations], ""])
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


def markdown_to_hwp_compatible_html(markdown: str, title: str) -> str:
    """Create a Hangul Word Processor friendly HTML document."""
    body_lines: list[str] = []
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            body_lines.append("<p>&nbsp;</p>")
            continue
        if line.startswith("# "):
            body_lines.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.startswith("## "):
            body_lines.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("### "):
            body_lines.append(f"<h3>{html.escape(line[4:])}</h3>")
        elif line.startswith("- "):
            body_lines.append(f"<p class=\"bullet\">- {html.escape(line[2:])}</p>")
        else:
            escaped = html.escape(line)
            escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
            body_lines.append(f"<p>{escaped}</p>")

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>{html.escape(title)}</title>
  <style>
    body {{ font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; line-height: 1.65; color: #111; }}
    h1 {{ font-size: 22pt; margin: 0 0 18pt; }}
    h2 {{ font-size: 16pt; margin: 18pt 0 8pt; border-bottom: 1px solid #ddd; padding-bottom: 4pt; }}
    h3 {{ font-size: 13pt; margin: 12pt 0 6pt; }}
    p {{ font-size: 10.5pt; margin: 0 0 6pt; }}
    .bullet {{ margin-left: 12pt; }}
  </style>
</head>
<body>
{chr(10).join(body_lines)}
</body>
</html>"""


def export_markdown_to_hwpx(markdown: str, title: str) -> tuple[str, bytes]:
    """Convert final markdown to HWPX through the optional hwpx-skill toolchain.

    The preferred path follows jkf87/hwpx-skill: content -> HWPX, namespace fix,
    validation. The integration is disabled unless HWPX_EXPORT_ENABLED=true and
    HWPX_SKILL_DIR points to a local checkout/installed skill directory.
    """
    if not settings.HWPX_EXPORT_ENABLED:
        raise AnalysisError("HWPX export is not enabled. Set HWPX_EXPORT_ENABLED=true after installing the HWPX toolchain.")

    skill_dir = Path(settings.HWPX_SKILL_DIR)
    md2hwpx = skill_dir / "scripts" / "md2hwpx.py"
    fix_namespaces = skill_dir / "scripts" / "fix_namespaces.py"
    validate = skill_dir / "scripts" / "validate.py"
    missing = [str(path) for path in (md2hwpx, fix_namespaces, validate) if not path.exists()]
    if missing:
        raise AnalysisError(f"HWPX toolchain files were not found: {', '.join(missing)}")

    safe_title = "".join(ch if ch.isalnum() else "_" for ch in title).strip("_") or "livedock_export"
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        markdown_path = tmpdir / "input.md"
        output_path = tmpdir / f"{safe_title}.hwpx"
        markdown_path.write_text(markdown, encoding="utf-8")

        subprocess.run(
            ["python", str(md2hwpx), str(markdown_path), "-o", str(output_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        subprocess.run(["python", str(fix_namespaces), str(output_path)], check=True, capture_output=True, text=True)
        subprocess.run(["python", str(validate), str(output_path)], check=True, capture_output=True, text=True)
        return output_path.name, output_path.read_bytes()


def hwpx_bytes_to_base64(content: bytes) -> str:
    return base64.b64encode(content).decode("ascii")
