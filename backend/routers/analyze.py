from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import AnalysisResponse
from services.pdf_parser import extract_text_from_pdf
from services.claude_service import analyze_announcement
from services.analyzer import build_analysis_result
from services.mock_data import get_mock_result
from core.config import settings
from core.errors import FileTooLargeError, InvalidFileTypeError

router = APIRouter()

# 인메모리 결과 캐시 (MVP)
_results_cache: dict = {}


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_document(file: UploadFile = File(...)):
    """PDF 공고문을 업로드하여 AI 분석 결과를 반환합니다."""

    # 파일 형식 확인
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise InvalidFileTypeError()

    # 파일 크기 확인
    contents = await file.read()
    max_bytes = settings.MAX_PDF_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise FileTooLargeError(settings.MAX_PDF_SIZE_MB)

    # PDF 텍스트 추출
    text = extract_text_from_pdf(contents, file.filename)

    # API 키가 없거나 MOCK 모드이면 샘플 데이터 반환
    use_mock = (
        not settings.OPENAI_API_KEY
        or settings.OPENAI_API_KEY == "your_api_key_here"
        or settings.OPENAI_API_KEY.startswith("mock")
        or getattr(settings, "MOCK_MODE", False)
    )

    if use_mock:
        raw_result = get_mock_result()
    else:
        raw_result = analyze_announcement(text)

    # 후처리 (D-Day 계산, ID 부여)
    result = build_analysis_result(raw_result)

    # 인메모리 캐시 저장
    _results_cache[result.id] = result

    return AnalysisResponse(success=True, data=result)


@router.get("/result/{result_id}", response_model=AnalysisResponse)
async def get_result(result_id: str):
    """분석 결과 ID로 결과를 조회합니다."""
    if result_id not in _results_cache:
        raise HTTPException(
            status_code=404,
            detail="분석 결과를 찾을 수 없습니다. 결과는 서버 재시작 시 초기화됩니다.",
        )
    result = _results_cache[result_id]
    return AnalysisResponse(success=True, data=result)
