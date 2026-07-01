from __future__ import annotations

from uuid import uuid4

from core.errors import AnalysisError
from models.schemas import ClauseLibraryEntry, ClauseLibraryEntryRequest, utc_now_iso
from services import storage


DEFAULT_REQUIRED_PROGRAM_TYPES = ["support_program", "rnd_program", "all"]

DEFAULT_CLAUSES = [
    {
        "clause_type": "legal_basis",
        "label": "법적 근거",
        "template_text": "사업 추진 근거 법령 또는 조례 조항을 기관 담당자가 확인해 입력해야 합니다.",
    },
    {
        "clause_type": "privacy_policy",
        "label": "개인정보 처리방침",
        "template_text": "신청자 개인정보 수집, 이용 목적, 보유 기간, 동의 절차는 기관 기준 문구로 확인해야 합니다.",
    },
    {
        "clause_type": "fair_competition",
        "label": "공정경쟁 문구",
        "template_text": "허위 제출, 중복 수혜, 부정행위 제재 기준은 기관 기준 문구로 확인해야 합니다.",
    },
    {
        "clause_type": "appeal_process",
        "label": "이의신청 절차",
        "template_text": "평가 결과 통보 후 이의신청 가능 기간과 접수 방법은 기관 기준 문구로 확인해야 합니다.",
    },
]


def list_clause_library_entries(
    organization_id: str,
    program_type: str | None = None,
) -> list[ClauseLibraryEntry]:
    entries_by_type = {
        item["clause_type"]: ClauseLibraryEntry(
            id=f"default-{organization_id}-{item['clause_type']}",
            organization_id=organization_id,
            clause_type=item["clause_type"],
            label=item["label"],
            required_for_program_types=DEFAULT_REQUIRED_PROGRAM_TYPES,
            template_text=item["template_text"],
            source="org_default",
            active=True,
        )
        for item in DEFAULT_CLAUSES
    }

    for payload in storage.list_clause_library_entries(organization_id):
        entry = ClauseLibraryEntry.model_validate(payload)
        entries_by_type[entry.clause_type] = entry

    entries = list(entries_by_type.values())
    if program_type:
        entries = [entry for entry in entries if _is_required_for(entry, program_type)]
    return sorted(entries, key=lambda entry: entry.label)


def required_clause_entries(organization_id: str, program_type: str) -> list[ClauseLibraryEntry]:
    return [
        entry
        for entry in list_clause_library_entries(organization_id)
        if entry.active and _is_required_for(entry, program_type)
    ]


def create_clause_library_entry(request: ClauseLibraryEntryRequest) -> ClauseLibraryEntry:
    if not request.clause_type.strip() or not request.label.strip():
        raise AnalysisError("조항 유형과 이름은 필수입니다.")
    entry = ClauseLibraryEntry(
        id=f"clause-{uuid4()}",
        organization_id=request.organization_id,
        clause_type=request.clause_type.strip(),
        label=request.label.strip(),
        required_for_program_types=list(dict.fromkeys(request.required_for_program_types or ["all"])),
        template_text=request.template_text.strip(),
        source=request.source,
        active=request.active,
    )
    storage.save_clause_library_entry(entry.id, entry.model_dump(mode="json"))
    return entry


def update_clause_library_entry(entry_id: str, request: ClauseLibraryEntryRequest) -> ClauseLibraryEntry:
    existing = storage.load_clause_library_entry(entry_id)
    if not existing:
        raise AnalysisError("수정할 조항 라이브러리 항목을 찾을 수 없습니다.")
    current = ClauseLibraryEntry.model_validate(existing)
    updated = ClauseLibraryEntry(
        id=current.id,
        organization_id=current.organization_id,
        clause_type=request.clause_type.strip() or current.clause_type,
        label=request.label.strip() or current.label,
        required_for_program_types=list(dict.fromkeys(request.required_for_program_types or current.required_for_program_types)),
        template_text=request.template_text.strip(),
        source=request.source,
        active=request.active,
        created_at=current.created_at,
        updated_at=utc_now_iso(),
    )
    storage.save_clause_library_entry(updated.id, updated.model_dump(mode="json"))
    return updated


def _is_required_for(entry: ClauseLibraryEntry, program_type: str) -> bool:
    required = {item.strip() for item in entry.required_for_program_types if item.strip()}
    return "all" in required or program_type in required
