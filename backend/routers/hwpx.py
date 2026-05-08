import base64
import re
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from core.errors import AnalysisError
from models.schemas import HwpxComposeResponse
from services.hwpx_compose_service import compose_hwpx

router = APIRouter()

EXPORT_ROOT = Path(__file__).resolve().parents[2] / "outputs" / "hwpx_exports"
HWPX_MEDIA_TYPE = "application/vnd.hancom.hwpx"


@router.post("/hwpx/compose", response_model=HwpxComposeResponse)
async def compose_hwpx_document(
    template: UploadFile = File(...),
    request_text: str = Form(...),
    applicant_context: str = Form(""),
    title: str = Form(""),
):
    if not template.filename or not template.filename.lower().endswith(".hwpx"):
        raise AnalysisError("HWPX 양식 파일만 업로드할 수 있습니다.")

    result = compose_hwpx(
        await template.read(),
        request_text=request_text,
        applicant_context=applicant_context,
        title=title,
    )
    download_id = _persist_hwpx_export(result)
    result["download_id"] = download_id
    result["download_url"] = f"/api/hwpx/download/{download_id}?filename={quote(result['filename'], safe='')}"
    return HwpxComposeResponse(**result)


@router.get("/hwpx/download/{download_id}")
async def download_hwpx_file(download_id: str, filename: str = "livedock_hwpx_export.hwpx"):
    if not re.fullmatch(r"[a-f0-9]{32}", download_id):
        raise AnalysisError("올바르지 않은 HWPX 다운로드 ID입니다.")

    path = EXPORT_ROOT / f"{download_id}.hwpx"
    if not path.exists():
        raise AnalysisError("다운로드할 HWPX 파일을 찾을 수 없습니다. 다시 생성해 주세요.")

    return FileResponse(
        path,
        media_type=HWPX_MEDIA_TYPE,
        filename=_safe_download_filename(filename),
    )


def _persist_hwpx_export(result: dict) -> str:
    if result.get("encoding") != "base64" or not result.get("content"):
        raise AnalysisError("HWPX 생성 결과에 다운로드 가능한 파일 내용이 없습니다.")

    download_id = uuid.uuid4().hex
    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    (EXPORT_ROOT / f"{download_id}.hwpx").write_bytes(base64.b64decode(result["content"]))
    return download_id


def _safe_download_filename(filename: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]+', "_", filename).strip().strip(".")
    if not safe.lower().endswith(".hwpx"):
        safe = f"{safe or 'livedock_hwpx_export'}.hwpx"
    return safe
