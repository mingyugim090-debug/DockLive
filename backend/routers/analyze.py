import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from core.config import settings
from core.errors import FileTooLargeError, InvalidFileTypeError
from models.schemas import AnalysisResponse, AnalysisResult
from services import storage
from services.analyzer import build_analysis_result
from services.drafting_service import create_workflow_session
from services.mock_data import get_mock_result
from services.openai_service import analyze_announcement
from services.pdf_parser import extract_text_from_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


def persist_analysis_and_workflow(result: AnalysisResult) -> None:
    storage.save_result(result.id, result.model_dump(mode="json"))
    workflow = create_workflow_session(result)
    storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_document(file: UploadFile = File(...)):
    """Analyze an uploaded PDF announcement and create a workflow session."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise InvalidFileTypeError()

    contents = await file.read()
    max_bytes = settings.MAX_PDF_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise FileTooLargeError(settings.MAX_PDF_SIZE_MB)

    text = extract_text_from_pdf(contents, file.filename)
    logger.info(f"PDF text extracted: {file.filename} ({len(text)} chars)")

    use_mock = (
        not settings.OPENAI_API_KEY
        or settings.OPENAI_API_KEY == "your_api_key_here"
        or settings.OPENAI_API_KEY.startswith("mock")
        or settings.MOCK_MODE
    )

    if use_mock:
        logger.info("MOCK mode: using sample analysis data")
        raw_result = get_mock_result()
    else:
        logger.info("OpenAI analysis started")
        raw_result = analyze_announcement(text)

    result = build_analysis_result(raw_result)
    logger.info(
        f"Analysis complete: id={result.id} type={result.doc_type} "
        f"timeline={len(result.timeline)} checklist={len(result.checklist)} "
        f"sections={len(result.document_template)}"
    )

    persist_analysis_and_workflow(result)
    return AnalysisResponse(success=True, data=result)


@router.get("/result/{result_id}", response_model=AnalysisResponse)
async def get_result(result_id: str):
    """Load a stored analysis result by id."""
    data = storage.load_result(result_id)
    if data is None:
        logger.warning(f"Analysis result not found: {result_id}")
        raise HTTPException(
            status_code=404,
            detail="분석 결과를 찾을 수 없습니다. 링크가 만료되었거나 서버가 재시작되었을 수 있습니다.",
        )
    try:
        result = AnalysisResult(**data)
        return AnalysisResponse(success=True, data=result)
    except Exception as e:
        logger.error(f"Failed to restore analysis result {result_id}: {e}")
        raise HTTPException(status_code=500, detail="분석 결과 데이터를 복원하지 못했습니다.")
