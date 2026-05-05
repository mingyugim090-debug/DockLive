import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.config import settings
from core.errors import FileTooLargeError, InvalidFileTypeError
from models.schemas import (
    AnalysisResponse,
    AnalysisResult,
    AnalyzeTextRequest,
    AnalyzeUrlRequest,
    CompanyProfile,
    MatchReport,
)
from services import storage
from services.analyzer import build_analysis_result
from services.ai_provider import provider_name, should_use_mock_ai
from services.drafting_service import create_workflow_session
from services.mock_data import get_mock_result
from services.openai_service import analyze_announcement, evaluate_match
from services.pdf_parser import extract_text_from_pdf
from services.url_ingestion import fetch_announcement_url

logger = logging.getLogger(__name__)
router = APIRouter()


def _use_mock() -> bool:
    return should_use_mock_ai()


def persist_analysis_and_workflow(
    result: AnalysisResult,
    company_profile: CompanyProfile | None = None,
    match_report: MatchReport | None = None,
) -> None:
    storage.save_result(result.id, result.model_dump(mode="json"))
    workflow = create_workflow_session(result, company_profile, match_report)
    storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))


def _analyze_text(
    text: str,
    source_type: str,
    source_name: str,
    company_profile: CompanyProfile | None = None,
) -> tuple[AnalysisResult, MatchReport | None]:
    if _use_mock():
        logger.info("MOCK mode: using sample analysis data")
        raw_result = get_mock_result()
    else:
        logger.info("%s analysis started", provider_name())
        raw_result = analyze_announcement(text, source_name=source_name)

    result = build_analysis_result(raw_result, source_type=source_type, source_name=source_name)
    match_report = None
    if company_profile:
        match_report = MatchReport(**evaluate_match(result.model_dump(mode="json"), company_profile))

    logger.info(
        f"Analysis complete: id={result.id} type={result.doc_type} "
        f"timeline={len(result.timeline)} checklist={len(result.checklist)} "
        f"sections={len(result.document_template)}"
    )
    persist_analysis_and_workflow(result, company_profile, match_report)
    return result, match_report


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_document(
    file: UploadFile = File(...),
    company_name: str = Form(""),
    company_industry: str = Form(""),
    company_stage: str = Form(""),
    company_region: str = Form(""),
    company_strengths: str = Form(""),
    company_needs: str = Form(""),
):
    """Analyze an uploaded PDF announcement and create a workflow session."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise InvalidFileTypeError()

    contents = await file.read()
    max_bytes = settings.MAX_PDF_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise FileTooLargeError(settings.MAX_PDF_SIZE_MB)

    text = extract_text_from_pdf(contents, file.filename)
    logger.info(f"PDF text extracted: {file.filename} ({len(text)} chars)")

    profile = _profile_from_form(
        company_name,
        company_industry,
        company_stage,
        company_region,
        company_strengths,
        company_needs,
    )
    result, match_report = _analyze_text(text, "pdf", file.filename, profile)
    return AnalysisResponse(success=True, data=result, match_report=match_report)


@router.post("/analyze/text", response_model=AnalysisResponse)
async def analyze_text(payload: AnalyzeTextRequest):
    """Analyze pasted announcement text."""
    text = payload.text.strip()
    if len(text) < 100:
        raise HTTPException(status_code=400, detail="분석할 공고문 텍스트를 100자 이상 입력해 주세요.")
    source_name = payload.source_name or payload.title or "직접 입력한 공고문"
    result, match_report = _analyze_text(text, "text", source_name, payload.company_profile)
    return AnalysisResponse(success=True, data=result, match_report=match_report)


@router.post("/analyze/url", response_model=AnalysisResponse)
async def analyze_url(payload: AnalyzeUrlRequest):
    """Fetch and analyze an announcement URL."""
    source_name, text = await fetch_announcement_url(payload.url)
    result, match_report = _analyze_text(text, "url", payload.url or source_name, payload.company_profile)
    return AnalysisResponse(success=True, data=result, match_report=match_report)


@router.get("/result/{result_id}", response_model=AnalysisResponse)
async def get_result(result_id: str):
    """Load a stored analysis result by id."""
    data = storage.load_result(result_id)
    if data is None:
        logger.warning(f"Analysis result not found: {result_id}")
        raise HTTPException(
            status_code=404,
            detail="분석 결과를 찾을 수 없습니다. 링크가 만료되었거나 서버가 다시 시작되었을 수 있습니다.",
        )
    try:
        result = AnalysisResult(**data)
        return AnalysisResponse(success=True, data=result)
    except Exception as e:
        logger.error(f"Failed to restore analysis result {result_id}: {e}")
        raise HTTPException(status_code=500, detail="분석 결과 데이터를 복원하지 못했습니다.")


def _profile_from_form(
    name: str,
    industry: str,
    stage: str,
    region: str,
    strengths: str,
    needs: str,
) -> CompanyProfile | None:
    if not any([name, industry, stage, region, strengths, needs]):
        return None
    return CompanyProfile(
        name=name,
        industry=industry,
        stage=stage,
        region=region,
        strengths=strengths,
        needs=needs,
    )
