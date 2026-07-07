import base64

from fastapi import APIRouter, File, Form, UploadFile

from core.errors import AnalysisError
from models.schemas import (
    DocumentWorkspaceResponse,
    ExportResponse,
    GeneratedDocumentResponse,
    InlineTransformRequest,
    VisualBlockResponse,
    WorkspaceAnalyzeRequest,
    WorkspaceCreateRequest,
)
from services import workspace_service
from services.analyzer import build_analysis_result
from services.block_transforms import apply_transform
from services.blueprint_service import build_blueprint, generate_document
from services.mock_data import get_mock_result
from services.workspace_export import (
    export_docx,
    export_hwpx,
    export_pdf,
    render_html,
    render_markdown,
)

router = APIRouter()

_DEMO_BUDGET_CSV = (
    "항목,1차년도,2차년도\n"
    "인건비,42000000,45000000\n"
    "장비비,18000000,6000000\n"
    "마케팅비,9000000,15000000\n"
    "운영비,11000000,12000000\n"
).encode("utf-8")


@router.post("", response_model=DocumentWorkspaceResponse)
async def create_workspace_route(payload: WorkspaceCreateRequest | None = None):
    payload = payload or WorkspaceCreateRequest()
    return DocumentWorkspaceResponse(data=workspace_service.create_workspace(payload.title))


@router.post("/demo", response_model=DocumentWorkspaceResponse)
async def create_demo_workspace():
    """Deterministic demo: mock notice analysis + a real parsed sample CSV."""
    workspace = workspace_service.create_workspace("데모 프로젝트 — 소상공인 디지털전환")
    raw = get_mock_result("business_plan")
    workspace = workspace_service.get_workspace(workspace.id)
    workspace.analysis = build_analysis_result(raw, "demo", "demo-notice")
    workspace.status = "analyzed"
    workspace_service.save_workspace(workspace)
    workspace = workspace_service.add_file(workspace.id, _DEMO_BUDGET_CSV, "demo-예산.csv")
    workspace.status = "analyzed"
    workspace_service.save_workspace(workspace)
    return DocumentWorkspaceResponse(data=workspace)


@router.get("/{workspace_id}", response_model=DocumentWorkspaceResponse)
async def get_workspace_route(workspace_id: str):
    return DocumentWorkspaceResponse(data=workspace_service.get_workspace(workspace_id))


@router.post("/{workspace_id}/files", response_model=DocumentWorkspaceResponse)
async def upload_workspace_file(
    workspace_id: str,
    file: UploadFile = File(...),
    file_kind: str = Form(default=""),
):
    content = await file.read()
    workspace = workspace_service.add_file(workspace_id, content, file.filename or "uploaded_file", file_kind)
    return DocumentWorkspaceResponse(data=workspace)


@router.post("/{workspace_id}/analyze", response_model=DocumentWorkspaceResponse)
async def analyze_workspace(workspace_id: str, payload: WorkspaceAnalyzeRequest | None = None):
    from routers.analyze import _analyze_text

    payload = payload or WorkspaceAnalyzeRequest()
    workspace = workspace_service.get_workspace(workspace_id)

    target = None
    if payload.file_id:
        target = next((item for item in workspace.files if item.id == payload.file_id), None)
        if target is None:
            raise AnalysisError("해당 파일을 찾을 수 없습니다.")
    else:
        target = next((item for item in workspace.files if item.file_kind == "notice" and item.text), None)
        target = target or next((item for item in workspace.files if item.text), None)
    if target is None or not target.text:
        raise AnalysisError("분석할 공고 텍스트가 있는 파일이 없습니다. PDF/HWPX 공고문을 업로드해 주세요.")

    result, _ = await _analyze_text(target.text, target.source_type or "pdf", target.filename)
    workspace.analysis = result
    workspace.status = "analyzed"
    workspace_service.save_workspace(workspace)
    return DocumentWorkspaceResponse(data=workspace)


@router.post("/{workspace_id}/blueprint", response_model=DocumentWorkspaceResponse)
async def build_workspace_blueprint(workspace_id: str):
    workspace = workspace_service.get_workspace(workspace_id)
    build_blueprint(workspace)
    return DocumentWorkspaceResponse(data=workspace_service.get_workspace(workspace_id))


@router.post("/{workspace_id}/generate", response_model=GeneratedDocumentResponse)
async def generate_workspace_document(workspace_id: str):
    workspace = workspace_service.get_workspace(workspace_id)
    return GeneratedDocumentResponse(data=generate_document(workspace))


@router.post("/{workspace_id}/blocks/{block_id}/transform", response_model=VisualBlockResponse)
async def transform_workspace_block(workspace_id: str, block_id: str, payload: InlineTransformRequest):
    return VisualBlockResponse(data=apply_transform(workspace_id, block_id, payload))


@router.get("/{workspace_id}/export/markdown", response_model=ExportResponse)
async def export_workspace_markdown(workspace_id: str):
    workspace = workspace_service.get_workspace(workspace_id)
    if workspace.document is None:
        raise AnalysisError("아직 생성된 문서가 없습니다.")
    return ExportResponse(
        success=True,
        filename=f"{workspace.document.title or 'document'}.md",
        content_type="text/markdown",
        content=render_markdown(workspace.document),
        warnings=list(workspace.document.warnings),
    )


@router.get("/{workspace_id}/export/html", response_model=ExportResponse)
async def export_workspace_html(workspace_id: str):
    workspace = workspace_service.get_workspace(workspace_id)
    if workspace.document is None:
        raise AnalysisError("아직 생성된 문서가 없습니다.")
    return ExportResponse(
        success=True,
        filename=f"{workspace.document.title or 'document'}.html",
        content_type="text/html",
        content=render_html(workspace.document),
        warnings=list(workspace.document.warnings),
    )


_BINARY_EXPORTERS = {
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", export_docx),
    "hwpx": ("application/vnd.hancom.hwpx", export_hwpx),
    "pdf": ("application/pdf", export_pdf),
}


@router.get("/{workspace_id}/export/{export_format}", response_model=ExportResponse)
async def export_workspace_binary(workspace_id: str, export_format: str):
    if export_format not in _BINARY_EXPORTERS:
        raise AnalysisError("지원하지 않는 내보내기 형식입니다.")
    workspace = workspace_service.get_workspace(workspace_id)
    if workspace.document is None:
        raise AnalysisError("아직 생성된 문서가 없습니다.")

    content_type, exporter = _BINARY_EXPORTERS[export_format]
    result = exporter(workspace.document)
    filename, content = result[0], result[1]
    validation_summary = result[2] if len(result) > 2 else {}
    warnings = list(workspace.document.warnings)
    if isinstance(validation_summary, dict):
        warnings.extend(validation_summary.get("warnings", []) or [])
    return ExportResponse(
        success=True,
        filename=filename,
        content_type=content_type,
        content=base64.b64encode(content).decode("ascii"),
        encoding="base64",
        warnings=warnings,
        validation_summary=validation_summary if isinstance(validation_summary, dict) else {},
    )
