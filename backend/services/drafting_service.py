import base64
import html
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile
from xml.sax.saxutils import escape as xml_escape

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
from services.ai_provider import call_json, provider_name, should_use_mock_ai, stream_text

logger = logging.getLogger(__name__)

SECTION_DRAFT_SYSTEM_PROMPT = """당신은 한국 공모전, 지원사업, 장학금, 연구과제 제출 문서를 작성하는 AI Agent입니다.
공고 분석 결과와 사용자 입력만 근거로 섹션별 초안을 작성하세요.
마감일, 자격, 금액, 기관명, 제출 방법처럼 중요한 사실을 새로 만들지 마세요.
검증이 필요한 주장은 초안에 단정하지 말고 확인 필요 항목으로 남겨야 합니다."""

DRAFT_RESPONSE_SCHEMA = {
    "title": "generated_draft_sections",
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "draft_sections": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "section_id": {"type": "string"},
                    "content_markdown": {"type": "string"},
                    "purpose": {"type": "string"},
                    "related_criteria": {"type": "array", "items": {"type": "string"}},
                    "source_evidence_ids": {"type": "array", "items": {"type": "string"}},
                    "revision_notes": {"type": "array", "items": {"type": "string"}},
                    "needs_confirmation": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "section_id",
                    "content_markdown",
                    "purpose",
                    "related_criteria",
                    "source_evidence_ids",
                    "revision_notes",
                    "needs_confirmation",
                ],
            },
        }
    },
    "required": ["draft_sections"],
}

HWPX_TEMPLATE_PLACEHOLDERS: dict[str, list[str]] = {
    "basic_application_v1": [
        "{title}",
        "{announcement_title}",
        "{organization}",
        "{applicant_name}",
        "{applicant_profile}",
        "{project_summary}",
        "{evidence}",
        "{content}",
        "{section_1_title}",
        "{section_1_content}",
    ],
    "business_plan_v1": [
        "{title}",
        "{applicant_name}",
        "{project_summary}",
        "{section_1_content}",
        "{section_2_content}",
        "{section_3_content}",
        "{section_4_content}",
    ],
}


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
            label="신청 주체 소개",
            required=True,
            description="전공, 역할, 경험, 강점, 업종, 성장 단계 등 초안에 반영할 정보를 적어 주세요.",
            placeholder="예: AI 문서 자동화 서비스를 만드는 초기 스타트업입니다.",
            value=_profile_to_text(company_profile) if company_profile else "",
        ),
        UserInputField(
            id="project_summary",
            label="아이디어 또는 프로젝트 요약",
            required=True,
            description="지원하려는 아이디어, 연구, 활동 또는 사업의 핵심 내용을 적어 주세요.",
            placeholder="무엇을 만들고, 어떤 문제를 해결하는지 적어 주세요.",
        ),
        UserInputField(
            id="evidence",
            label="근거 자료와 성과",
            required=False,
            description="수상, 실험, 인터뷰, 시장 조사, 포트폴리오처럼 근거가 될 내용을 적어 주세요.",
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
    for question in analysis.missing_questions[:6]:
        field_id = f"missing_{question.id}"
        if any(field.id == field_id for field in fields):
            continue
        fields.append(
            UserInputField(
                id=field_id,
                label=question.question,
                required=True,
                section_id=question.required_for if question.required_for.startswith("section-") else None,
                description=question.reason,
                placeholder="공고와 제출 초안에 반영할 사실만 입력해 주세요.",
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
    items.append("제출 전 공고 원문, 사용자 입력, 증빙자료와 초안의 핵심 주장이 일치하는지 확인하세요.")
    if not workflow.analysis.source_evidence:
        items.append("핵심 주장과 수치가 공고 원문 및 사용자 입력에 근거하는지 확인하세요.")
    return list(dict.fromkeys(item for item in items if item))


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
        f"{applicant}은(는) {workflow.analysis.title}의 목적과 요구사항에 맞추어 다음과 같이 {draft.title} 항목을 제안합니다.",
        "",
        f"핵심 제안은 {summary}입니다. 이 내용은 공고에서 요구하는 제출 서류, 평가 기준, 지원 취지에 맞추어 실행 가능성과 차별성을 중심으로 구성했습니다.",
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
    draft.purpose = f"{draft.title} 항목에서 공고 요구사항과 사용자 제공 사실을 연결합니다."
    draft.related_criteria = workflow.analysis.evaluation_criteria[:3]
    draft.source_evidence_ids = [item.field for item in workflow.analysis.source_evidence[:3]]
    draft.revision_notes = ["제출 전 사용자 경험, 수치, 증빙자료와 일치하는지 확인하세요."]
    draft.status = "drafted" if not draft.user_feedback else "revised"
    draft.needs_confirmation = confirmations
    draft.confirmation_required = confirmations
    draft.updated_at = utc_now_iso()
    return draft


def _call_draft_json(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
    return call_json(
        "draft",
        system_prompt,
        user_prompt,
        max_tokens=max_tokens,
        json_schema=DRAFT_RESPONSE_SCHEMA,
        schema_name="generated_draft_sections",
    )


def _draft_json_prompt(workflow: WorkflowSession) -> str:
    user_payload = {
        "analysis": workflow.analysis.model_dump(mode="json"),
        "match_report": workflow.match_report.model_dump(mode="json") if workflow.match_report else None,
        "company_profile": workflow.company_profile.model_dump(mode="json") if workflow.company_profile else None,
        "user_inputs": [field.model_dump(mode="json") for field in workflow.user_inputs],
        "sections": [draft.model_dump(mode="json") for draft in workflow.draft_sections],
    }
    return (
        "아래 정보를 바탕으로 모든 섹션 초안을 작성하세요. "
        "응답 형식은 {\"draft_sections\":[{\"section_id\":\"...\",\"content_markdown\":\"...\","
        "\"purpose\":\"...\",\"related_criteria\":[\"...\"],\"source_evidence_ids\":[\"...\"],"
        "\"revision_notes\":[\"...\"],\"needs_confirmation\":[\"...\"]}]} 입니다.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)[: settings.MAX_DRAFT_INPUT_LENGTH]
    )


def _single_section_prompt(workflow: WorkflowSession, draft: DraftSection) -> str:
    payload = {
        "analysis": workflow.analysis.model_dump(mode="json"),
        "match_report": workflow.match_report.model_dump(mode="json") if workflow.match_report else None,
        "company_profile": workflow.company_profile.model_dump(mode="json") if workflow.company_profile else None,
        "user_inputs": [field.model_dump(mode="json") for field in workflow.user_inputs],
        "target_section": draft.model_dump(mode="json"),
    }
    return (
        f"'{draft.title}' 섹션의 한국어 마크다운 초안만 작성하세요. "
        "JSON, 코드블록, 설명 문구 없이 본문만 출력하세요. "
        "검증이 필요한 사실은 본문 끝에 '확인 필요' 목록으로 표시하세요.\n\n"
        + json.dumps(payload, ensure_ascii=False)[: settings.MAX_DRAFT_INPUT_LENGTH]
    )


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

    if should_use_mock_ai():
        workflow.draft_sections = [_mock_draft_section(workflow, draft) for draft in workflow.draft_sections]
        workflow.status = "reviewing"
        workflow.updated_at = utc_now_iso()
        return workflow

    try:
        t0 = time.time()
        data = _call_draft_json(SECTION_DRAFT_SYSTEM_PROMPT + "\n반드시 JSON 객체만 반환하세요.", _draft_json_prompt(workflow))
        logger.info("%s draft response received (%.1fs)", provider_name(), time.time() - t0)
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
            draft.purpose = str(item.get("purpose", "")).strip()
            draft.related_criteria = [str(v).strip() for v in item.get("related_criteria", []) if str(v).strip()]
            draft.source_evidence_ids = [str(v).strip() for v in item.get("source_evidence_ids", []) if str(v).strip()]
            draft.revision_notes = [str(v).strip() for v in item.get("revision_notes", []) if str(v).strip()]
            draft.needs_confirmation = confirmations
            draft.confirmation_required = confirmations
            draft.status = "drafted"
            draft.updated_at = utc_now_iso()
        workflow.status = "reviewing"
        workflow.updated_at = utc_now_iso()
        return workflow
    except Exception as exc:
        raise AnalysisError(f"초안 생성 중 오류가 발생했습니다: {exc}") from exc


def stream_draft_events(workflow: WorkflowSession) -> Iterator[dict]:
    """Yield SSE-ready draft events, using real OpenAI token streaming when available."""
    missing = missing_required_inputs(workflow)
    if missing or should_use_mock_ai() or provider_name() != "openai":
        workflow = generate_drafts(workflow)
        for draft in workflow.draft_sections:
            yield {
                "type": "section_done",
                "workflow_id": workflow.id,
                "section_id": draft.section_id,
                "content": draft.content_markdown,
                "draft_section": draft.model_dump(mode="json"),
                "_workflow": workflow,
            }
        yield {"type": "workflow_done", "workflow_id": workflow.id, "content": "초안 생성이 완료되었습니다.", "_workflow": workflow}
        return

    workflow.status = "drafting"
    for draft in workflow.draft_sections:
        yield {"type": "section_start", "workflow_id": workflow.id, "section_id": draft.section_id, "content": draft.title, "_workflow": workflow}
        chunks: list[str] = []
        try:
            for chunk in stream_text("draft", SECTION_DRAFT_SYSTEM_PROMPT, _single_section_prompt(workflow, draft)):
                chunks.append(chunk)
                yield {"type": "delta", "workflow_id": workflow.id, "section_id": draft.section_id, "content": chunk, "_workflow": workflow}
        except Exception as exc:
            draft.status = "needs_input"
            draft.confirmation_required = [f"실시간 초안 생성 실패: {exc}"]
            draft.needs_confirmation = draft.confirmation_required
            yield {"type": "error", "workflow_id": workflow.id, "section_id": draft.section_id, "content": str(exc), "_workflow": workflow}
            continue

        draft.content_markdown = "".join(chunks).strip()
        draft.purpose = f"{draft.title} 항목의 제출용 초안"
        draft.related_criteria = workflow.analysis.evaluation_criteria[:3]
        draft.source_evidence_ids = [item.field for item in workflow.analysis.source_evidence[:3]]
        draft.revision_notes = ["스트리밍 초안은 섹션 본문 중심으로 생성되었으므로 제출 전 사실 관계를 확인하세요."]
        draft.status = "drafted"
        draft.confirmation_required = _confirmation_items(workflow)
        draft.needs_confirmation = draft.confirmation_required
        draft.updated_at = utc_now_iso()
        yield {
            "type": "section_done",
            "workflow_id": workflow.id,
            "section_id": draft.section_id,
            "content": draft.content_markdown,
            "draft_section": draft.model_dump(mode="json"),
            "_workflow": workflow,
        }

    workflow.status = "reviewing"
    workflow.updated_at = utc_now_iso()
    yield {"type": "workflow_done", "workflow_id": workflow.id, "content": "초안 생성이 완료되었습니다.", "_workflow": workflow}


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
                "## 지원 적합도",
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
        content = draft.content_markdown.strip()
        first_line = content.split("\n", 1)[0].strip()
        if not first_line.startswith("## "):
            lines.append(f"## {draft.title}")
            lines.append("")
        lines.append(content)
        lines.append("")

    workflow.final_document = FinalDocument(
        title=title,
        content_markdown="\n".join(lines).strip(),
        created_at=datetime.now(timezone.utc).isoformat(),
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


def _safe_title(title: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in title).strip("_") or "livedock_export"


def _hwpx_skill_dir() -> Path:
    configured = settings.HWPX_SKILL_DIR.strip()
    if configured:
        return Path(configured)
    bundled = Path(__file__).resolve().parents[1] / "hwpx_toolchain"
    if bundled.exists():
        return bundled
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home) / "skills" / "hwpx"
    return Path.home() / ".codex" / "skills" / "hwpx"


def _require_hwpx_scripts(*names: str) -> dict[str, Path]:
    skill_dir = _hwpx_skill_dir()
    scripts = {name: skill_dir / "scripts" / name for name in names}
    missing = [str(path) for path in scripts.values() if not path.exists()]
    if missing:
        raise AnalysisError(f"HWPX toolchain 파일을 찾을 수 없습니다: {', '.join(missing)}")
    return scripts


def get_hwpx_toolchain_status() -> dict[str, Any]:
    """Return deployment-safe HWPX toolchain readiness for UI and smoke checks."""
    skill_dir = _hwpx_skill_dir()
    script_names = [
        "md2hwpx.py",
        "fix_namespaces.py",
        "validate.py",
        "text_extract.py",
        "clone_form.py",
        "verify_hwpx.py",
        "convert_hwp.py",
    ]
    scripts_found = {name: (skill_dir / "scripts" / name).exists() for name in script_names}
    warnings: list[str] = []

    if not settings.HWPX_EXPORT_ENABLED:
        warnings.append("HWPX_EXPORT_ENABLED=false 상태입니다. HTML export와 placeholder map만 사용할 수 있습니다.")
    if not skill_dir.exists():
        warnings.append(f"HWPX toolchain 디렉터리를 찾을 수 없습니다: {skill_dir}")

    missing = [name for name, exists in scripts_found.items() if not exists]
    if missing:
        warnings.append(f"누락된 HWPX script: {', '.join(missing)}")

    validation_available = scripts_found.get("fix_namespaces.py", False) and scripts_found.get("validate.py", False)
    template_clone_available = validation_available and scripts_found.get("clone_form.py", False) and scripts_found.get("verify_hwpx.py", False)

    if settings.HWPX_EXPORT_ENABLED and not validation_available:
        warnings.append("namespace fix 또는 validate script가 없어 HWPX를 ready 상태로 제공할 수 없습니다.")
    if settings.HWPX_EXPORT_ENABLED and not template_clone_available:
        warnings.append("템플릿 클로닝 검증 script가 없어 공식 양식 채우기 export가 제한됩니다.")

    return {
        "enabled": bool(settings.HWPX_EXPORT_ENABLED),
        "skill_dir": str(skill_dir),
        "scripts_found": scripts_found,
        "validation_available": validation_available,
        "template_clone_available": template_clone_available,
        "warnings": list(dict.fromkeys(warnings)),
    }


def _hwpx_subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def _run_hwpx_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=_hwpx_subprocess_env(),
    )


def export_markdown_to_hwpx_with_validation(markdown: str, title: str) -> tuple[str, bytes, dict[str, Any]]:
    """Convert final markdown to HWPX through the optional hwpx-skill toolchain."""
    if not settings.HWPX_EXPORT_ENABLED:
        raise AnalysisError("HWPX export가 비활성화되어 있습니다. HTML export를 사용하거나 HWPX_EXPORT_ENABLED=true로 설정하세요.")

    scripts = _require_hwpx_scripts("md2hwpx.py", "fix_namespaces.py", "validate.py", "text_extract.py")
    safe_title = _safe_title(title)
    tmpdir = _make_tmp_dir()
    summary: dict[str, Any] = {
        "validation_passed": False,
        "namespace_fixed": False,
        "text_extract_available": scripts["text_extract.py"].exists(),
        "warnings": [],
    }
    try:
        markdown_path = tmpdir / "input.md"
        output_path = tmpdir / f"{safe_title}.hwpx"
        markdown_path.write_text(markdown, encoding="utf-8")

        python_bin = sys.executable or "python"
        base_template = scripts["md2hwpx.py"].parents[1] / "templates" / "base"
        if base_template.exists():
            try:
                _run_hwpx_command([python_bin, str(scripts["md2hwpx.py"]), str(markdown_path), "-o", str(output_path)])
                summary["generation_method"] = "md2hwpx.py"
            except subprocess.CalledProcessError as exc:
                logger.info("md2hwpx.py failed; using minimal internal HWPX fallback: %s", (exc.stderr or exc.stdout or exc)[:500])
                summary["generation_method"] = "internal_minimal_fallback"
                summary["warnings"].append("md2hwpx.py 실패로 내부 minimal HWPX fallback을 사용했습니다.")
                _build_minimal_hwpx(markdown, title, output_path)
        else:
            logger.info("HWPX base template is not bundled; using minimal internal HWPX fallback")
            summary["generation_method"] = "internal_minimal_fallback"
            summary["warnings"].append("base template이 없어 내부 minimal HWPX fallback을 사용했습니다.")
            _build_minimal_hwpx(markdown, title, output_path)
        fix_result = _run_hwpx_command([python_bin, str(scripts["fix_namespaces.py"]), str(output_path)])
        summary["namespace_fixed"] = True
        summary["namespace_output"] = (fix_result.stdout or fix_result.stderr or "").strip()[:1000]
        validate_result = _run_hwpx_command([python_bin, str(scripts["validate.py"]), str(output_path)])
        summary["validation_passed"] = True
        summary["validation_output"] = (validate_result.stdout or validate_result.stderr or "").strip()[:1000]
        try:
            text_result = _run_hwpx_command([python_bin, str(scripts["text_extract.py"]), str(output_path)])
            extracted_text = text_result.stdout or ""
            summary["text_extract_passed"] = True
            summary["text_chars"] = len(extracted_text)
            summary["title_found"] = title[:20] in extracted_text if title else False
            summary["extracted_text_excerpt"] = extracted_text[:500]
        except subprocess.CalledProcessError as exc:
            summary["text_extract_passed"] = False
            summary["text_chars"] = 0
            summary["title_found"] = False
            summary["warnings"].append(f"text_extract.py 실패: {(exc.stderr or exc.stdout or str(exc))[:500]}")
        return output_path.name, output_path.read_bytes(), summary
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def export_markdown_to_hwpx(markdown: str, title: str) -> tuple[str, bytes]:
    filename, content, _summary = export_markdown_to_hwpx_with_validation(markdown, title)
    return filename, content


def build_template_replacements(workflow: WorkflowSession, extra: dict[str, str] | None = None) -> dict[str, str]:
    """Build safe default replacements for uploaded HWPX application forms."""
    if not workflow.final_document:
        workflow = finalize_document(workflow)
    assert workflow.final_document is not None

    inputs = _input_map(workflow)
    replacements: dict[str, str] = {
        "{{title}}": workflow.final_document.title,
        "{{document_title}}": workflow.final_document.title,
        "{{content}}": workflow.final_document.content_markdown,
        "{{application_content}}": workflow.final_document.content_markdown,
        "{{applicant_name}}": inputs.get("applicant_name", ""),
        "{{applicant_profile}}": inputs.get("applicant_profile", ""),
        "{{project_summary}}": inputs.get("project_summary", ""),
        "{{evidence}}": inputs.get("evidence", ""),
        "{{organization}}": workflow.analysis.organization,
        "{{announcement_title}}": workflow.analysis.title,
        "{{created_date}}": datetime.now().strftime("%Y. %-m. %-d.") if os.name != "nt" else datetime.now().strftime("%Y. %#m. %#d."),
    }
    for draft in workflow.draft_sections:
        replacements[f"{{{{section:{draft.section_id}}}}}"] = draft.content_markdown
        replacements[f"{{{{section:{draft.title}}}}}"] = draft.content_markdown
        replacements[f"{{{{{draft.title}}}}}"] = draft.content_markdown
    if extra:
        replacements.update({str(key): str(value) for key, value in extra.items()})
    return {key: value for key, value in replacements.items() if key}


def create_hwpx_placeholder_map(
    workflow: WorkflowSession,
    template_id: str = "basic_application_v1",
) -> tuple[dict[str, str], list[str]]:
    """Create the MVP HWPX placeholder mapping without generating a file."""
    if not workflow.final_document:
        workflow = finalize_document(workflow)
    assert workflow.final_document is not None

    inputs = _input_map(workflow)
    warnings: list[str] = []
    section_order = {section.id: section.order for section in workflow.analysis.document_template}
    sorted_drafts = sorted(workflow.draft_sections, key=lambda item: section_order.get(item.section_id, 999))
    placeholder_map: dict[str, str] = {
        "{title}": workflow.final_document.title,
        "{announcement_title}": workflow.analysis.title,
        "{organization}": workflow.analysis.organization,
        "{source_name}": workflow.analysis.source_name or workflow.analysis.source_type,
        "{applicant_name}": inputs.get("applicant_name", ""),
        "{applicant_profile}": inputs.get("applicant_profile", ""),
        "{project_summary}": inputs.get("project_summary", ""),
        "{evidence}": inputs.get("evidence", ""),
        "{content}": workflow.final_document.content_markdown,
        "{created_date}": datetime.now().strftime("%Y.%m.%d"),
    }

    for index, draft in enumerate(sorted_drafts, start=1):
        placeholder_map[f"{{section_{index}_title}}"] = draft.title
        placeholder_map[f"{{section_{index}_content}}"] = draft.content_markdown
        placeholder_map[f"{{section_{draft.section_id}_content}}"] = draft.content_markdown

    for key, value in list(placeholder_map.items()):
        if not str(value).strip():
            warnings.append(f"{key} 값이 비어 있습니다. 템플릿 치환 전 사용자 입력을 확인하세요.")

    expected = HWPX_TEMPLATE_PLACEHOLDERS.get(template_id)
    if expected is None:
        warnings.append(f"알 수 없는 templateId입니다: {template_id}. 기본 placeholder map만 생성했습니다.")
    else:
        for key in expected:
            if key not in placeholder_map:
                warnings.append(f"{template_id} 템플릿 필드 {key}에 대응하는 값이 없습니다.")

    if not sorted_drafts:
        warnings.append("생성된 초안 섹션이 없어 section_* placeholder가 비어 있습니다.")
    return placeholder_map, list(dict.fromkeys(warnings))


def clone_hwpx_template_with_validation(
    template_content: bytes,
    workflow: WorkflowSession,
    replacements: dict[str, str] | None = None,
    keywords: dict[str, str] | None = None,
) -> tuple[str, bytes, dict[str, Any]]:
    """Clone an uploaded HWPX form and replace text while preserving tables/styles."""
    if not settings.HWPX_EXPORT_ENABLED:
        raise AnalysisError("HWPX 템플릿 클로닝이 비활성화되어 있습니다. HWPX_EXPORT_ENABLED=true로 설정하세요.")

    scripts = _require_hwpx_scripts("clone_form.py", "fix_namespaces.py", "validate.py", "verify_hwpx.py", "text_extract.py")
    if not template_content.startswith(b"PK"):
        raise AnalysisError("업로드한 파일이 HWPX ZIP 패키지 형식이 아닙니다.")

    if not workflow.final_document:
        workflow = finalize_document(workflow)
    assert workflow.final_document is not None

    safe_title = _safe_title(workflow.final_document.title)
    tmpdir = _make_tmp_dir()
    try:
        source_path = tmpdir / "template.hwpx"
        output_path = tmpdir / f"{safe_title}_filled.hwpx"
        map_path = tmpdir / "replacements.json"
        keyword_path = tmpdir / "keywords.json"
        verify_path = tmpdir / "verify.json"

        source_path.write_bytes(template_content)
        map_path.write_text(json.dumps(build_template_replacements(workflow, replacements), ensure_ascii=False, indent=2), encoding="utf-8")
        keyword_path.write_text(json.dumps(keywords or {}, ensure_ascii=False, indent=2), encoding="utf-8")

        python_bin = sys.executable or "python"
        command = [
            python_bin,
            str(scripts["clone_form.py"]),
            str(source_path),
            str(output_path),
            "--map",
            str(map_path),
            "--keywords",
            str(keyword_path),
            "--title",
            workflow.final_document.title,
            "--creator",
            "LiveDock Agent",
            "--validate",
        ]
        _run_hwpx_command(command)
        fix_result = _run_hwpx_command([python_bin, str(scripts["fix_namespaces.py"]), str(output_path)])
        validate_result = _run_hwpx_command([python_bin, str(scripts["validate.py"]), str(output_path)])
        verify_result = _run_hwpx_command(
            [
                python_bin,
                str(scripts["verify_hwpx.py"]),
                "--source",
                str(source_path),
                "--result",
                str(output_path),
                "--json",
                str(verify_path),
            ]
        )
        extracted_text = ""
        text_extract_passed = False
        text_extract_warning = ""
        try:
            text_result = _run_hwpx_command([python_bin, str(scripts["text_extract.py"]), str(output_path)])
            extracted_text = text_result.stdout or ""
            text_extract_passed = True
        except subprocess.CalledProcessError as exc:
            text_extract_warning = (exc.stderr or exc.stdout or str(exc))[:500]
        verify_report: dict[str, Any] = {}
        if verify_path.exists():
            try:
                verify_report = json.loads(verify_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                verify_report = {"parse_error": "verify_hwpx.py JSON report를 읽지 못했습니다."}
        summary = {
            "generation_method": "clone_form.py",
            "namespace_fixed": True,
            "namespace_output": (fix_result.stdout or fix_result.stderr or "").strip()[:1000],
            "validation_passed": True,
            "validation_output": (validate_result.stdout or validate_result.stderr or "").strip()[:1000],
            "verify_output": (verify_result.stdout or verify_result.stderr or "").strip()[:1000],
            "verify_report": verify_report,
            "text_extract_passed": text_extract_passed,
            "text_chars": len(extracted_text),
            "title_found": workflow.final_document.title[:20] in extracted_text if workflow.final_document else False,
            "extracted_text_excerpt": extracted_text[:500],
            "warnings": [f"text_extract.py 실패: {text_extract_warning}"] if text_extract_warning else [],
        }
        return output_path.name, output_path.read_bytes(), summary
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def clone_hwpx_template(
    template_content: bytes,
    workflow: WorkflowSession,
    replacements: dict[str, str] | None = None,
    keywords: dict[str, str] | None = None,
) -> tuple[str, bytes]:
    filename, content, _summary = clone_hwpx_template_with_validation(template_content, workflow, replacements, keywords)
    return filename, content


def hwpx_bytes_to_base64(content: bytes) -> str:
    return base64.b64encode(content).decode("ascii")


def _build_minimal_hwpx(markdown: str, title: str, output_path: Path) -> None:
    """Build a structurally valid editable HWPX package when python-hwpx templates are unavailable."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    plain_lines = [_markdown_line_to_text(line) for line in markdown.splitlines()]
    paragraphs = []
    for i, line in enumerate(plain_lines):
        text = xml_escape(line or " ")
        paragraphs.append(
            f'''  <hp:p id="{1000 + i}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t>{text}</hp:t></hp:run>
  </hp:p>'''
        )
    if not paragraphs:
        paragraphs.append(
            '''  <hp:p id="1000" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0"><hp:t> </hp:t></hp:run>
  </hp:p>'''
        )

    section_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
{chr(10).join(paragraphs)}
</hs:sec>'''
    header_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"
         xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList/>
</hh:head>'''
    content_hpf = f'''<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:dc="http://purl.org/dc/elements/1.1/" unique-identifier="uid">
  <opf:metadata>
    <dc:title>{xml_escape(title)}</dc:title>
    <opf:meta name="creator">LiveDock Agent</opf:meta>
    <opf:meta name="CreatedDate">{now}</opf:meta>
    <opf:meta name="ModifiedDate">{now}</opf:meta>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="text/xml"/>
    <opf:item id="section0" href="section0.xml" media-type="text/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>'''

    with ZipFile(output_path, "w", ZIP_DEFLATED) as zf:
        zf.writestr("mimetype", "application/hwp+zip", compress_type=ZIP_STORED)
        zf.writestr("Contents/content.hpf", content_hpf, compress_type=ZIP_DEFLATED)
        zf.writestr("Contents/header.xml", header_xml, compress_type=ZIP_DEFLATED)
        zf.writestr("Contents/section0.xml", section_xml, compress_type=ZIP_DEFLATED)


def _markdown_line_to_text(line: str) -> str:
    value = line.strip()
    value = re.sub(r"^#{1,6}\s+", "", value)
    value = re.sub(r"^\s*[-*]\s+", "- ", value)
    value = re.sub(r"\*\*(.+?)\*\*", r"\1", value)
    value = re.sub(r"`(.+?)`", r"\1", value)
    return value


def _workspace_tmp_root() -> Path:
    root = Path(__file__).resolve().parents[1] / ".tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _make_tmp_dir() -> Path:
    path = _workspace_tmp_root() / f"livedock_{uuid.uuid4().hex}"
    path.mkdir(parents=False, exist_ok=False)
    return path
