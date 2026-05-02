from fastapi import APIRouter

from models.schemas import AnalysisResponse
from routers.analyze import persist_analysis_and_workflow
from services.analyzer import build_analysis_result
from services.mock_data import get_mock_result

router = APIRouter()
_demo_cache: dict = {}


@router.get("/demo", response_model=AnalysisResponse)
async def get_demo_result():
    """Return a fixed demo analysis and create its workflow session."""
    demo_id = "demo-fixed"

    if demo_id not in _demo_cache:
        raw = get_mock_result()
        result = build_analysis_result(raw)
        result.id = demo_id
        _demo_cache[demo_id] = result
        persist_analysis_and_workflow(result)

    return AnalysisResponse(success=True, data=_demo_cache[demo_id])
