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

SECTION_DRAFT_SYSTEM_PROMPT = """You are Dock Live's grant-document drafting agent.
Use only the analyzed notice, source evidence, and user-provided inputs.
Do not invent deadlines, eligibility, benefits, documents, amounts, or claims.
Do not append "confirmation needed" checklists to the draft body.
The `needs_confirmation` field is retained for backward compatibility only; always return it as an empty array.
If a required fact is absent, write neutral wording based on the available source instead of guessing."""

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
                required=False,
                section_id=question.required_for if question.required_for.startswith("section-") else None,
                description=question.reason,
                placeholder="공고와 제출 초안에 반영할 사실만 입력해 주세요.",
            )
        )
    return fields


def _fallback_draft_titles(analysis: AnalysisResult) -> list[str]:
    """Create conservative drafting containers when a notice has no official form outline."""
    if analysis.doc_type == "government_rnd":
        return [
            "사업개요",
            "기술개발 목표",
            "추진일정",
            "사업화 및 활용계획",
            "예산/지원금 계획",
            "제출 체크리스트",
        ]

    titles = ["신청 개요", "프로젝트/아이디어 요약", "수행 역량 및 근거"]
    if analysis.evaluation_criteria:
        titles.append("평가 기준 대응")
    if analysis.checklist:
        titles.append("제출 서류 체크리스트")
    return titles


def _draft_sections_for_analysis(analysis: AnalysisResult) -> list[DraftSection]:
    template_sections = sorted(analysis.document_template, key=lambda item: item.order)
    if template_sections:
        return [
            DraftSection(id=f"draft-{section.id}", section_id=section.id, title=section.title, status="empty")
            for section in template_sections
        ]

    return [
        DraftSection(
            id=f"draft-fallback-{index}",
            section_id=f"fallback-{index}",
            title=title,
            purpose="공고에 공식 작성 항목이 없을 때 사용자 입력과 공고 근거를 담는 임시 작성 섹션입니다.",
            revision_notes=["공고 원문에서 공식 양식 항목이 확인되지 않아 임시 섹션으로 작성합니다."],
            status="empty",
        )
        for index, title in enumerate(_fallback_draft_titles(analysis), start=1)
    ]


def _ensure_draft_sections(workflow: WorkflowSession) -> None:
    if workflow.draft_sections:
        return
    workflow.draft_sections = _draft_sections_for_analysis(workflow.analysis)


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
        draft_sections=_draft_sections_for_analysis(analysis),
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
    items: list[str] = []
    for value in workflow.analysis.uncertain_fields:
        cleaned = str(value).strip()
        if cleaned and cleaned not in items:
            items.append(cleaned)
    return items[:8]


def _markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    safe_headers = [str(header).replace("|", "/").strip() or "-" for header in headers]
    lines = [
        "| " + " | ".join(safe_headers) + " |",
        "| " + " | ".join("---" for _ in safe_headers) + " |",
    ]
    for row in rows:
        padded = [*row, *[""] * max(0, len(safe_headers) - len(row))]
        cells = [str(cell).replace("|", "/").replace("\n", " ").strip() or "-" for cell in padded[: len(safe_headers)]]
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _join_or_unspecified(values: list[str], limit: int = 4) -> str:
    cleaned = [str(value).strip() for value in values if str(value).strip()]
    return ", ".join(cleaned[:limit]) if cleaned else "확인 필요"


def _government_rnd_section_confirmation_items(workflow: WorkflowSession, title: str) -> list[str]:
    uncertain = []
    for value in workflow.analysis.uncertain_fields:
        cleaned = str(value).strip()
        if cleaned and cleaned not in uncertain:
            uncertain.append(cleaned)

    def select(*terms: str) -> list[str]:
        normalized_terms = [re.sub(r"\s+", "", term) for term in terms]
        selected = []
        for item in uncertain:
            normalized_item = re.sub(r"\s+", "", item)
            if any(term in normalized_item for term in normalized_terms) and item not in selected:
                selected.append(item)
        return selected

    if "기술개발" in title or "목표" in title:
        selected = select("과제명", "기술개요", "개발목표", "성과지표")
    elif "예산" in title or "지원금" in title:
        selected = select("사업비", "사용계획", "지원금", "지원한도", "지원비율")
    elif "추진" in title or "일정" in title:
        selected = select("세부사업", "마감", "일정", "접수")
    elif "체크리스트" in title or "제출" in title:
        selected = select("제출", "마감", "서류", "세부사업")
    elif "사업화" in title or "활용" in title:
        selected = select("사업화", "기술개요", "보유역량", "과제명")
    elif "기대효과" in title:
        selected = select("성과", "사업화", "보유역량", "평가기준")
    else:
        selected = select("세부사업", "지원", "마감", "제출")

    return selected or uncertain[:1]


def _mock_government_rnd_draft_section(workflow: WorkflowSession, draft: DraftSection) -> DraftSection:
    if _government_rnd_is_researcher_applicant(workflow.analysis):
        return _mock_government_rnd_researcher_draft_section(workflow, draft)

    inputs = _input_map(workflow)
    applicant = inputs.get("applicant_name", "확인 필요")
    profile = inputs.get("applicant_profile", "확인 필요")
    project_summary = inputs.get("project_summary", "확인 필요")
    section_specific = inputs.get(f"section_input_{draft.section_id}", "")
    technical_summary = inputs.get("technical_summary", project_summary)
    development_goal = inputs.get("development_goal", section_specific)
    commercialization_plan = inputs.get("commercialization_plan", "사용자 입력과 근거자료를 기준으로 목표 시장을 구체화")
    budget_plan = inputs.get("budget_plan", "인건비, 재료비, 시험인증비 등 세부 배분 입력 필요")
    evidence = inputs.get("evidence", "확인 필요")
    title = draft.title
    support_terms = _join_or_unspecified(workflow.analysis.benefits, 6)
    criteria_terms = _join_or_unspecified(workflow.analysis.evaluation_criteria, 6)
    checklist_rows = [
        [item.label, item.category, item.description or "공고 기준 확인", item.file_format or "세부사업 공고 확인"]
        for item in workflow.analysis.checklist[:8]
    ] or [["연구개발계획서", "required", "세부사업 공고 양식 확인", "HWPX/PDF"]]
    schedule_rows = [
        [item.label, item.date, "마감일" if item.is_deadline else "일정"]
        for item in workflow.analysis.timeline[:6]
    ] or [["통합공고 추진일정", "월 단위 일정은 source evidence 기준으로만 기재", "세부사업 공고 확인 필요"]]
    support_program_rows = [
        [
            program.parent_program or "확인 필요",
            program.sub_program or "확인 필요",
            program.support_scale or "확인 필요",
            program.development_period or "확인 필요",
            program.support_limit or "확인 필요",
            program.support_ratio or "확인 필요",
            program.schedule or "세부사업 공고 확인 필요",
        ]
        for program in workflow.analysis.support_programs[:10]
    ]
    support_program_table = _markdown_table(
        ["상위사업", "내역사업", "지원규모", "개발기간", "지원한도", "지원비율", "추진일정"],
        support_program_rows
        or [["확인 필요", "확인 필요", "확인 필요", "확인 필요", support_terms, "확인 필요", "세부사업 공고 확인 필요"]],
    )

    if "사업개요" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["공고명", workflow.analysis.title],
                    ["주관기관", workflow.analysis.organization],
                    ["신청기업", applicant],
                    ["과제명", project_summary],
                    ["사업목적", workflow.analysis.summary or "공고 원문 기준 확인"],
                    ["지원조건 근거", support_terms],
                ],
            ),
            "",
            "### 지원사업 현황표",
            "",
            support_program_table,
        ]
    elif "기술개발" in title or "목표" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["구분", "작성 초안", "확인 필요"],
                [
                    ["과제명", project_summary, "IRIS 제출 과제명 확정"],
                    ["기술개요", technical_summary, "핵심 기술, 차별성, 적용 제품"],
                    ["개발목표", development_goal or "정량 목표와 성과지표를 사용자 입력으로 보완", "수치 목표/검증 방법"],
                    ["보유역량", profile, "연구인력, 장비, 선행실적"],
                ],
            ),
        ]
    elif "추진" in title or "일정" in title:
        content = [
            f"## {title}",
            "",
            "공고의 월 단위 추진일정과 기업의 실제 수행일정은 분리해 작성합니다.",
            "",
            _markdown_table(["추진일정", "근거/내용", "상태"], schedule_rows),
            "",
            _markdown_table(
                ["단계", "기업 수행계획", "산출물"],
                [
                    ["1단계", "요구사항 정의 및 기술개발 세부계획 수립", "개발계획서/성과지표"],
                    ["2단계", "시제품 또는 핵심 기능 개발", "시제품/시험 결과"],
                    ["3단계", "검증, 보완, 사업화 준비", "검증보고서/사업화 계획"],
                ],
            ),
        ]
    elif "사업화" in title or "활용" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["시장/고객", "사용자 입력과 근거자료를 기준으로 목표 시장을 구체화"],
                    ["활용계획", commercialization_plan],
                    ["보유역량", profile],
                    ["근거자료", evidence],
                ],
            ),
        ]
    elif "예산" in title or "지원금" in title:
        content = [
            f"## {title}",
            "",
            "지원한도와 지원비율은 공고 근거가 있는 범위만 기재하고, 기업별 사업비 배분은 사용자 확인 후 확정합니다.",
            "",
            support_program_table,
            "",
            _markdown_table(
                ["항목", "내용", "확인 필요"],
                [
                    ["공고상 지원조건", support_terms, "세부사업별 한도/비율 재확인"],
                    ["사업비 사용계획", budget_plan, "기업 입력 필요"],
                    ["민간부담금", "세부사업 공고 및 기업 사업비 계획에 따라 산정", "확정 전 검토"],
                ],
            ),
        ]
    elif "기대효과" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["평가기준", "기대효과 초안"],
                [
                    ["기술경쟁력", "신기술·신제품 개발 또는 공정혁신을 통한 경쟁력 향상을 목표로 작성"],
                    ["사업화 가능성", "시장 적용 계획과 고객/매출 근거는 사용자 입력으로 보완"],
                    ["수행역량", profile],
                    ["평가기준", criteria_terms],
                ],
            ),
        ]
    elif "체크리스트" in title or "제출" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(["제출서류", "구분", "작성/확인 기준", "파일 형식"], checklist_rows),
            "",
            _markdown_table(
                ["확인 필요 항목", "이유"],
                [[item, "공고 근거 또는 사용자 입력 없이는 확정하지 않음"] for item in workflow.analysis.uncertain_fields[:6]]
                or [["세부사업별 제출 마감일", "통합공고만으로 확정하지 않음"]],
            ),
        ]
    else:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["공고 근거", workflow.analysis.title],
                    ["사용자 입력", section_specific or project_summary],
                    ["평가기준", criteria_terms],
                ],
            ),
        ]

    confirmations = _government_rnd_section_confirmation_items(workflow, title)
    draft.content_markdown = "\n".join(content)
    draft.purpose = f"{title} 항목에서 IRIS/정부 R&D 제출문서에 필요한 근거와 사용자 입력을 표로 연결합니다."
    draft.related_criteria = workflow.analysis.evaluation_criteria[:4]
    draft.source_evidence_ids = [item.field for item in workflow.analysis.source_evidence[:6]]
    draft.revision_notes = ["지원한도, 지원비율, 일정, 제출서류는 source evidence 또는 사용자 확인 후 확정합니다."]
    draft.status = "drafted" if not draft.user_feedback else "revised"
    draft.needs_confirmation = confirmations
    draft.confirmation_required = confirmations
    draft.updated_at = utc_now_iso()
    return draft


def _mock_draft_section(workflow: WorkflowSession, draft: DraftSection) -> DraftSection:
    if workflow.analysis.doc_type == "government_rnd":
        return _mock_government_rnd_draft_section(workflow, draft)

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
        f"Write only the Korean markdown draft body for section '{draft.title}'. "
        "Do not include confirmation-needed, checklist, or TODO sections. "
        "When a fact is not present in the provided payload, do not guess it.\n\n"
        + json.dumps(payload, ensure_ascii=False)[: settings.MAX_DRAFT_INPUT_LENGTH]
    )


def generate_drafts(workflow: WorkflowSession) -> WorkflowSession:
    _ensure_draft_sections(workflow)
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
            confirmations: list[str] = []
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
    _ensure_draft_sections(workflow)
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


def _render_inline_html(value: str) -> str:
    escaped = html.escape(value)
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)


def _split_markdown_table_row(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return []
    return [cell.strip() for cell in stripped.strip("|").split("|")]


def _is_markdown_table_separator(line: str) -> bool:
    cells = _split_markdown_table_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in cells)


def _render_markdown_table(header: list[str], rows: list[list[str]]) -> str:
    header_html = "".join(f"<th>{_render_inline_html(cell)}</th>" for cell in header)
    body_html = []
    for row in rows:
        body_html.append("<tr>" + "".join(f"<td>{_render_inline_html(cell)}</td>" for cell in row) + "</tr>")
    return (
        "<table>\n"
        f"<thead><tr>{header_html}</tr></thead>\n"
        f"<tbody>{chr(10).join(body_html)}</tbody>\n"
        "</table>"
    )


def markdown_to_hwp_compatible_html(markdown: str, title: str) -> str:
    """Create a Hangul Word Processor friendly HTML document."""
    body_lines: list[str] = []
    lines = markdown.splitlines()
    index = 0
    while index < len(lines):
        raw_line = lines[index]
        line = raw_line.strip()
        if not line:
            body_lines.append("<p>&nbsp;</p>")
            index += 1
            continue
        if index + 1 < len(lines) and line.startswith("|") and _is_markdown_table_separator(lines[index + 1]):
            header = _split_markdown_table_row(line)
            rows: list[list[str]] = []
            index += 2
            while index < len(lines):
                candidate = lines[index].strip()
                if not candidate or not candidate.startswith("|") or not candidate.endswith("|"):
                    break
                if not _is_markdown_table_separator(candidate):
                    rows.append(_split_markdown_table_row(candidate))
                index += 1
            body_lines.append(_render_markdown_table(header, rows))
            continue
        if line.startswith("# "):
            body_lines.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.startswith("## "):
            body_lines.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("### "):
            body_lines.append(f"<h3>{html.escape(line[4:])}</h3>")
        elif line.startswith("- "):
            body_lines.append(f"<p class=\"bullet\">- {_render_inline_html(line[2:])}</p>")
        else:
            body_lines.append(f"<p>{_render_inline_html(line)}</p>")
        index += 1

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
    table {{ width: 100%; border-collapse: collapse; margin: 0 0 10pt; font-size: 10pt; }}
    th, td {{ border: 1px solid #999; padding: 4pt 5pt; vertical-align: top; }}
    th {{ background: #f4f6f8; font-weight: 700; }}
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
    from services.pdf_export_service import get_pdf_export_status

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

    pdf_status = get_pdf_export_status()
    return {
        "enabled": bool(settings.HWPX_EXPORT_ENABLED),
        "skill_dir": str(skill_dir),
        "scripts_found": scripts_found,
        "validation_available": validation_available,
        "template_clone_available": template_clone_available,
        **pdf_status,
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
    """Convert final markdown to a Hancom-openable HWPX package."""
    if not settings.HWPX_EXPORT_ENABLED:
        raise AnalysisError("HWPX export가 비활성화되어 있습니다. HTML export를 사용하거나 HWPX_EXPORT_ENABLED=true로 설정하세요.")

    scripts = _require_hwpx_scripts("md2hwpx.py", "fix_namespaces.py", "validate.py", "text_extract.py", "verify_hwpx.py")
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
        template_root = scripts["md2hwpx.py"].parents[1] / "templates"
        base_template = template_root / "base"
        reference_template = template_root / "reference.hwpx"
        if base_template.exists() or reference_template.exists():
            try:
                _run_hwpx_command([python_bin, str(scripts["md2hwpx.py"]), str(markdown_path), "-o", str(output_path)])
                summary["generation_method"] = "md2hwpx.py"
            except subprocess.CalledProcessError as exc:
                logger.info("md2hwpx.py failed; cloning bundled HWPX reference: %s", (exc.stderr or exc.stdout or exc)[:500])
                summary["generation_method"] = "reference_clone_fallback"
                summary["warnings"].append("md2hwpx.py 실패로 검증된 HWPX 기준 문서를 복제했습니다.")
                _build_reference_cloned_hwpx(markdown, title, output_path)
        else:
            logger.info("HWPX base template is not bundled; cloning bundled HWPX reference")
            summary["generation_method"] = "reference_clone"
            summary["warnings"].append("base template이 없어 검증된 HWPX 기준 문서를 복제했습니다.")
            _build_reference_cloned_hwpx(markdown, title, output_path)
        fix_result = _run_hwpx_command([python_bin, str(scripts["fix_namespaces.py"]), str(output_path)])
        summary["namespace_fixed"] = True
        summary["namespace_output"] = (fix_result.stdout or fix_result.stderr or "").strip()[:1000]
        validate_result = _run_hwpx_command([python_bin, str(scripts["validate.py"]), str(output_path)])
        summary["validation_passed"] = True
        summary["validation_output"] = (validate_result.stdout or validate_result.stderr or "").strip()[:1000]
        verify_path = tmpdir / "verify.json"
        try:
            verify_result = _run_hwpx_command(
                [
                    python_bin,
                    str(scripts["verify_hwpx.py"]),
                    "--result",
                    str(output_path),
                    "--json",
                    str(verify_path),
                ]
            )
            summary["verify_passed"] = True
            summary["verify_output"] = (verify_result.stdout or verify_result.stderr or "").strip()[:1000]
            if verify_path.exists():
                summary["verify_report"] = json.loads(verify_path.read_text(encoding="utf-8"))
        except subprocess.CalledProcessError as exc:
            summary["verify_passed"] = False
            summary["warnings"].append(f"verify_hwpx.py 실패: {(exc.stderr or exc.stdout or str(exc))[:500]}")
        try:
            text_result = _run_hwpx_command([python_bin, str(scripts["text_extract.py"]), str(output_path), "--include-tables"])
            extracted_text = text_result.stdout or ""
            summary["text_extract_passed"] = True
            summary["text_chars"] = len(extracted_text)
            summary["title_found"] = title[:20] in extracted_text if title else False
            meaningful_terms = _hwpx_quality_terms(markdown, title)
            found_terms = [term for term in meaningful_terms if term in extracted_text]
            summary["content_terms_checked"] = meaningful_terms[:10]
            summary["content_terms_found"] = found_terms[:10]
            summary["generated_content_found"] = bool(found_terms)
            summary["extracted_text_excerpt"] = extracted_text[:500]
        except subprocess.CalledProcessError as exc:
            summary["text_extract_passed"] = False
            summary["text_chars"] = 0
            summary["title_found"] = False
            summary["generated_content_found"] = False
            summary["warnings"].append(f"text_extract.py 실패: {(exc.stderr or exc.stdout or str(exc))[:500]}")
        if not summary.get("generated_content_found"):
            raw_found = _zip_contains_quality_terms(output_path, _hwpx_quality_terms(markdown, title))
            summary["generated_content_found"] = raw_found
            summary["zip_text_fallback_used"] = raw_found
        if not summary.get("generated_content_found"):
            summary["warnings"].append(
                "HWPX 내용 일부 확인 실패 — 내용은 정상 포함되었을 수 있습니다. "
                "열어서 확인 후 이상이 있으면 HTML export를 백업으로 사용하세요."
            )
        summary["warnings"] = [
            "A bundled Hancom-openable HWPX reference was cloned because a base markdown template was not available."
            if "minimal HWPX fallback" in warning
            else warning
            for warning in summary["warnings"]
        ]
        return output_path.name, output_path.read_bytes(), summary
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def export_markdown_to_hwpx(markdown: str, title: str) -> tuple[str, bytes]:
    filename, content, _summary = export_markdown_to_hwpx_with_validation(markdown, title)
    return filename, content


def _hwpx_quality_terms(markdown: str, title: str) -> list[str]:
    """Pick stable user-facing terms that should survive HWPX generation."""
    candidates: list[str] = []
    for raw in [title, *markdown.splitlines()]:
        text = _markdown_line_to_text(raw)
        text = re.sub(r"\|?\s*-{2,}\s*\|?", " ", text)
        text = re.sub(r"[|:()\[\]{}]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        if 4 <= len(text) <= 80:
            candidates.append(text)
        for token in re.findall(r"[A-Za-z0-9가-힣]{4,}", text):
            if len(token) >= 4:
                candidates.append(token)
    seen: set[str] = set()
    terms: list[str] = []
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        terms.append(candidate)
        if len(terms) >= 12:
            break
    return terms or [_safe_title(title)]


def _zip_contains_quality_terms(path: Path, terms: list[str]) -> bool:
    try:
        with ZipFile(path, "r") as archive:
            parts: list[str] = []
            for name in archive.namelist():
                if name.startswith("Contents/") and (name.endswith(".xml") or name.endswith(".hpf")):
                    parts.append(archive.read(name).decode("utf-8", errors="replace"))
            haystack = "\n".join(parts)
        return any(term and term in haystack for term in terms)
    except Exception:
        return False


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


def _reference_hwpx_template_path() -> Path:
    configured = settings.HWPX_TEMPLATE_DIR.strip()
    candidates: list[Path] = []
    if configured:
        configured_path = Path(configured)
        if configured_path.is_file():
            candidates.append(configured_path)
        else:
            candidates.extend(
                [
                    configured_path / "base.hwpx",
                    configured_path / "reference.hwpx",
                    configured_path / "withus-sample-filled.hwpx",
                ]
            )

    repo_root = Path(__file__).resolve().parents[2]
    skill_dir = _hwpx_skill_dir()
    candidates.extend(
        [
            skill_dir / "templates" / "reference.hwpx",
            skill_dir / "templates" / "base.hwpx",
            skill_dir / "templates" / "withus-sample-filled.hwpx",
            repo_root / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx",
            repo_root / "outputs" / "hwpx_download_smoke.hwpx",
        ]
    )

    for candidate in candidates:
        if candidate.exists() and candidate.is_file() and candidate.suffix.lower() == ".hwpx":
            return candidate
    raise AnalysisError("검증된 HWPX 기준 템플릿을 찾지 못해 HWPX 파일을 생성할 수 없습니다.")


def _build_reference_cloned_hwpx(markdown: str, title: str, output_path: Path) -> None:
    """Clone a known Hancom-openable HWPX and replace text nodes with generated content."""
    source_path = _reference_hwpx_template_path()
    title_text = _limit_hwpx_text(title.strip() or "LiveDock 자동작성 결과", 80)
    blocks = _markdown_to_hwpx_blocks(markdown, title_text)
    today = datetime.now().strftime("%Y 년 %#m 월 %#d 일") if os.name == "nt" else datetime.now().strftime("%Y 년 %-m 월 %-d 일")

    replacements = {
        2: f"{title_text} 초안",
        3: "LiveDock Agent가 업로드 문서와 선택한 작업 유형을 바탕으로 생성한 자동작성 초안입니다.",
        27: blocks[0],
        30: blocks[1],
        31: blocks[2],
        35: blocks[3],
        37: blocks[4],
        38: blocks[5],
        44: blocks[6],
        46: blocks[7],
        49: "본 문서는 자동 생성된 초안입니다. 제출 전 사실관계, 기관명, 금액, 일정, 자격 요건을 반드시 확인해 주세요.",
        50: today,
        51: "작성자 : LiveDock Agent",
        52: "사용자 검토 후 제출",
    }
    preview = "\r\n".join([f"{title_text} 초안", "", *blocks])
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with ZipFile(source_path, "r") as source, ZipFile(output_path, "w", ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == "Contents/section0.xml":
                xml = data.decode("utf-8")
                data = _replace_hwpx_text_nodes(xml, replacements).encode("utf-8")
            elif item.filename == "Contents/content.hpf":
                hpf = data.decode("utf-8")
                escaped_title = xml_escape(title_text)
                hpf = re.sub(r"(<opf:title>).*?(</opf:title>)", lambda match: f"{match.group(1)}{escaped_title}{match.group(2)}", hpf, flags=re.DOTALL)
                hpf = re.sub(
                    r'(<opf:meta name="ModifiedDate" content="text">).*?(</opf:meta>)',
                    lambda match: f"{match.group(1)}{modified}{match.group(2)}",
                    hpf,
                    flags=re.DOTALL,
                )
                data = hpf.encode("utf-8")
            elif item.filename == "Preview/PrvText.txt":
                data = _limit_hwpx_text(preview, 4000).encode("utf-8")

            compress_type = ZIP_STORED if item.filename == "mimetype" else (item.compress_type or ZIP_DEFLATED)
            target.writestr(item, data, compress_type=compress_type)


def _replace_hwpx_text_nodes(xml: str, replacements: dict[int, str]) -> str:
    index = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal index
        raw = match.group(2)
        clean = re.sub(r"<[^>]+>", "", raw).strip()
        if not clean:
            return match.group(0)
        index += 1
        if index not in replacements:
            return match.group(0)
        return f"{match.group(1)}{xml_escape(replacements[index])}{match.group(3)}"

    return re.sub(r"(<hp:t\b(?![^>]*/>)[^>]*>)(.*?)(</hp:t>)", replace, xml, flags=re.DOTALL)


def _markdown_to_hwpx_blocks(markdown: str, title: str) -> list[str]:
    cleaned_lines = [_markdown_line_to_text(line) for line in markdown.splitlines()]
    cleaned_lines = [line for line in cleaned_lines if line and line != title]
    if not cleaned_lines:
        cleaned_lines = ["업로드 문서와 선택한 작업 유형을 바탕으로 자동작성 결과를 생성했습니다."]

    blocks: list[str] = []
    current: list[str] = []
    for line in cleaned_lines:
        current.append(line)
        if sum(len(item) for item in current) >= 420:
            blocks.append(_limit_hwpx_text(" ".join(current), 900))
            current = []
    if current:
        blocks.append(_limit_hwpx_text(" ".join(current), 900))

    defaults = [
        "문서의 핵심 내용을 확인하기 쉬운 초안 구조로 재구성했습니다.",
        "요구사항과 제출 목적에 맞게 주요 내용을 정리했습니다.",
        "검토가 필요한 항목은 최종 제출 전에 사용자가 직접 확인해야 합니다.",
        "세부 표현은 기관 양식과 제출 기준에 맞게 다듬을 수 있습니다.",
        "완성본은 HWPX 형식으로 내려받아 한글에서 추가 편집할 수 있습니다.",
        "다시 생성하기를 통해 같은 입력값으로 다른 초안을 만들 수 있습니다.",
        "새 문서를 업로드하면 워크플로우를 처음부터 다시 실행할 수 있습니다.",
        "이 결과는 MVP 테스트용 자동작성 초안입니다.",
    ]
    while len(blocks) < 8:
        blocks.append(defaults[len(blocks)])
    return blocks[:8]


def _limit_hwpx_text(value: str, max_chars: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 1].rstrip() + "…"


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


_GOVERNMENT_RND_COVERED_INPUT_TERMS = (
    "기업명",
    "사업자등록",
    "소재지",
    "과제명",
    "기술개요",
    "차별성",
    "개발목표",
    "성과지표",
    "보유역량",
    "연구인력",
    "기존 실적",
    "사업비",
    "지원금",
    "사용계획",
)


def _question_covered_by_government_rnd_inputs(question: str) -> bool:
    normalized = re.sub(r"\s+", "", question or "")
    return any(re.sub(r"\s+", "", term) in normalized for term in _GOVERNMENT_RND_COVERED_INPUT_TERMS)


def _government_rnd_input_fields(
    analysis: AnalysisResult,
    company_profile: CompanyProfile | None = None,
) -> list[UserInputField]:
    fields: list[UserInputField] = [
        UserInputField(
            id="applicant_name",
            label="기업명 및 소재지",
            field_type="text",
            required=True,
            section_id="section-1",
            description="IRIS 제출문서에 들어갈 기업명, 사업자등록 기준 소재지, 대표 신청 주체를 입력하세요.",
            placeholder="예: 주식회사 라이브독, 서울특별시 강남구",
            value=company_profile.name if company_profile else "",
        ),
        UserInputField(
            id="project_summary",
            label="IRIS 제출 과제명",
            field_type="text",
            required=True,
            section_id="section-2",
            description="IRIS에 제출할 과제명 또는 임시 과제명을 입력하세요.",
            placeholder="예: 생성형 AI 기반 정부 R&D 제출문서 자동작성 플랫폼 개발",
        ),
        UserInputField(
            id="technical_summary",
            label="기술개요 및 차별성",
            required=True,
            section_id="section-2",
            description="개발하려는 핵심 기술, 차별성, 적용 제품/서비스를 입력하세요.",
            placeholder="핵심 기술, 기존 방식 대비 차별성, 적용 제품 또는 공정을 적어주세요.",
        ),
        UserInputField(
            id="development_goal",
            label="개발목표 및 성과지표",
            required=True,
            section_id="section-2",
            description="정량 개발목표, 성능지표, 검증 방법을 입력하세요.",
            placeholder="예: 문서 초안 작성 시간 70% 단축, HWPX 표 구조 보존율 95% 이상",
        ),
        UserInputField(
            id="applicant_profile",
            label="보유역량 및 수행근거",
            required=True,
            section_id="section-4",
            description="연구인력, 장비, 선행 개발 실적, 인증/특허/고객 검증 등 수행역량을 입력하세요.",
            placeholder="예: AI 엔지니어 3명, HWPX 변환 PoC, 공공기관 문서 자동화 경험",
            value=_profile_to_text(company_profile) if company_profile else "",
        ),
        UserInputField(
            id="commercialization_plan",
            label="사업화/활용계획",
            required=True,
            section_id="section-4",
            description="개발 결과의 시장 적용, 고객군, 매출/확산 계획, 공정 활용 방안을 입력하세요.",
            placeholder="목표 고객, 적용 현장, 판매/도입 경로, 활용 시나리오를 적어주세요.",
        ),
        UserInputField(
            id="budget_plan",
            label="사업비 및 지원금 사용계획",
            required=True,
            section_id="section-5",
            description="인건비, 재료비, 시험인증비, 외주비 등 사업비와 지원금 사용계획을 입력하세요.",
            placeholder="예: 인건비 50%, 클라우드/인프라 20%, 시험검증 20%, 지식재산 10%",
        ),
        UserInputField(
            id="evidence",
            label="증빙자료 및 성과근거",
            required=False,
            section_id="section-6",
            description="특허, 인증, 매출, PoC, 고객 인터뷰, 투자, 수상 등 증빙 가능한 근거를 입력하세요.",
            placeholder="예: 고객 인터뷰 12건, PoC 2건, 특허출원 1건, 이전 매출/수상 이력",
            value=company_profile.strengths if company_profile else "",
        ),
    ]

    existing_ids = {field.id for field in fields}
    for section in sorted(analysis.document_template, key=lambda item: item.order):
        field_id = f"section_input_{section.id}"
        if field_id in existing_ids:
            continue
        fields.append(
            UserInputField(
                id=field_id,
                label=f"{section.title} 추가 반영 내용",
                required=False,
                section_id=section.id,
                description=section.hint,
                placeholder=f"{section.title} 초안에 추가로 반영할 기업별 사실이 있으면 적어 주세요.",
            )
        )
        existing_ids.add(field_id)

    for question in analysis.missing_questions[:8]:
        if _question_covered_by_government_rnd_inputs(question.question):
            continue
        field_id = f"missing_{question.id}"
        if field_id in existing_ids:
            continue
        fields.append(
            UserInputField(
                id=field_id,
                label=question.question,
                required=False,
                section_id=question.required_for if question.required_for.startswith("section-") else None,
                description=question.reason,
                placeholder="공고 근거 또는 사용자 확인이 필요한 내용을 입력해 주세요.",
            )
        )
        existing_ids.add(field_id)
    return fields


_RESEARCHER_RND_COVERED_INPUT_TERMS = (
    "주관연구개발기관",
    "연구실명",
    "연구책임자",
    "연구주제",
    "RFP",
    "적합성",
    "핵심 가설",
    "기술개요",
    "연구개발 목표",
    "성과지표",
    "방법론",
    "추진체계",
    "공동연구개발기관",
    "데이터 공유",
    "DMP",
    "연구데이터 관리계획",
    "K-BDS",
    "연구비",
    "연구개발비",
)


def _question_covered_by_researcher_rnd_inputs(question: str) -> bool:
    normalized = re.sub(r"\s+", "", question or "")
    return any(re.sub(r"\s+", "", term) in normalized for term in _RESEARCHER_RND_COVERED_INPUT_TERMS)


def _government_rnd_is_researcher_applicant(analysis: AnalysisResult) -> bool:
    kind = getattr(analysis, "applicant_kind", "unspecified")
    if kind in {"university_researcher", "research_institute"}:
        return True
    if kind == "company":
        return False

    text_parts = [
        analysis.title,
        analysis.organization,
        *analysis.eligibility,
        *[item.label for item in analysis.checklist],
        *[section.title for section in analysis.document_template],
        *[question.question for question in analysis.missing_questions],
    ]
    for program in analysis.support_programs:
        text_parts.extend(
            [
                program.parent_program,
                program.sub_program,
                getattr(program, "rfp_id", "") or "",
                getattr(program, "research_topic", "") or "",
                program.notes or "",
            ]
        )
    text = " ".join(part for part in text_parts if part)
    if any(term in text for term in ("기업명", "사업자등록", "중소기업", "창업기업")):
        return False
    return any(
        term in text
        for term in (
            "연구책임자",
            "주관연구개발기관",
            "공동연구개발기관",
            "위탁연구개발기관",
            "연구개발계획서",
            "연구데이터 관리계획",
            "DMP",
            "대학",
            "한국연구재단",
        )
    )


def _government_rnd_researcher_input_fields(
    analysis: AnalysisResult,
    company_profile: CompanyProfile | None = None,
) -> list[UserInputField]:
    fields: list[UserInputField] = [
        UserInputField(
            id="applicant_name",
            label="주관연구개발기관/연구실명",
            field_type="text",
            required=True,
            section_id="section-1",
            description="IRIS 연구개발계획서에 들어갈 주관연구개발기관, 학과, 연구실명을 입력하세요.",
            placeholder="예: 서울과학기술대학교 스마트ICT융합공학과 ○○연구실",
            value=company_profile.name if company_profile else "",
        ),
        UserInputField(
            id="principal_investigator",
            label="연구책임자 정보",
            required=True,
            section_id="section-5",
            description="연구책임자 성명, 소속, 역할, 최근 연구실적, 과제 수행 가능성을 입력하세요.",
            placeholder="성명/소속/전공, 최근 논문·특허·과제, 3책5공 검토 상태",
        ),
        UserInputField(
            id="project_summary",
            label="IRIS 제출 과제명",
            field_type="text",
            required=True,
            section_id="section-2",
            description="RFP에 맞춰 제출할 과제명 또는 임시 과제명을 입력하세요.",
            placeholder="예: 민간 바이오 데이터 공유·활용을 위한 K-BDS 연계 지능형 플랫폼 연구",
        ),
        UserInputField(
            id="research_topic_alignment",
            label="RFP 적합성 및 차별성",
            required=True,
            section_id="section-2",
            description="공고의 RFP 연구주제와 제안 연구가 어떻게 부합하고 차별화되는지 입력하세요.",
            placeholder="RFP 키워드, 기존 연구 대비 차별성, 데이터 공유 참여 조건 대응",
        ),
        UserInputField(
            id="technical_summary",
            label="연구/기술 개요",
            required=True,
            section_id="section-3",
            description="핵심 연구내용, 기술 접근법, 데이터·알고리즘·시스템 구성을 입력하세요.",
            placeholder="핵심 기술, 연구가설, 데이터 유형, 검증 대상",
        ),
        UserInputField(
            id="development_goal",
            label="연구개발 목표 및 성과지표",
            required=True,
            section_id="section-3",
            description="정량 목표, 성과지표, 검증 방법, 연차별 목표를 입력하세요.",
            placeholder="예: 30개월 동안 프로토타입, 공유 데이터셋, 성능지표, 논문/특허 후보 도출",
        ),
        UserInputField(
            id="methodology_plan",
            label="연구방법 및 추진계획",
            required=True,
            section_id="section-4",
            description="연차별 연구내용, 실험 설계, 추진 절차, 산출물을 입력하세요.",
            placeholder="1단계 요구분석, 2단계 모델/시스템 구현, 3단계 검증 및 고도화",
        ),
        UserInputField(
            id="research_team_plan",
            label="연구팀 역량 및 역할분담",
            required=True,
            section_id="section-5",
            description="참여연구자, 학생연구원, 보유 장비, 선행 연구, 역할분담을 입력하세요.",
            placeholder="연구책임자/참여연구원/학생연구원 역할, 보유 장비, 선행성과",
        ),
        UserInputField(
            id="partner_institutions",
            label="공동·위탁 연구개발기관",
            required=True,
            section_id="section-6",
            description="공동연구개발기관, 데이터 공유 참여 기관, 병원/영리기관 협력 여부를 입력하세요.",
            placeholder="기관명, 역할, 데이터 제공/검증 범위, 확약서 준비 상태",
        ),
        UserInputField(
            id="data_management_plan",
            label="DMP 및 데이터 공유 계획",
            required=True,
            section_id="section-6",
            description="연구데이터 관리계획(DMP), K-BDS 연계, 비식별화, 보안·윤리 계획을 입력하세요.",
            placeholder="데이터 수집, 저장, 품질관리, K-BDS 등록, 접근권한, 폐기/보존 계획",
        ),
        UserInputField(
            id="budget_plan",
            label="연구개발비 사용계획",
            required=True,
            section_id="section-7",
            description="인건비, 연구활동비, 장비/재료비, 데이터 인프라, 검증비 등 예산 배분을 입력하세요.",
            placeholder="공고 연구비 규모 안에서 연차별·항목별 배분 근거를 입력",
        ),
        UserInputField(
            id="expected_outcomes",
            label="성과활용 및 기대효과",
            required=True,
            section_id="section-8",
            description="원천기술, 논문, 특허, 기술이전, 데이터 공유 기반, 사회·산업 파급효과를 입력하세요.",
            placeholder="성과물, 활용기관, 기술이전/사업화 가능성, 과학계·산업계 파급효과",
        ),
        UserInputField(
            id="evidence",
            label="증빙자료 및 선행성과",
            required=False,
            section_id="section-5",
            description="논문, 특허, 과제, 장비, 데이터, 협약서, 인터뷰 등 증빙 가능한 근거를 입력하세요.",
            placeholder="최근 5년 논문/특허/과제, 보유 데이터, 기관 협력 근거",
            value=company_profile.strengths if company_profile else "",
        ),
    ]

    existing_ids = {field.id for field in fields}
    for section in sorted(analysis.document_template, key=lambda item: item.order):
        field_id = f"section_input_{section.id}"
        if field_id in existing_ids:
            continue
        fields.append(
            UserInputField(
                id=field_id,
                label=f"{section.title} 추가 반영 내용",
                required=False,
                section_id=section.id,
                description=section.hint,
                placeholder=f"{section.title} 초안에 추가로 반영할 연구실별 사실이 있으면 입력하세요.",
            )
        )
        existing_ids.add(field_id)

    for question in analysis.missing_questions[:8]:
        if _question_covered_by_researcher_rnd_inputs(question.question):
            continue
        field_id = f"missing_{question.id}"
        if field_id in existing_ids:
            continue
        fields.append(
            UserInputField(
                id=field_id,
                label=question.question,
                required=False,
                section_id=question.required_for if question.required_for.startswith("section-") else None,
                description=question.reason,
                placeholder="공고 근거 또는 사용자 확인이 필요한 내용을 입력하세요.",
            )
        )
        existing_ids.add(field_id)
    return fields


def _researcher_confirmation_items(workflow: WorkflowSession, title: str) -> list[str]:
    uncertain: list[str] = []
    for value in workflow.analysis.uncertain_fields:
        cleaned = str(value).strip()
        if cleaned and cleaned not in uncertain:
            uncertain.append(cleaned)

    def select(*terms: str) -> list[str]:
        selected: list[str] = []
        for item in uncertain:
            if any(term in item for term in terms) and item not in selected:
                selected.append(item)
        return selected

    if "RFP" in title:
        selected = select("RFP", "공동연구개발기관", "데이터 공유", "차별성")
    elif "데이터" in title or "공동연구" in title:
        selected = select("DMP", "연구데이터", "K-BDS", "공동연구개발기관", "데이터 공유")
    elif "체크리스트" in title or "제출" in title:
        selected = select("3책5공", "참여제한", "DMP", "기관참여", "연구책임자")
    elif "연구개발비" in title or "예산" in title:
        selected = select("연구비", "연구개발비")
    elif "역량" in title:
        selected = select("연구책임자", "참여연구자", "3책5공")
    elif "목표" in title:
        selected = select("연구주제", "성과지표", "RFP")
    else:
        selected = uncertain[:1]
    return selected or uncertain[:1]


def _researcher_rfp_summary_table(workflow: WorkflowSession) -> str:
    program = workflow.analysis.support_programs[0] if workflow.analysis.support_programs else None
    rows = [
        ["공고명", workflow.analysis.title],
        ["주관부처", workflow.analysis.organization],
        ["RFP 관리번호", getattr(program, "rfp_id", None) or "공고 원문 확인 필요"],
        ["내역사업", (program.sub_program if program else "") or "공고 원문 확인 필요"],
        ["연구주제명", getattr(program, "research_topic", None) or "공고 원문 확인 필요"],
        ["연구비", getattr(program, "budget", None) or (program.support_scale if program else "") or "공고 원문 확인 필요"],
        ["선정 예정 과제 수", getattr(program, "project_count", None) or "공고 원문 확인 필요"],
        ["과제형태", getattr(program, "task_type", None) or "공고 원문 확인 필요"],
        ["RFP 유형코드", getattr(program, "rfp_type_code", None) or "공고 원문 확인 필요"],
        ["보안등급", getattr(program, "security_level", None) or "공고 원문 확인 필요"],
        ["연구기간", (program.development_period if program else "") or "공고 원문 확인 필요"],
        ["필수 조건", (program.notes if program else "") or "공고 원문 확인 필요"],
    ]
    return _markdown_table(["항목", "내용"], rows)


def _researcher_evaluation_table(workflow: WorkflowSession) -> str:
    rows = [[item, "공고 평가항목에 맞춰 사용자 입력 근거로 보완"] for item in workflow.analysis.evaluation_criteria[:8]]
    if not rows:
        rows = [["평가기준", "공고 원문에서 확인 필요"]]
    return _markdown_table(["평가기준", "초안 반영 방향"], rows)


def _mock_government_rnd_researcher_draft_section(workflow: WorkflowSession, draft: DraftSection) -> DraftSection:
    inputs = _input_map(workflow)
    title = draft.title
    applicant = inputs.get("applicant_name", "확인 필요")
    principal_investigator = inputs.get("principal_investigator", "확인 필요")
    project_summary = inputs.get("project_summary", "확인 필요")
    alignment = inputs.get("research_topic_alignment", "RFP 적합성 입력 필요")
    technical_summary = inputs.get("technical_summary", "연구/기술 개요 입력 필요")
    development_goal = inputs.get("development_goal", "연구개발 목표 입력 필요")
    methodology_plan = inputs.get("methodology_plan", "연구방법 및 추진계획 입력 필요")
    research_team_plan = inputs.get("research_team_plan", "연구팀 역량 입력 필요")
    partner_institutions = inputs.get("partner_institutions", "공동연구개발기관 확인 필요")
    data_management_plan = inputs.get("data_management_plan", "DMP 입력 필요")
    budget_plan = inputs.get("budget_plan", "연구개발비 사용계획 입력 필요")
    expected_outcomes = inputs.get("expected_outcomes", "성과활용 및 기대효과 입력 필요")
    evidence = inputs.get("evidence", "증빙자료 입력 필요")
    section_specific = inputs.get(f"section_input_{draft.section_id}", "")
    rfp_table = _researcher_rfp_summary_table(workflow)
    evaluation_table = _researcher_evaluation_table(workflow)
    checklist_rows = [
        [item.label, item.category, item.description or "공고 기준 확인", item.file_format or "IRIS 업로드"]
        for item in workflow.analysis.checklist[:10]
    ] or [["연구개발계획서", "required", "공고 양식 확인", "IRIS 업로드"]]

    if "사업개요" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["신청 주체", applicant],
                    ["연구책임자", principal_investigator],
                    ["제안 과제명", project_summary],
                    ["제출 경로", workflow.analysis.submission_method or "IRIS 제출 경로 확인 필요"],
                    ["공고 요약", workflow.analysis.summary or "공고 원문 기준 요약 필요"],
                ],
            ),
            "",
            "### RFP 요약표",
            "",
            rfp_table,
        ]
    elif "RFP" in title:
        content = [
            f"## {title}",
            "",
            "### RFP 요약표",
            "",
            rfp_table,
            "",
            _markdown_table(
                ["항목", "작성 초안", "확인 필요"],
                [
                    ["RFP 부합성", alignment, "연구주제명 및 필수 공동연구 조건"],
                    ["차별성", technical_summary, "기존 국가연구개발사업과의 중복성 검토"],
                    ["공동연구개발기관", partner_institutions, "데이터 공유 참여 기관 확약"],
                ],
            ),
        ]
    elif "목표" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["연구주제", project_summary],
                    ["연구/기술 개요", technical_summary],
                    ["연구개발 목표", development_goal],
                    ["성과지표", "사용자 입력 목표를 정량 지표, 검증 방법, 연차별 산출물로 구체화"],
                ],
            ),
        ]
    elif "내용" in title or "추진체계" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["단계", "연구내용", "주요 산출물"],
                [
                    ["1단계", methodology_plan, "요구사항/데이터/실험 설계"],
                    ["2단계", "핵심 기술 구현 및 공동연구개발기관 데이터 연계", "프로토타입/실험 결과"],
                    ["3단계", "검증, 고도화, 성과활용 준비", "최종 보고서/성과 후보"],
                ],
            ),
            "",
            _markdown_table(
                ["기관/역할", "내용"],
                [
                    ["주관연구개발기관", applicant],
                    ["연구책임자", principal_investigator],
                    ["공동연구개발기관", partner_institutions],
                ],
            ),
        ]
    elif "역량" in title or "기반" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["연구책임자", principal_investigator],
                    ["연구팀 역할분담", research_team_plan],
                    ["선행성과/증빙", evidence],
                    ["공고 평가 연계", "연구역량 25점 항목에 맞춰 연구경력, 연구업적, 추진 가능성을 보완"],
                ],
            ),
        ]
    elif "데이터" in title or "공동연구" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "계획"],
                [
                    ["연구데이터 관리계획(DMP)", data_management_plan],
                    ["K-BDS 연계", "데이터 등록, 메타데이터 정합성, 접근권한 관리 계획을 DMP에 연결"],
                    ["공동연구개발기관", partner_institutions],
                    ["윤리/보안", "비식별화, IRB/기관 절차, 보안등급 기준을 사용자 확인 후 보완"],
                ],
            ),
        ]
    elif "연구개발비" in title or "예산" in title:
        content = [
            f"## {title}",
            "",
            "공고의 연구비 규모와 연구실별 예산 배분은 분리해서 작성합니다.",
            "",
            rfp_table,
            "",
            _markdown_table(
                ["비목", "사용계획", "확인 필요"],
                [
                    ["인건비/학생인건비", budget_plan, "참여율 및 인건비 계상률"],
                    ["연구활동비/재료비", "실험, 데이터 처리, 검증 활동에 필요한 비용", "세부 산출근거"],
                    ["데이터 인프라", "K-BDS 연계, 저장소, 보안 관리 비용", "기관 기준 및 공고 허용 범위"],
                ],
            ),
        ]
    elif "성과" in title or "기대효과" in title:
        content = [
            f"## {title}",
            "",
            "### 평가기준표",
            "",
            evaluation_table,
            "",
            _markdown_table(
                ["성과유형", "기대효과"],
                [
                    ["원천기술", expected_outcomes],
                    ["학술성과", "논문, 학회, 공개 데이터셋 등 사용자 입력 근거로 보완"],
                    ["지식재산/활용", "특허, 기술이전, 후속 과제, 산업계 활용 로드맵을 확인 후 작성"],
                ],
            ),
        ]
    elif "체크리스트" in title or "제출" in title:
        content = [
            f"## {title}",
            "",
            _markdown_table(["제출서류", "구분", "작성/확인 기준", "제출 방식"], checklist_rows),
            "",
            _markdown_table(
                ["확인 필요 항목", "처리 방향"],
                [[item, "사용자 입력 또는 기관 확인 전에는 확정 문장으로 쓰지 않음"] for item in workflow.analysis.uncertain_fields[:8]]
                or [["연구책임자/기관 승인", "IRIS 및 주관연구기관 절차 확인 필요"]],
            ),
        ]
    else:
        content = [
            f"## {title}",
            "",
            _markdown_table(
                ["항목", "내용"],
                [
                    ["공고 근거", workflow.analysis.title],
                    ["사용자 입력", section_specific or project_summary],
                    ["평가기준", _join_or_unspecified(workflow.analysis.evaluation_criteria, 4)],
                ],
            ),
        ]

    confirmations = _researcher_confirmation_items(workflow, title)
    draft.content_markdown = "\n".join(content)
    draft.purpose = f"{title} 항목에서 대학/연구자용 IRIS 제출문서에 필요한 공고 근거와 연구실 입력을 표로 연결합니다."
    draft.related_criteria = workflow.analysis.evaluation_criteria[:5]
    draft.source_evidence_ids = [item.field for item in workflow.analysis.source_evidence[:8]]
    draft.revision_notes = ["연구실 성과, 공동연구기관, DMP, 연구비 계획은 사용자 입력 또는 기관 확인 후 확정합니다."]
    draft.status = "drafted" if not draft.user_feedback else "revised"
    draft.needs_confirmation = confirmations
    draft.confirmation_required = confirmations
    draft.updated_at = utc_now_iso()
    return draft


# Korean text recovery overrides.
# The original functions above are kept for the HWPX utility code around them,
# but these definitions are intentionally last so imports use clean MVP copy.
def create_input_fields(analysis: AnalysisResult, company_profile: CompanyProfile | None = None) -> list[UserInputField]:
    if analysis.doc_type == "government_rnd":
        if _government_rnd_is_researcher_applicant(analysis):
            return _government_rnd_researcher_input_fields(analysis, company_profile)
        return _government_rnd_input_fields(analysis, company_profile)

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
            placeholder="무엇을 만들고 어떤 문제를 해결하는지 적어 주세요.",
        ),
        UserInputField(
            id="evidence",
            label="근거 자료와 성과",
            required=False,
            description="수상, 실험, 인터뷰, 시장조사, 포트폴리오처럼 증명 가능한 내용을 적어 주세요.",
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
                required=False,
                section_id=question.required_for if question.required_for.startswith("section-") else None,
                description=question.reason,
                placeholder="공고와 제출 초안에 반영할 사실만 입력해 주세요.",
            )
        )
    return fields


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


def confirmation_required_items(workflow: WorkflowSession) -> list[str]:
    return _confirmation_items(workflow)


def _confirmation_items(workflow: WorkflowSession) -> list[str]:
    items: list[str] = []
    for value in workflow.analysis.uncertain_fields:
        cleaned = str(value).strip()
        if cleaned and cleaned not in items:
            items.append(cleaned)
    return items[:8]


def _mock_draft_section(workflow: WorkflowSession, draft: DraftSection) -> DraftSection:
    if workflow.analysis.doc_type == "government_rnd":
        return _mock_government_rnd_draft_section(workflow, draft)

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
    draft.purpose = f"{draft.title} 항목에서 공고 요구사항과 사용자가 제공한 사실을 연결합니다."
    draft.related_criteria = workflow.analysis.evaluation_criteria[:3]
    draft.source_evidence_ids = [item.field for item in workflow.analysis.source_evidence[:3]]
    draft.revision_notes = ["제출 전 사용자 경험, 수치, 증빙 자료가 실제 사실과 일치하는지 확인해 주세요."]
    draft.status = "drafted" if not draft.user_feedback else "revised"
    draft.needs_confirmation = confirmations
    draft.confirmation_required = confirmations
    draft.updated_at = utc_now_iso()
    return draft


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
        f"Write only the Korean markdown draft body for section '{draft.title}'. "
        "Do not include confirmation-needed, checklist, or TODO sections. "
        "When a fact is not present in the provided payload, do not guess it.\n\n"
        + json.dumps(payload, ensure_ascii=False)[: settings.MAX_DRAFT_INPUT_LENGTH]
    )


_REVISE_SYSTEM_PROMPT = (
    "당신은 한국 공고문 작성 전문가입니다. "
    "사용자의 피드백을 반영하여 해당 섹션을 한국어 마크다운으로 다시 작성하세요. "
    "JSON, 코드블록, 설명 문구 없이 본문만 출력하세요."
)


def revise_section(workflow: WorkflowSession, section_id: str) -> WorkflowSession:
    for draft in workflow.draft_sections:
        if draft.section_id != section_id:
            continue

        feedback = draft.user_feedback or ""

        if should_use_mock_ai() or not feedback.strip():
            draft.content_markdown = (
                draft.content_markdown
                + "\n\n"
                + f"### 사용자 피드백 반영\n{feedback or '추가 피드백이 없습니다.'}"
            ).strip()
            draft.status = "revised"
            draft.updated_at = utc_now_iso()
            break

        user_prompt = (
            f"섹션: {draft.title}\n\n"
            f"현재 내용:\n{draft.content_markdown}\n\n"
            f"사용자 피드백:\n{feedback}\n\n"
            "위 피드백을 반영하여 섹션을 다시 작성하세요."
        )
        try:
            new_content = "".join(stream_text("draft", _REVISE_SYSTEM_PROMPT, user_prompt))
        except Exception:
            new_content = (
                draft.content_markdown
                + "\n\n"
                + f"### 사용자 피드백 반영\n{feedback}"
            )

        draft.content_markdown = new_content.strip()
        draft.revision_notes = [f"피드백 반영: {feedback[:80]}"]
        draft.status = "revised"
        draft.updated_at = utc_now_iso()
        break

    workflow.status = "reviewing"
    workflow.updated_at = utc_now_iso()
    return workflow


def confirm_workflow(workflow: WorkflowSession, confirmed_items: list[str] | None = None) -> WorkflowSession:
    now = utc_now_iso()
    workflow.status = "confirmed"
    workflow.confirmed_at = now
    confirmed: list[str] = []
    for item in confirmed_items or []:
        cleaned = str(item).strip()
        if cleaned and cleaned not in confirmed:
            confirmed.append(cleaned)
    if not confirmed:
        for draft in workflow.draft_sections:
            for item in draft.confirmation_required or []:
                cleaned = str(item).strip()
                if cleaned and cleaned not in confirmed:
                    confirmed.append(cleaned)
    workflow.confirmed_items = confirmed
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
    if not sections:
        raise AnalysisError("최종 문서를 만들 초안이 없습니다. 먼저 섹션별 초안을 생성해 주세요.")

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
