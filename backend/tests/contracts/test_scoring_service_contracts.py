import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from models.schemas import AnalysisResult  # noqa: E402
    from services.analyzer import build_analysis_result  # noqa: E402
    from services.drafting_service import create_workflow_session, generate_drafts, update_inputs  # noqa: E402
    from services.scoring_service import score_workflow  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    AnalysisResult = None
    build_analysis_result = None
    create_workflow_session = None
    generate_drafts = None
    update_inputs = None
    score_workflow = None


_RUBRIC_RAW = {
    "criteria": [
        {"name": "문제인식", "weight": 30, "description": "문제 정의", "source_ref": "공고 평가기준"},
        {"name": "실현가능성", "weight": 30, "description": "실행 계획", "source_ref": "공고 평가기준"},
        {"name": "성장전략", "weight": 20, "description": "확장 전략", "source_ref": "공고 평가기준"},
        {"name": "팀구성", "weight": 20, "description": "팀 역량", "source_ref": "공고 평가기준"},
    ],
    "total_weight": 100,
    "source": "notice",
}


def _drafted_workflow(with_rubric: bool):
    raw = {
        "doc_type": "startup",
        "title": "초기창업패키지",
        "organization": "중소벤처기업부",
        "rubric": _RUBRIC_RAW if with_rubric else None,
    }
    result = build_analysis_result(raw, source_type="text", source_name="scoring-fixture")
    workflow = create_workflow_session(result)
    updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
    workflow = generate_drafts(update_inputs(workflow, updates))
    return workflow


class ScoringServiceContractTests(unittest.TestCase):
    def test_score_workflow_skips_when_rubric_is_absent(self):
        if score_workflow is None:
            self.skipTest("pydantic is not installed in this Python environment")

        workflow = _drafted_workflow(with_rubric=False)
        self.assertIsNone(workflow.analysis.rubric)

        scored = score_workflow(workflow)

        self.assertIsNone(scored.rubric_score)

    def test_score_workflow_scores_each_criterion_when_rubric_present(self):
        if score_workflow is None:
            self.skipTest("pydantic is not installed in this Python environment")

        workflow = _drafted_workflow(with_rubric=True)
        self.assertIsNotNone(workflow.analysis.rubric)

        scored = score_workflow(workflow)

        self.assertIsNotNone(scored.rubric_score)
        scored_names = {item.name for item in scored.rubric_score.per_criterion}
        expected_names = {item["name"] for item in _RUBRIC_RAW["criteria"]}
        self.assertEqual(scored_names, expected_names)
        for item in scored.rubric_score.per_criterion:
            self.assertLessEqual(item.score, item.max)
            self.assertGreaterEqual(item.score, 0)

    def test_score_workflow_is_reproducible_within_tolerance(self):
        if score_workflow is None:
            self.skipTest("pydantic is not installed in this Python environment")

        workflow = _drafted_workflow(with_rubric=True)
        first = score_workflow(workflow).rubric_score.total
        second = score_workflow(workflow).rubric_score.total

        self.assertLessEqual(abs(first - second), 5)


if __name__ == "__main__":
    unittest.main()
