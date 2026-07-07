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
    from core.config import settings  # noqa: E402
    from models.schemas import IrisNoticeItem  # noqa: E402
    from services.bizinfo_ingestion import parse_bizinfo_response  # noqa: E402
    from services.kstartup_ingestion import parse_kstartup_response  # noqa: E402
    from services.notice_sources import (  # noqa: E402
        BizinfoSource,
        KstartupSource,
        get_source,
        iris_item_to_discovered,
        list_source_statuses,
    )
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name not in {"pydantic", "httpx"}:
        raise
    settings = None
    parse_bizinfo_response = None
    parse_kstartup_response = None

FIXTURE_DIR = BACKEND / "tests" / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


class BizinfoParsingContractTests(unittest.TestCase):
    def test_parsing_maps_fields_without_inventing_rows(self):
        if parse_bizinfo_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        result = parse_bizinfo_response(_load_fixture("bizinfo-list-sample.json"))

        self.assertEqual(result.source_id, "bizinfo")
        self.assertEqual(len(result.items), 2)

        first = result.items[0]
        self.assertEqual(first.id, "PBLN_000000000119700")
        self.assertEqual(first.title, "2026년 마이데이터 서비스 지원사업 모집 공고")
        self.assertEqual(first.ministry, "과학기술정보통신부")
        self.assertEqual(first.organization, "한국데이터산업진흥원")
        self.assertEqual(first.category, "기술")
        self.assertEqual(first.receipt_start, "2026-07-01")
        self.assertEqual(first.receipt_end, "2026-07-31")
        # Relative detail URLs are prefixed with the bizinfo host, never invented.
        self.assertTrue(first.detail_url.startswith("https://www.bizinfo.go.kr/"))
        # HTML tags in the summary are stripped.
        self.assertEqual(first.summary, "마이데이터 기반 혁신 서비스 개발을 지원하는 사업입니다.")
        # Absolute URLs stay untouched.
        self.assertTrue(result.items[1].detail_url.startswith("https://www.bizinfo.go.kr/sii"))

    def test_parsing_returns_empty_for_broken_payload(self):
        if parse_bizinfo_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        for payload in ({}, {"jsonArray": "oops"}, {"jsonArray": None}):
            result = parse_bizinfo_response(payload)
            self.assertEqual(result.items, [])
            self.assertFalse(result.has_more)

    def test_keyword_filters_parsed_rows_only(self):
        if parse_bizinfo_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        result = parse_bizinfo_response(_load_fixture("bizinfo-list-sample.json"), keyword="AI 전환")
        self.assertEqual([item.id for item in result.items], ["PBLN_000000000119800"])


class KstartupParsingContractTests(unittest.TestCase):
    def test_parsing_maps_fields_without_inventing_rows(self):
        if parse_kstartup_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        result = parse_kstartup_response(_load_fixture("kstartup-list-sample.json"))

        self.assertEqual(result.source_id, "kstartup")
        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.total_count, 42)
        self.assertTrue(result.has_more)

        first = result.items[0]
        self.assertEqual(first.id, "174001")
        self.assertEqual(first.title, "2026년 예비창업패키지 (일반) 예비창업자 모집 공고")
        self.assertEqual(first.organization, "창업진흥원")
        self.assertEqual(first.ministry, "중소벤처기업부")
        self.assertEqual(first.category, "사업화")
        self.assertEqual(first.receipt_end, "20260731")
        self.assertEqual(first.status, "모집중")
        self.assertEqual(first.region, "전국")
        self.assertEqual(first.extras.get("신청대상"), "예비창업자")
        self.assertEqual(result.items[1].status, "모집마감")

    def test_parsing_returns_empty_for_broken_payload(self):
        if parse_kstartup_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        for payload in ({}, {"data": "oops"}, {"data": None}):
            result = parse_kstartup_response(payload)
            self.assertEqual(result.items, [])


class NoticeSourceRegistryContractTests(unittest.TestCase):
    def test_keyless_sources_report_unavailable_with_reason(self):
        if settings is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        original_bizinfo, original_kstartup = settings.BIZINFO_API_KEY, settings.KSTARTUP_API_KEY
        settings.BIZINFO_API_KEY = ""
        settings.KSTARTUP_API_KEY = ""
        try:
            statuses = {status.source_id: status for status in list_source_statuses()}
            self.assertTrue(statuses["iris"].available)
            self.assertFalse(statuses["bizinfo"].available)
            self.assertFalse(statuses["kstartup"].available)
            self.assertIn("API 키", statuses["bizinfo"].unavailable_reason)
            self.assertIn("API 키", statuses["kstartup"].unavailable_reason)
        finally:
            settings.BIZINFO_API_KEY = original_bizinfo
            settings.KSTARTUP_API_KEY = original_kstartup

    def test_sources_become_available_with_keys(self):
        if settings is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        original_bizinfo, original_kstartup = settings.BIZINFO_API_KEY, settings.KSTARTUP_API_KEY
        settings.BIZINFO_API_KEY = "test-key"
        settings.KSTARTUP_API_KEY = "test-key"
        try:
            self.assertTrue(BizinfoSource().available())
            self.assertTrue(KstartupSource().available())
        finally:
            settings.BIZINFO_API_KEY = original_bizinfo
            settings.KSTARTUP_API_KEY = original_kstartup

    def test_unknown_source_raises(self):
        if settings is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        with self.assertRaises(Exception) as ctx:
            get_source("naver")
        self.assertIn("지원하지 않는", str(ctx.exception))

    def test_iris_item_maps_to_discovered_notice_without_loss(self):
        if settings is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        item = IrisNoticeItem(
            ancm_id="022737",
            title="HFSP 협력사업 공고",
            ministry="과학기술정보통신부",
            agency="한국연구재단",
            notice_number="제2026-0737호",
            notice_date="2026-06-30",
            status="공고접수중",
            competition_type="지정공모",
            receipt_start="2026-06-30",
            receipt_end="2026-07-31",
            d_day="25",
            detail_url="https://www.iris.go.kr/contents/retrieveBsnsAncmView.do?ancmId=022737",
        )
        notice = iris_item_to_discovered(item)

        self.assertEqual(notice.source_id, "iris")
        self.assertEqual(notice.id, "022737")
        self.assertEqual(notice.title, item.title)
        self.assertEqual(notice.ministry, item.ministry)
        self.assertEqual(notice.organization, item.agency)
        self.assertEqual(notice.category, item.competition_type)
        self.assertEqual(notice.receipt_end, item.receipt_end)
        self.assertEqual(notice.d_day, item.d_day)
        self.assertEqual(notice.detail_url, item.detail_url)
        self.assertEqual(notice.extras.get("공고번호"), item.notice_number)
        self.assertEqual(notice.extras.get("공고일자"), item.notice_date)


if __name__ == "__main__":
    unittest.main()
