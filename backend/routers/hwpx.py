import base64
import re
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from core.errors import AnalysisError
from models.schemas import HwpxComposeResponse, HwpxConvertResponse, HwpxStatusResponse
from services import storage
from services.document_ingestion import convert_hwp_to_hwpx
from services.hwpx_compose_service import compose_hwpx
from services.drafting_service import get_hwpx_toolchain_status

router = APIRouter()

EXPORT_ROOT = Path(__file__).resolve().parents[2] / "outputs" / "hwpx_exports"
HWPX_MEDIA_TYPE = "application/vnd.hancom.hwpx"


@router.get("/hwpx/status", response_model=HwpxStatusResponse)
async def get_hwpx_status():
    return HwpxStatusResponse(**get_hwpx_toolchain_status())


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
    storage.save_export_file(
        "standalone",
        result["filename"],
        base64.b64decode(result["content"]),
        HWPX_MEDIA_TYPE,
        "hwpx_compose",
    )
    download_id = _persist_hwpx_export(result)
    result["download_id"] = download_id
    result["download_url"] = f"/api/hwpx/download/{download_id}?filename={quote(result['filename'], safe='')}"
    return HwpxComposeResponse(**result)


@router.post("/hwpx/convert-hwp", response_model=HwpxConvertResponse)
async def convert_hwp_document(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".hwp"):
        raise AnalysisError("HWP 파일만 변환할 수 있습니다.")

    content, warnings = convert_hwp_to_hwpx(await file.read(), file.filename)
    filename = f"{Path(file.filename).stem}.hwpx"
    result = {
        "success": True,
        "filename": filename,
        "content_type": HWPX_MEDIA_TYPE,
        "content": base64.b64encode(content).decode("ascii"),
        "encoding": "base64",
        "source_filename": file.filename,
        "conversion_method": "convert_hwp.py -> fix_namespaces.py -> validate.py",
        "warnings": warnings,
    }
    download_id = _persist_hwpx_export(result)
    storage.save_export_file("standalone", filename, content, HWPX_MEDIA_TYPE, "hwp_to_hwpx")
    result["warnings"] = warnings + [f"download_id={download_id}"]
    return HwpxConvertResponse(**result)


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
