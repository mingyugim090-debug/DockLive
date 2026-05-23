from fastapi import APIRouter, Query

from models.schemas import AnalysisResponse
from routers.analyze import persist_analysis_and_workflow
from services.analyzer import build_analysis_result
from services.mock_data import get_mock_result

router = APIRouter()
_demo_cache: dict = {}

_VALID_TYPES = {"startup", "scholarship", "business_plan", "application", "research"}


@router.get("/demo", response_model=AnalysisResponse)
async def get_demo_result(type: str = Query("startup", alias="type")):
    """Return a fixed demo analysis and create its workflow session."""
    doc_type = type if type in _VALID_TYPES else "startup"
    demo_id = f"demo-{doc_type}"

    if demo_id not in _demo_cache:
        raw = get_mock_result(doc_type)
        result = build_analysis_result(raw)
        result.id = demo_id
        _demo_cache[demo_id] = result
        persist_analysis_and_workflow(result)

    return AnalysisResponse(success=True, data=_demo_cache[demo_id])
