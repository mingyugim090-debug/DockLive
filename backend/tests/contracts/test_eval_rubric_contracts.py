import json
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
    from services.openai_service import _validate_result  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    AnalysisResult = None
    build_analysis_result = None
    _validate_result = None


class EvalRubricContractTests(unittest.TestCase):
    def test_rubric_extraction_is_grounded_and_preserved(self):
        if _validate_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        fixture = json.loads(
            (ROOT / "docs" / "evaluation" / "fixtures" / "rubric-startup-grant.json").read_text(encoding="utf-8")
        )
        source_text = fixture["announcement_text"]
        expected_names = fixture["expected"]["rubric_criteria_names"]

        guarded = _validate_result(
            {
                "doc_type": "startup",
                "title": fixture["expected"]["title_contains"],
                "organization": fixture["expected"]["organization"],
                "summary": source_text[:120],
                "rubric": {
                    "criteria": [
                        {"name": name, "weight": weight, "description": "심사 설명", "source_ref": "공고 평가기준"}
                        for name, weight in zip(expected_names, [30, 30, 20, 20])
                    ],
                    "total_weight": 100,
                    "source": "notice",
                },
            },
            source_text,
        )

        self.assertIsNotNone(guarded["rubric"])
        result_names = [item["name"] for item in guarded["rubric"]["criteria"]]
        self.assertEqual(result_names, expected_names)
        self.assertEqual(guarded["rubric"]["total_weight"], 100)

    def test_rubric_with_ungrounded_criterion_is_stripped(self):
        if _validate_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        source_text = "평가항목: 문제인식(50점), 실현가능성(50점). 총점 100점."
        guarded = _validate_result(
            {
                "doc_type": "startup",
                "title": "테스트 공고",
                "organization": "테스트 기관",
                "rubric": {
                    "criteria": [
                        {"name": "문제인식", "weight": 50, "description": "", "source_ref": ""},
                        {"name": "원문에 없는 항목", "weight": 50, "description": "", "source_ref": ""},
                    ],
                    "total_weight": 100,
                    "source": "notice",
                },
            },
            source_text,
        )

        self.assertIsNotNone(guarded["rubric"])
        result_names = [item["name"] for item in guarded["rubric"]["criteria"]]
        self.assertEqual(result_names, ["문제인식"])
        self.assertTrue(any("평가항목" in item for item in guarded["uncertain_fields"]))

    def test_rubric_null_when_absent_from_notice(self):
        if build_analysis_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        fixture = json.loads(
            (ROOT / "docs" / "evaluation" / "fixtures" / "rubric-absent-competition.json").read_text(encoding="utf-8")
        )
        raw = {
            "doc_type": fixture["expected"]["doc_type"],
            "title": fixture["expected"]["title_contains"],
            "organization": fixture["expected"]["organization"],
            "summary": fixture["announcement_text"][:120],
            "rubric": None,
        }

        result = build_analysis_result(raw, source_type="text", source_name=fixture["name"])

        self.assertIsNone(result.rubric)

    def test_rubric_weight_mismatch_is_flagged_but_criteria_kept(self):
        if _validate_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        source_text = "평가항목: 문제인식(40점), 실현가능성(40점). 총점 100점으로 명시."
        guarded = _validate_result(
            {
                "doc_type": "startup",
                "title": "테스트 공고",
                "organization": "테스트 기관",
                "rubric": {
                    "criteria": [
                        {"name": "문제인식", "weight": 40, "description": "", "source_ref": ""},
                        {"name": "실현가능성", "weight": 40, "description": "", "source_ref": ""},
                    ],
                    "total_weight": 100,
                    "source": "notice",
                },
            },
            source_text,
        )

        self.assertIsNotNone(guarded["rubric"])
        self.assertEqual(len(guarded["rubric"]["criteria"]), 2)
        self.assertTrue(any("배점 합계" in item for item in guarded["uncertain_fields"]))

    def test_build_analysis_result_maps_grounded_rubric_end_to_end(self):
        if build_analysis_result is None:
            self.skipTest("pydantic is not installed in this Python environment")

        raw = {
            "doc_type": "startup",
            "title": "초기창업패키지",
            "organization": "중소벤처기업부",
            "rubric": {
                "criteria": [
                    {"name": "문제인식", "weight": 30, "description": "문제 정의", "source_ref": "공고 평가기준"},
                    {"name": "실현가능성", "weight": 30, "description": "실행 계획", "source_ref": "공고 평가기준"},
                    {"name": "성장전략", "weight": 20, "description": "확장 전략", "source_ref": "공고 평가기준"},
                    {"name": "팀구성", "weight": 20, "description": "팀 역량", "source_ref": "공고 평가기준"},
                ],
                "total_weight": 100,
                "source": "notice",
            },
        }

        result = build_analysis_result(raw, source_type="text", source_name="rubric-fixture")
        restored = AnalysisResult(**result.model_dump(mode="json"))

        self.assertIsNotNone(restored.rubric)
        self.assertEqual(len(restored.rubric.criteria), 4)
        self.assertEqual(restored.rubric.total_weight, 100)
        self.assertEqual(sum(item.weight for item in restored.rubric.criteria), 100)


if __name__ == "__main__":
    unittest.main()
