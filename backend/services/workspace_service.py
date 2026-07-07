"""Document workspace lifecycle: multi-file project intake and state.

Files that cannot be parsed are still recorded with explicit warnings —
content is never invented for them.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from core.errors import AnalysisError
from models.schemas import DocumentWorkspace, ProjectFile, ProjectFileKind
from services import storage
from services.document_ingestion import detect_uploaded_document_type, ingest_uploaded_document
from services.spreadsheet_ingestion import parse_image_stub, parse_spreadsheet

logger = logging.getLogger(__name__)

_SPREADSHEET_SUFFIXES = {".csv", ".xlsx", ".xls"}
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
_DOCUMENT_TYPES = {"pdf", "hwpx", "hwp"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_workspace(title: str = "") -> DocumentWorkspace:
    workspace = DocumentWorkspace(id=f"ws-{uuid4()}", title=title.strip())
    save_workspace(workspace)
    return workspace


def save_workspace(workspace: DocumentWorkspace) -> None:
    workspace.updated_at = _utc_now()
    storage.save_document_workspace(workspace.id, workspace.model_dump(mode="json"))


def get_workspace(workspace_id: str) -> DocumentWorkspace:
    data = storage.load_document_workspace(workspace_id)
    if not data:
        raise AnalysisError("워크스페이스를 찾을 수 없습니다.")
    return DocumentWorkspace.model_validate(data)


def _build_project_file(content: bytes, filename: str, file_kind: str) -> ProjectFile:
    suffix = Path(filename or "").suffix.lower()
    file_id = f"pf-{uuid4()}"

    if suffix in _SPREADSHEET_SUFFIXES:
        sheet_data = parse_spreadsheet(content, filename)
        return ProjectFile(
            id=file_id,
            filename=filename,
            file_kind="spreadsheet",
            source_type=suffix.lstrip("."),
            sheet_data=sheet_data,
            warnings=list(sheet_data.warnings),
        )

    if suffix in _IMAGE_SUFFIXES:
        return ProjectFile(
            id=file_id,
            filename=filename,
            file_kind="image",
            source_type=suffix.lstrip("."),
            warnings=parse_image_stub(filename),
        )

    detected_type, _ = detect_uploaded_document_type(content, filename)
    if detected_type in _DOCUMENT_TYPES:
        try:
            ingested = ingest_uploaded_document(content, filename)
            kind: ProjectFileKind = file_kind if file_kind in ("notice", "reference") else "reference"
            return ProjectFile(
                id=file_id,
                filename=filename,
                file_kind=kind,
                source_type=ingested.source_type,
                text=ingested.text,
                parsed=ingested.parsed,
                warnings=list(ingested.warnings),
            )
        except Exception as e:
            logger.warning(f"Workspace file parse failed for {filename}: {e}")
            return ProjectFile(
                id=file_id,
                filename=filename,
                file_kind="unsupported",
                source_type=detected_type,
                warnings=[f"{filename}: 파일을 읽지 못했습니다 — {e}"],
            )

    return ProjectFile(
        id=file_id,
        filename=filename,
        file_kind="unsupported",
        source_type=suffix.lstrip(".") or "unknown",
        warnings=[f"{filename}: 지원하지 않는 파일 형식입니다. PDF, HWPX, HWP, CSV를 사용해 주세요."],
    )


def add_file(workspace_id: str, content: bytes, filename: str, file_kind: str = "") -> DocumentWorkspace:
    workspace = get_workspace(workspace_id)
    project_file = _build_project_file(content, filename or "uploaded_file", file_kind)
    project_file.workspace_id = workspace.id
    workspace.files.append(project_file)
    if workspace.status == "empty":
        workspace.status = "files_added"
    save_workspace(workspace)
    return workspace
