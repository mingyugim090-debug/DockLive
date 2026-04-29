from fastapi import APIRouter
from models.schemas import AnalysisResponse
from services.mock_data import get_mock_result
from services.analyzer import build_analysis_result

router = APIRouter()

# 인메모리 데모 결과 캐시
_demo_cache: dict = {}


@router.get("/demo", response_model=AnalysisResponse)
async def get_demo_result():
    """API 키 없이 Mock 데이터로 전체 UI 플로우를 테스트하는 데모 엔드포인트."""
    demo_id = "demo-fixed"

    # 캐시에 없으면 생성
    if demo_id not in _demo_cache:
        raw = get_mock_result()
        result = build_analysis_result(raw)
        # ID를 고정값으로 덮어씌움 (항상 같은 URL 유지)
        result.id = demo_id
        _demo_cache[demo_id] = result

    return AnalysisResponse(success=True, data=_demo_cache[demo_id])
