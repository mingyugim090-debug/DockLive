from __future__ import annotations

from copy import deepcopy
from typing import Iterable
from uuid import uuid4

from core.errors import AnalysisError
from models.schemas import (
    AgencyNoticeBlock,
    AgencyNoticeBrief,
    AgencyNoticeDraft,
    AgencyNoticeSection,
    AgencySourceEvidence,
    AgencySourceTrace,
    ApprovalComment,
    ApprovalStep,
    ApprovalWorkflow,
    ClauseLibraryEntry,
    MandatoryClauseCheck,
    NoticeAuditEvent,
    NoticeDocument,
    NoticeSection,
    NoticeVersion,
    utc_now_iso,
)
from services import storage
from services.agency_clause_library import required_clause_entries


CLAUSE_FIELD_NAMES = {
    "legal_basis": "legal_basis",
    "privacy_policy": "privacy_policy",
    "fair_competition": "fair_competition_clause",
    "appeal_process": "appeal_process",
}

SECTION_ORDER = [
    ("overview", "사업개요"),
    ("support", "지원내용"),
    ("eligibility", "신청자격"),
    ("documents", "제출서류"),
    ("evaluation", "평가기준"),
    ("schedule", "추진일정"),
    ("submission", "신청방법"),
    ("contact", "문의처"),
    ("clauses", "필수 조항 점검"),
]

ALLOWED_TRANSITIONS = {
    "draft": {"under_review"},
    "under_review": {"revision_requested", "approving"},
    "revision_requested": {"under_review"},
    "approving": {"approved", "revision_requested"},
    "approved": {"published"},
    "published": set(),
}


def create_agency_notice_draft(brief: AgencyNoticeBrief) -> AgencyNoticeDraft:
    draft_id = f"agency-{uuid4()}"
    evidence = _build_source_evidence(brief)
    if brief.recipe_id == "lab_recruitment":
        clause_checks: list[MandatoryClauseCheck] = []
        confirmation_required = _lab_confirmation_items(brief)
        sections = _build_lab_recruitment_sections(brief, evidence, confirmation_required)
        blocks = _build_lab_recruitment_blocks(brief, evidence, confirmation_required)
    else:
        clause_checks = _build_clause_checks(brief, evidence)
        confirmation_required = _confirmation_items(brief, clause_checks)
        sections = _build_sections(brief, evidence, confirmation_required, clause_checks)
        blocks: list[AgencyNoticeBlock] = []
    approval = _default_approval_workflow(draft_id)
    version = NoticeVersion(
        id=f"version-{uuid4()}",
        draft_id=draft_id,
        version_number=1,
        created_by=brief.author_id,
        change_summary="기관 공고 초안을 생성했습니다.",
        sections_snapshot=deepcopy(sections),
        mandatory_clause_checks=deepcopy(clause_checks),
    )
    draft = AgencyNoticeDraft(
        id=draft_id,
        organization_id=brief.organization_id,
        title=brief.title,
        status="draft",
        recipe_id=brief.recipe_id,
        direction_id=brief.direction_id,
        brief=brief,
        blocks=blocks,
        sections=sections,
        mandatory_clause_checks=clause_checks,
        source_evidence=evidence,
        confirmation_required=confirmation_required,
        approval_workflow=approval,
        versions=[version],
        current_version_id=version.id,
        audit_events=[
            _audit(draft_id, brief.author_id, "draft_created", "기관 공고 초안과 승인 워크플로우를 생성했습니다.")
        ],
    )
    _save(draft)
    return draft


def list_agency_notice_drafts(organization_id: str = "demo-agency") -> list[AgencyNoticeDraft]:
    drafts: list[AgencyNoticeDraft] = []
    for draft_id in storage.list_agency_notice_draft_ids(organization_id):
        try:
            drafts.append(get_agency_notice_draft(draft_id))
        except AnalysisError:
            continue
    return drafts


def get_agency_notice_draft(draft_id: str) -> AgencyNoticeDraft:
    payload = storage.load_agency_notice_draft(draft_id)
    if not payload:
        raise AnalysisError("기관 공고 초안을 찾을 수 없습니다.")
    return AgencyNoticeDraft.model_validate(payload)


def update_agency_notice_section(
    draft_id: str,
    section_id: str,
    content_markdown: str,
    change_summary: str,
    actor_id: str = "demo-user",
) -> AgencyNoticeDraft:
    draft = get_agency_notice_draft(draft_id)
    if draft.status in {"approved", "published"}:
        raise AnalysisError("승인 또는 게시 완료된 공고는 섹션을 수정할 수 없습니다.")
    updated = False
    for section in draft.sections:
        if section.id == section_id:
            section.content_markdown = content_markdown.strip()
            section.updated_at = utc_now_iso()
            updated = True
            break
    if not updated:
        raise AnalysisError("수정할 공고 섹션을 찾을 수 없습니다.")
    draft.updated_at = utc_now_iso()
    draft.versions.append(
        NoticeVersion(
            id=f"version-{uuid4()}",
            draft_id=draft.id,
            version_number=len(draft.versions) + 1,
            created_by=actor_id,
            change_summary=change_summary.strip() or "섹션 내용을 수정했습니다.",
            sections_snapshot=deepcopy(draft.sections),
            mandatory_clause_checks=deepcopy(draft.mandatory_clause_checks),
        )
    )
    draft.current_version_id = draft.versions[-1].id
    draft.audit_events.append(_audit(draft.id, actor_id, "section_updated", change_summary))
    _save(draft)
    return draft


def add_agency_notice_comment(
    draft_id: str,
    body: str,
    version_id: str | None = None,
    section_id: str | None = None,
    author_id: str = "demo-user",
    author_name: str = "담당자",
) -> AgencyNoticeDraft:
    draft = get_agency_notice_draft(draft_id)
    target_version_id = version_id or draft.current_version_id
    if not target_version_id:
        raise AnalysisError("댓글을 연결할 공고 버전이 없습니다.")
    if target_version_id not in {version.id for version in draft.versions}:
        raise AnalysisError("댓글을 연결할 버전을 찾을 수 없습니다.")
    draft.comments.append(
        ApprovalComment(
            id=f"comment-{uuid4()}",
            draft_id=draft.id,
            version_id=target_version_id,
            section_id=section_id,
            author_id=author_id,
            author_name=author_name,
            body=body.strip(),
        )
    )
    draft.audit_events.append(_audit(draft.id, author_id, "comment_added", "검토 댓글을 추가했습니다."))
    draft.updated_at = utc_now_iso()
    _save(draft)
    return draft


def transition_agency_notice(
    draft_id: str,
    target_status: str,
    actor_id: str = "demo-user",
    note: str = "",
) -> AgencyNoticeDraft:
    draft = get_agency_notice_draft(draft_id)
    if target_status == "under_review":
        _assert_review_ready(draft)
    if target_status == "published" and draft.status != "approved":
        raise AnalysisError("공고는 approved 상태가 된 뒤에만 published로 전환할 수 있습니다.")
    allowed = ALLOWED_TRANSITIONS.get(draft.status, set())
    if target_status not in allowed:
        raise AnalysisError(f"{draft.status} 상태에서 {target_status} 상태로 전환할 수 없습니다.")

    draft.status = target_status  # type: ignore[assignment]
    draft.approval_workflow.status = target_status  # type: ignore[assignment]
    _apply_step_transition(draft, target_status, note)
    draft.audit_events.append(
        _audit(draft.id, actor_id, f"status_{target_status}", note or f"공고 상태를 {target_status}(으)로 전환했습니다.")
    )
    draft.updated_at = utc_now_iso()
    _save(draft)
    return draft


def agency_notice_to_notice_document(draft: AgencyNoticeDraft) -> NoticeDocument:
    document_model = _blocks_to_document_model(draft) if draft.blocks else None
    return NoticeDocument(
        documentType=f"agency_notice:{draft.recipe_id}",
        title=draft.title,
        organization=draft.brief.agency_name or draft.brief.lab_name or "기관명 확인 필요",
        purpose=draft.brief.program_purpose or draft.brief.lab_intro or "사업 목적 확인 필요",
        applicationMethod=draft.brief.submission_method or "신청 방법 확인 필요",
        sections=[
            NoticeSection(heading=f"{index}. {section.title}", body=section.content_markdown)
            for index, section in enumerate(draft.sections, start=1)
        ],
        schedule={
            "applicationPeriod": draft.brief.application_deadline or draft.brief.program_period,
            "eventPeriod": draft.brief.activity_period or draft.brief.program_period,
        },
        contact={"department": draft.brief.contact or "문의처 확인 필요", "phone": "", "email": ""},
        attachments=draft.brief.required_documents or ["제출서류 확인 필요"],
        documentModel=document_model,
    )


def _clean_value(value: object, fallback: str = "확인 필요") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def _field_evidence_id(field_name: str) -> str:
    return f"brief:{field_name}"


def _existing_evidence_ids(field_names: list[str], evidence: list[AgencySourceEvidence]) -> list[str]:
    available = {item.id for item in evidence}
    return [_field_evidence_id(field_name) for field_name in field_names if _field_evidence_id(field_name) in available]


def _lab_confirmation_items(brief: AgencyNoticeBrief) -> list[str]:
    required_fields = [
        ("lab_name", "연구실/팀 이름"),
        ("target_applicants", "모집 대상"),
        ("activities", "활동 내용"),
        ("submission_method", "지원 방법"),
        ("contact", "문의처"),
    ]
    items = [
        f"{label}을(를) 확인해 주세요."
        for field_name, label in required_fields
        if not str(getattr(brief, field_name, "") or "").strip()
    ]
    return list(dict.fromkeys(items))


def _build_lab_recruitment_sections(
    brief: AgencyNoticeBrief,
    evidence: list[AgencySourceEvidence],
    confirmation_required: list[str],
) -> list[AgencyNoticeSection]:
    section_specs = [
        (
            "overview",
            "모집 개요",
            [
                ("연구실/팀", brief.lab_name or brief.agency_name),
                ("연구 주제", brief.research_topics),
                ("모집 대상", brief.target_applicants),
                ("모집 인원", brief.openings),
            ],
            ["lab_name", "agency_name", "research_topics", "target_applicants", "openings"],
        ),
        (
            "lab_intro",
            "연구실 소개",
            [("소개", brief.lab_intro), ("참고 사항", brief.notes)],
            ["lab_intro", "notes"],
        ),
        (
            "activities",
            "활동 내용",
            [
                ("주요 활동", brief.activities),
                ("활동 기간", brief.activity_period),
                ("예상 참여 시간", brief.weekly_commitment),
            ],
            ["activities", "activity_period", "weekly_commitment"],
        ),
        (
            "eligibility",
            "지원 자격",
            [
                ("필수 자격", brief.required_qualifications),
                ("우대 사항", brief.preferred_qualifications),
            ],
            ["required_qualifications", "preferred_qualifications"],
        ),
        (
            "application",
            "지원 방법 및 제출서류",
            [
                ("지원 방법", brief.submission_method),
                ("제출서류", "\n".join(f"- {item}" for item in brief.required_documents)),
                ("마감일", brief.application_deadline),
            ],
            ["submission_method", "required_documents", "application_deadline"],
        ),
        (
            "contact",
            "문의처",
            [("문의처", brief.contact)],
            ["contact"],
        ),
    ]
    sections: list[AgencyNoticeSection] = []
    for order, (section_id, title, pairs, fields) in enumerate(section_specs, start=1):
        lines = [f"### {title}"]
        section_confirmations: list[str] = []
        for label, value in pairs:
            cleaned = str(value or "").strip()
            if cleaned:
                lines.append(f"- {label}: {cleaned}")
            else:
                lines.append(f"- {label}: 확인 필요")
                section_confirmations.append(f"{title}의 {label}을(를) 확인해 주세요.")
        source_ids = _existing_evidence_ids(fields, evidence)
        sections.append(
            AgencyNoticeSection(
                id=section_id,
                title=title,
                content_markdown="\n".join(lines),
                order=order,
                source_evidence_ids=source_ids,
                source_traces=_source_traces(source_ids, evidence),
                confirmation_required=list(dict.fromkeys(section_confirmations)),
            )
        )
    if confirmation_required:
        sections[0].confirmation_required = list(dict.fromkeys(sections[0].confirmation_required + confirmation_required))
    return sections


def _block(
    block_id: str,
    block_type: str,
    title: str,
    fields: list[str],
    evidence: list[AgencySourceEvidence],
    body: str = "",
    rows: list[list[str]] | None = None,
    confirmations: list[str] | None = None,
) -> AgencyNoticeBlock:
    source_ids = _existing_evidence_ids(fields, evidence)
    return AgencyNoticeBlock(
        id=block_id,
        type=block_type,  # type: ignore[arg-type]
        title=title,
        role=block_type,
        body=body,
        rows=rows or [],
        source_evidence_ids=source_ids,
        source_traces=_source_traces(source_ids, evidence),
        confirmation_required=confirmations or [],
    )


def _build_lab_recruitment_blocks(
    brief: AgencyNoticeBrief,
    evidence: list[AgencySourceEvidence],
    confirmation_required: list[str],
) -> list[AgencyNoticeBlock]:
    documents = brief.required_documents or ["제출서류 확인 필요"]
    blocks = [
        _block(
            "title",
            "titleBox",
            brief.title,
            ["title"],
            evidence,
            body=f"{_clean_value(brief.lab_name or brief.agency_name)}에서 함께 연구할 학부연구생을 모집합니다.",
        ),
        _block(
            "overview",
            "infoTable",
            "모집 개요",
            ["lab_name", "agency_name", "research_topics", "target_applicants", "openings"],
            evidence,
            rows=[
                ["항목", "내용"],
                ["연구실/팀", _clean_value(brief.lab_name or brief.agency_name)],
                ["연구 주제", _clean_value(brief.research_topics)],
                ["모집 대상", _clean_value(brief.target_applicants)],
                ["모집 인원", _clean_value(brief.openings)],
            ],
        ),
        _block(
            "lab-intro",
            "noticeBox",
            "연구실 소개",
            ["lab_intro", "notes"],
            evidence,
            body=_clean_value(brief.lab_intro, "연구실 소개 확인 필요"),
        ),
        _block(
            "activities",
            "infoTable",
            "활동 내용",
            ["activities", "activity_period", "weekly_commitment"],
            evidence,
            rows=[
                ["항목", "내용"],
                ["주요 활동", _clean_value(brief.activities)],
                ["활동 기간", _clean_value(brief.activity_period)],
                ["예상 참여 시간", _clean_value(brief.weekly_commitment)],
            ],
        ),
        _block(
            "eligibility",
            "eligibilityTable",
            "지원 자격",
            ["required_qualifications", "preferred_qualifications"],
            evidence,
            rows=[
                ["구분", "내용"],
                ["필수", _clean_value(brief.required_qualifications)],
                ["우대", _clean_value(brief.preferred_qualifications)],
            ],
        ),
        _block(
            "application",
            "documentListTable",
            "지원 방법 및 제출서류",
            ["submission_method", "required_documents", "application_deadline"],
            evidence,
            rows=[
                ["구분", "내용"],
                ["지원 방법", _clean_value(brief.submission_method)],
                ["마감일", _clean_value(brief.application_deadline)],
                *[[str(index), item] for index, item in enumerate(documents, start=1)],
            ],
        ),
        _block(
            "contact",
            "contactBox",
            "문의처",
            ["contact"],
            evidence,
            rows=[["항목", "내용"], ["문의처", _clean_value(brief.contact)]],
        ),
    ]
    if confirmation_required:
        blocks[0].confirmation_required = confirmation_required
    return blocks


def _blocks_to_document_model(draft: AgencyNoticeDraft) -> dict[str, object]:
    now = utc_now_iso()
    model_blocks: list[dict[str, object]] = []
    for block in draft.blocks:
        if block.type == "titleBox":
            model_blocks.append(
                {
                    "id": f"{block.id}-heading",
                    "type": "heading",
                    "text": block.title or draft.title,
                    "level": 1,
                    "style": {"align": "center", "fontSize": 22, "bold": True},
                    "editable": True,
                }
            )
            if block.body:
                model_blocks.append(
                    {
                        "id": f"{block.id}-body",
                        "type": "paragraph",
                        "text": block.body,
                        "style": {"align": "center", "fontSize": 12, "lineHeight": 1.6},
                        "editable": True,
                    }
                )
            continue
        if block.type in {"infoTable", "scheduleTable", "eligibilityTable", "procedureTable", "documentListTable", "contactBox"}:
            if block.title:
                model_blocks.append(
                    {
                        "id": f"{block.id}-heading",
                        "type": "heading",
                        "text": block.title,
                        "level": 2,
                        "style": {"align": "left", "fontSize": 15, "bold": True},
                        "editable": True,
                    }
                )
            model_blocks.append(_table_model_block(block))
            continue
        if block.type == "noticeBox":
            model_blocks.append(
                {
                    "id": f"{block.id}-heading",
                    "type": "heading",
                    "text": block.title,
                    "level": 2,
                    "style": {"align": "left", "fontSize": 15, "bold": True},
                    "editable": True,
                }
            )
            model_blocks.append(
                {
                    "id": f"{block.id}-body",
                    "type": "paragraph",
                    "text": block.body or "확인 필요",
                    "style": {"align": "left", "fontSize": 12, "lineHeight": 1.7, "marginTop": 8},
                    "editable": True,
                }
            )
            continue
        model_blocks.append(
            {
                "id": block.id,
                "type": "paragraph",
                "text": block.body or block.title or "확인 필요",
                "editable": True,
            }
        )
    return {
        "id": f"{draft.id}-document-model",
        "title": draft.title,
        "pages": [{"id": "agency-page-1", "blocks": model_blocks}],
        "metadata": {
            "documentType": f"agency_notice:{draft.recipe_id}",
            "createdAt": draft.created_at or now,
            "updatedAt": draft.updated_at or now,
        },
    }


def _table_model_block(block: AgencyNoticeBlock) -> dict[str, object]:
    rows = block.rows or [["항목", "내용"], [block.title, block.body or "확인 필요"]]
    return {
        "id": block.id,
        "type": "table",
        "style": {"borderCollapse": True, "width": "100%"},
        "rows": [
            {
                "cells": [
                    {
                        "id": f"{block.id}-r{row_index}-c{cell_index}",
                        "text": cell,
                        "align": "center" if row_index == 0 or cell_index == 0 else "left",
                        "verticalAlign": "middle",
                        "background": "#f1f5f2" if row_index == 0 or cell_index == 0 else None,
                        "editable": True,
                    }
                    for cell_index, cell in enumerate(row)
                ]
            }
            for row_index, row in enumerate(rows)
        ],
    }


def _save(draft: AgencyNoticeDraft) -> None:
    storage.save_agency_notice_draft(draft.id, draft.model_dump(mode="json"))


def _build_source_evidence(brief: AgencyNoticeBrief) -> list[AgencySourceEvidence]:
    evidence: list[AgencySourceEvidence] = []
    field_labels = {
        "title": "공고명",
        "agency_name": "기관명",
        "program_purpose": "사업 목적",
        "budget": "예산",
        "program_period": "사업 기간",
        "eligibility_rules": "신청 자격",
        "support_details": "지원 내용",
        "evaluation_criteria": "평가 기준",
        "submission_method": "신청 방법",
        "contact": "문의처",
        "required_documents": "제출 서류",
        "legal_basis": "법적 근거",
        "privacy_policy": "개인정보 처리방침",
        "fair_competition_clause": "공정경쟁 문구",
        "appeal_process": "이의신청 절차",
        "lab_name": "연구실/팀 이름",
        "lab_intro": "연구실 소개",
        "research_topics": "연구 주제",
        "target_applicants": "모집 대상",
        "openings": "모집 인원",
        "activities": "활동 내용",
        "required_qualifications": "필수 자격",
        "preferred_qualifications": "우대 사항",
        "activity_period": "활동 기간",
        "weekly_commitment": "예상 참여 시간",
        "application_deadline": "지원 마감일",
        "notes": "참고 사항",
    }
    for field_name, label in field_labels.items():
        raw_value = getattr(brief, field_name, "")
        value = "\n".join(raw_value) if isinstance(raw_value, list) else str(raw_value or "").strip()
        if value:
            evidence.append(
                AgencySourceEvidence(
                    id=f"brief:{field_name}",
                    label=label,
                    quote=value[:500],
                    source_type="brief",
                    confidence=0.95,
                )
            )
    for reference in brief.references:
        text = reference.text.strip()
        if not text:
            continue
        evidence.append(
            AgencySourceEvidence(
                id=f"reference:{reference.id}",
                label=reference.evidence_label or reference.title or reference.filename or "기준 문서",
                quote=text[:500],
                source_type=reference.source_type,
                confidence=0.75,
            )
        )
    return evidence


def _build_clause_checks(
    brief: AgencyNoticeBrief,
    evidence: list[AgencySourceEvidence],
) -> list[MandatoryClauseCheck]:
    checks: list[MandatoryClauseCheck] = []
    for entry in required_clause_entries(brief.organization_id, brief.program_type):
        field_name = CLAUSE_FIELD_NAMES.get(entry.clause_type)
        direct_value = str(getattr(brief, field_name, "") or "").strip() if field_name else ""
        evidence_ids = [f"brief:{field_name}"] if direct_value and field_name else _reference_evidence_for_clause(entry, evidence)
        if evidence_ids:
            checks.append(
                MandatoryClauseCheck(
                    id=entry.clause_type,
                    label=entry.label,
                    status="satisfied",
                    note=f"{entry.label} 근거가 확인되었습니다.",
                    source_evidence_ids=evidence_ids,
                    source_traces=_source_traces(evidence_ids, evidence),
                )
            )
        elif entry.template_text.strip():
            checks.append(
                MandatoryClauseCheck(
                    id=entry.clause_type,
                    label=entry.label,
                    status="needs_confirmation",
                    note=f"{entry.label} 기본 문구는 있으나 기관 담당자 확인이 필요합니다.",
                    confirmation_required=[f"{entry.label} 문구와 출처를 확인해 주세요."],
                )
            )
        else:
            checks.append(
                MandatoryClauseCheck(
                    id=entry.clause_type,
                    label=entry.label,
                    status="missing",
                    note=f"{entry.label} 필수 조항이 누락되었습니다.",
                )
            )
    return checks


def _reference_evidence_for_clause(entry: ClauseLibraryEntry, evidence: Iterable[AgencySourceEvidence]) -> list[str]:
    terms = {
        "법적 근거": ["법", "근거", "조례", "규정", "고시"],
        "개인정보 처리방침": ["개인정보", "수집", "이용", "동의"],
        "공정경쟁 문구": ["공정", "부정", "제재", "허위", "중복"],
        "이의신청 절차": ["이의", "재심", "소명", "통보"],
    }.get(entry.label, [entry.label, entry.clause_type])
    matches = []
    for item in evidence:
        haystack = f"{item.label}\n{item.quote}"
        if any(term in haystack for term in terms):
            matches.append(item.id)
    return matches


def _confirmation_items(brief: AgencyNoticeBrief, clause_checks: list[MandatoryClauseCheck]) -> list[str]:
    items: list[str] = []
    required_fields = [
        ("budget", "예산 규모"),
        ("program_period", "사업 기간"),
        ("eligibility_rules", "신청 자격"),
        ("evaluation_criteria", "평가 기준"),
        ("submission_method", "신청 방법"),
    ]
    for field_name, label in required_fields:
        if not str(getattr(brief, field_name, "") or "").strip():
            items.append(f"{label}을 확인해 주세요.")
    for check in clause_checks:
        items.extend(check.confirmation_required)
    return list(dict.fromkeys(items))


def _build_sections(
    brief: AgencyNoticeBrief,
    evidence: list[AgencySourceEvidence],
    confirmation_required: list[str],
    clause_checks: list[MandatoryClauseCheck],
) -> list[AgencyNoticeSection]:
    required_docs = "\n".join(f"- {item}" for item in brief.required_documents) or "- 제출서류 확인 필요"
    clause_lines = "\n".join(f"- {check.label}: {check.note}" for check in clause_checks)
    section_payloads = {
        "overview": [
            ("사업 목적", brief.program_purpose),
            ("사업 기간", brief.program_period),
            ("예산 규모", brief.budget),
            ("법적 근거", brief.legal_basis),
        ],
        "support": [("지원 내용", brief.support_details), ("예산 규모", brief.budget)],
        "eligibility": [("신청 자격", brief.eligibility_rules)],
        "documents": [("제출 서류", required_docs)],
        "evaluation": [("평가 기준", brief.evaluation_criteria)],
        "schedule": [("사업 기간", brief.program_period)],
        "submission": [("신청 방법", brief.submission_method)],
        "contact": [("문의처", brief.contact)],
        "clauses": [("필수 조항", clause_lines)],
    }
    section_evidence_fields = {
        "overview": ["brief:program_purpose", "brief:program_period", "brief:budget", "brief:legal_basis"],
        "support": ["brief:support_details", "brief:budget"],
        "eligibility": ["brief:eligibility_rules"],
        "documents": ["brief:required_documents"],
        "evaluation": ["brief:evaluation_criteria"],
        "schedule": ["brief:program_period"],
        "submission": ["brief:submission_method"],
        "contact": ["brief:contact"],
        "clauses": [item for check in clause_checks for item in check.source_evidence_ids],
    }
    sections: list[AgencyNoticeSection] = []
    for order, (section_id, title) in enumerate(SECTION_ORDER, start=1):
        pairs = section_payloads[section_id]
        lines = [f"### {title}"]
        section_confirmations: list[str] = []
        for label, value in pairs:
            cleaned = str(value or "").strip()
            if cleaned:
                lines.append(f"- {label}: {cleaned}")
            else:
                lines.append(f"- {label}: 확인 필요")
                section_confirmations.append(f"{title}의 {label}을 확인해 주세요.")
        if section_id == "clauses":
            section_confirmations.extend(
                item
                for check in clause_checks
                for item in check.confirmation_required
            )
        source_ids = [item for item in section_evidence_fields.get(section_id, []) if any(e.id == item for e in evidence)]
        sections.append(
            AgencyNoticeSection(
                id=section_id,
                title=title,
                content_markdown="\n".join(lines),
                order=order,
                source_evidence_ids=source_ids[:10],
                source_traces=_source_traces(source_ids[:10], evidence),
                confirmation_required=list(dict.fromkeys(section_confirmations)),
            )
        )
    if confirmation_required:
        sections[0].confirmation_required = list(dict.fromkeys(sections[0].confirmation_required + confirmation_required))
    return sections


def _source_traces(evidence_ids: list[str], evidence: list[AgencySourceEvidence]) -> list[AgencySourceTrace]:
    evidence_by_id = {item.id: item for item in evidence}
    traces: list[AgencySourceTrace] = []
    for evidence_id in evidence_ids:
        item = evidence_by_id.get(evidence_id)
        if not item:
            continue
        field_name = evidence_id.split("brief:", 1)[1] if evidence_id.startswith("brief:") else None
        reference_id = evidence_id.split("reference:", 1)[1] if evidence_id.startswith("reference:") else None
        traces.append(
            AgencySourceTrace(
                evidence_id=item.id,
                label=item.label,
                quote=item.quote,
                source_type=item.source_type,
                field_name=field_name,
                reference_id=reference_id,
                confidence=item.confidence,
            )
        )
    return traces


def _assert_review_ready(draft: AgencyNoticeDraft) -> None:
    missing = [check.label for check in draft.mandatory_clause_checks if check.status == "missing"]
    if missing:
        raise AnalysisError(f"필수 조항이 누락되어 검토 요청을 할 수 없습니다: {', '.join(missing)}")


def _default_approval_workflow(draft_id: str) -> ApprovalWorkflow:
    return ApprovalWorkflow(
        status="draft",
        current_step_order=1,
        steps=[
            ApprovalStep(
                id=f"step-{uuid4()}",
                draft_id=draft_id,
                step_order=1,
                title="담당자 검토",
                role="staff",
                status="active",
            ),
            ApprovalStep(
                id=f"step-{uuid4()}",
                draft_id=draft_id,
                step_order=2,
                title="팀장 검토",
                role="lead",
            ),
            ApprovalStep(
                id=f"step-{uuid4()}",
                draft_id=draft_id,
                step_order=3,
                title="기관장 승인",
                role="approver",
            ),
        ],
    )


def _apply_step_transition(draft: AgencyNoticeDraft, target_status: str, note: str) -> None:
    now = utc_now_iso()
    active = next((step for step in draft.approval_workflow.steps if step.status == "active"), None)
    if target_status == "under_review":
        if active:
            active.status = "approved"
            active.decided_at = now
            active.decision_note = note
        next_step = _step_by_order(draft, 2)
        if next_step:
            next_step.status = "active"
            draft.approval_workflow.current_step_order = next_step.step_order
    elif target_status == "approving":
        if active:
            active.status = "approved"
            active.decided_at = now
            active.decision_note = note
        next_step = _step_by_order(draft, 3)
        if next_step:
            next_step.status = "active"
            draft.approval_workflow.current_step_order = next_step.step_order
    elif target_status == "approved":
        if active:
            active.status = "approved"
            active.decided_at = now
            active.decision_note = note
        draft.approval_workflow.current_step_order = 3
    elif target_status == "revision_requested":
        if active:
            active.status = "changes_requested"
            active.decided_at = now
            active.decision_note = note
        first_step = _step_by_order(draft, 1)
        if first_step:
            first_step.status = "active"
            draft.approval_workflow.current_step_order = 1
    elif target_status == "published":
        for step in draft.approval_workflow.steps:
            if step.status == "active":
                step.status = "approved"
                step.decided_at = now
                step.decision_note = note


def _step_by_order(draft: AgencyNoticeDraft, order: int) -> ApprovalStep | None:
    return next((step for step in draft.approval_workflow.steps if step.step_order == order), None)


def _audit(draft_id: str, actor_id: str, action: str, message: str) -> NoticeAuditEvent:
    return NoticeAuditEvent(
        id=f"audit-{uuid4()}",
        draft_id=draft_id,
        actor_id=actor_id,
        action=action,
        message=message,
    )
