import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import AnalysisResponse, AnalysisResult
from services.pdf_parser import extract_text_from_pdf
from services.claude_service import analyze_announcement
from services.analyzer import build_analysis_result
from services.mock_data import get_mock_result
from services import storage
from core.config import settings
from core.errors import FileTooLargeError, InvalidFileTypeError

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_document(file: UploadFile = File(...)):
    """PDF 공고문을 업로드하여 AI 분석 결과를 반환합니다."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise InvalidFileTypeError()

    contents = await file.read()
    max_bytes = settings.MAX_PDF_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise FileTooLargeError(settings.MAX_PDF_SIZE_MB)

    text = extract_text_from_pdf(contents, file.filename)
    logger.info(f"PDF 추출 완료: {file.filename} ({len(text)}자)")

    use_mock = (
        not settings.OPENAI_API_KEY
        or settings.OPENAI_API_KEY == "your_api_key_here"
        or settings.OPENAI_API_KEY.startswith("mock")
        or getattr(settings, "MOCK_MODE", False)
    )

    if use_mock:
        logger.info("MOCK 모드: 샘플 데이터 사용")
        raw_result = get_mock_result()
    else:
        logger.info("OpenAI 분석 시작")
        raw_result = analyze_announcement(text)

    result = build_analysis_result(raw_result)
    logger.info(
        f"분석 완료: id={result.id} type={result.doc_type} "
        f"timeline={len(result.timeline)} checklist={len(result.checklist)} "
        f"sections={len(result.document_template)}"
    )

    storage.save_result(result.id, result.model_dump(mode="json"))
    return AnalysisResponse(success=True, data=result)


@router.get("/result/{result_id}", response_model=AnalysisResponse)
async def get_result(result_id: str):
    """분석 결과 ID로 결과를 조회합니다."""
    data = storage.load_result(result_id)
    if data is None:
        logger.warning(f"결과 없음: {result_id}")
        raise HTTPException(
            status_code=404,
            detail="분석 결과를 찾을 수 없습니다. 링크가 만료되었거나 서버가 재시작되었을 수 있습니다.",
        )
    try:
        result = AnalysisResult(**data)
        return AnalysisResponse(success=True, data=result)
    except Exception as e:
        logger.error(f"결과 역직렬화 오류 {result_id}: {e}")
        raise HTTPException(status_code=500, detail="결과 데이터 복원에 실패했습니다.")
