import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

try:
    from core.config import settings  # noqa: E402
    from tests.evals.run_fixture_e2e import run_agency_recall_fixture  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    settings = None
    run_agency_recall_fixture = None


class FixtureE2EContractTests(unittest.TestCase):
    def test_deterministic_agency_recall_fixture_does_not_call_live_embedding(self):
        if run_agency_recall_fixture is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        fixture = json.loads(
            (ROOT / "docs" / "evaluation" / "agency-fixtures" / "noticeops-prior-recall-2026.json").read_text(
                encoding="utf-8"
            )
        )
        old_mock = settings.MOCK_MODE
        old_key = settings.OPENAI_API_KEY
        try:
            settings.MOCK_MODE = False
            settings.OPENAI_API_KEY = "sk-test-real-looking-key"
            with patch("services.ai_provider._call_openai_embedding", side_effect=AssertionError("live embedding called")):
                report = run_agency_recall_fixture(fixture)
        finally:
            settings.MOCK_MODE = old_mock
            settings.OPENAI_API_KEY = old_key

        self.assertGreaterEqual(report["score"], 80)


if __name__ == "__main__":
    unittest.main()
