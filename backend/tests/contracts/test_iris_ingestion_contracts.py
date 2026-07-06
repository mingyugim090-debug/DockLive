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
    from services.iris_ingestion import parse_detail_response, parse_list_response  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name not in {"pydantic", "httpx"}:
        raise
    parse_detail_response = None
    parse_list_response = None

FIXTURE_DIR = BACKEND / "tests" / "fixtures"

LIST_JSON_FIXTURE = {
    "paginationInfo": {"currentPageNo": 1, "totalRecordCount": 32, "totalPageCount": 4, "recordCountPerPage": 10},
    "listBsnsAncmBtinSitu": [
        {
            "ancmId": "022837",
            "ancmTl": "2026년 하반기 원자력정책연구사업 재공고",
            "ancmNo": "과학기술정보통신부 공고 제2026-0752호",
            "ancmDe": "2026-07-02",
            "blngGovdSeNm": "과학기술정보통신부",
            "sorgnNm": "한국연구재단",
            "rcveStt": "진행중",
            "rcveSttSeNmLst": "공고접수중",
            "pbofrTpSeNmLst": "지정공모",
            "rcveStrDe": "2026-07-02",
            "rcveEndDe": "2026-07-31",
            "dDay": "26",
        },
        {
            "ancmId": "022737",
            "ancmTl": "2026년 휴먼프론티어과학프로그램(HFSP) 협력사업(사전지원) 신규과제 공고",
            "ancmNo": "과학기술정보통신부 공고 제2026-0737호",
            "ancmDe": "2026-06-30",
            "blngGovdSeNm": "과학기술정보통신부",
            "sorgnNm": "한국연구재단",
            "rcveStt": "진행중",
            "rcveSttSeNmLst": "공고접수중",
            "pbofrTpSeNmLst": "지정공모",
            "rcveStrDe": "2026-06-30",
            "rcveEndDe": "2026-07-31",
            "dDay": "25",
        },
        {"ancmId": "", "ancmTl": "id 없는 행은 버려져야 함"},
        "not-a-dict",
    ],
}


class IrisIngestionContractTests(unittest.TestCase):
    def test_list_parsing_maps_fields_without_inventing_rows(self):
        if parse_list_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        result = parse_list_response(LIST_JSON_FIXTURE, progress="ancmIng")

        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.page, 1)
        self.assertEqual(result.total_pages, 4)
        self.assertEqual(result.total_count, 32)
        self.assertTrue(result.has_more)

        first = result.items[0]
        self.assertEqual(first.ancm_id, "022837")
        self.assertEqual(first.ministry, "과학기술정보통신부")
        self.assertEqual(first.agency, "한국연구재단")
        self.assertEqual(first.status, "공고접수중")
        self.assertEqual(first.competition_type, "지정공모")
        self.assertEqual(first.receipt_end, "2026-07-31")
        self.assertIn("ancmId=022837", first.detail_url)

    def test_list_parsing_returns_empty_for_broken_payload(self):
        if parse_list_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        for payload in ({}, {"listBsnsAncmBtinSitu": "oops"}, {"listBsnsAncmBtinSitu": None}):
            result = parse_list_response(payload)
            self.assertEqual(result.items, [])
            self.assertFalse(result.has_more)

    def test_detail_parsing_extracts_metadata_body_and_attachments(self):
        if parse_detail_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        raw_html = (FIXTURE_DIR / "iris-detail-sample.html").read_text(encoding="utf-8")
        detail = parse_detail_response(raw_html, "022737")

        self.assertTrue(detail.detail_available)
        self.assertEqual(detail.title, "2026년 휴먼프론티어과학프로그램(HFSP) 협력사업(사전지원) 신규과제 공고")
        self.assertEqual(detail.ministry, "과학기술정보통신부")
        self.assertEqual(detail.agency, "한국연구재단")
        self.assertEqual(detail.notice_number, "과학기술정보통신부 공고 제2026-0737호")
        self.assertEqual(detail.receipt_period, "2026-06-30 ~ 2026-07-31")
        self.assertIn("생명과학 분야의 혁신적 다학제 공동연구", detail.body_text)
        self.assertIn("과제당 연 20백만원 이내", detail.body_text)

        self.assertEqual(len(detail.attachments), 2)
        self.assertEqual(detail.attachments[0].filename, "[붙임1] 2026년 HFSP 협력사업 공고문.hwpx")
        self.assertIn("atchDocId=DOCID_AAA==", detail.attachments[0].download_url)
        self.assertEqual(detail.attachments[0].size_bytes, 360999)
        # Attachment filenames must not leak into the body text.
        self.assertNotIn("[붙임1]", detail.body_text)

    def test_detail_parsing_degrades_to_unavailable_for_unrecognized_html(self):
        if parse_detail_response is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        detail = parse_detail_response("<html><body>완전히 다른 페이지</body></html>", "000001")

        self.assertFalse(detail.detail_available)
        self.assertEqual(detail.title, "")
        self.assertEqual(detail.body_text, "")
        self.assertEqual(detail.attachments, [])
        self.assertIn("ancmId=000001", detail.detail_url)


if __name__ == "__main__":
    unittest.main()
