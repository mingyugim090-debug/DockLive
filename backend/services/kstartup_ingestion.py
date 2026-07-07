"""On-demand K-Startup (창업진흥원, data.go.kr) startup-support notice discovery.

Uses the official 공공데이터포털 open API (serviceKey required). Only parsed
values are surfaced — missing fields stay empty, nothing is invented.
Responses are cached in-memory with a TTL; no background crawling happens here.
"""

import logging
import time
from typing import Any

import httpx

from core.config import settings
from core.errors import AnalysisError
from models.schemas import DiscoveredNotice, DiscoveredNoticeListResult

logger = logging.getLogger(__name__)

KSTARTUP_LIST_ENDPOINT = (
    "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01"
)

_HEADERS = {"User-Agent": "LiveDockBot/1.0 (+https://livedock.local)"}
_TIMEOUT = 15
_CACHE_TTL_SECONDS = 15 * 60
_PAGE_SIZE = 20

_list_cache: dict[tuple[int, str], tuple[float, DiscoveredNoticeListResult]] = {}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _item_from_row(row: dict) -> DiscoveredNotice:
    notice_id = _text(row.get("pbanc_sn")) or _text(row.get("id"))
    status = ""
    recruiting = _text(row.get("rcrt_prgs_yn")).upper()
    if recruiting == "Y":
        status = "모집중"
    elif recruiting == "N":
        status = "모집마감"
    return DiscoveredNotice(
        source_id="kstartup",
        id=notice_id,
        title=_text(row.get("biz_pbanc_nm")) or _text(row.get("intg_pbanc_biz_nm")),
        organization=_text(row.get("pbanc_ntrp_nm")),
        ministry=_text(row.get("sprv_inst")),
        category=_text(row.get("supt_biz_clsfc")),
        receipt_start=_text(row.get("pbanc_rcpt_bgng_dt")),
        receipt_end=_text(row.get("pbanc_rcpt_end_dt")),
        status=status,
        detail_url=_text(row.get("detl_pg_url")),
        summary=_text(row.get("pbanc_ctnt"))[:600],
        region=_text(row.get("supt_regin")),
        extras={
            key: _text(row.get(source_key))
            for key, source_key in (
                ("신청대상", "aply_trgt"),
                ("사업업력", "biz_enyy"),
                ("대상연령", "biz_trgt_age"),
            )
            if _text(row.get(source_key))
        },
    )


def parse_kstartup_response(data: dict, page: int = 1) -> DiscoveredNoticeListResult:
    """Convert the K-Startup list JSON into our schema. Never invents rows or fields."""
    rows: Any = data.get("data") if isinstance(data, dict) else None
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        rows = []

    items = [
        item
        for item in (_item_from_row(row) for row in rows if isinstance(row, dict))
        if item.id and item.title
    ]

    def _count(key: str, fallback: int) -> int:
        try:
            return int(data.get(key))
        except (TypeError, ValueError, AttributeError):
            return fallback

    total = _count("totalCount", len(items))
    total_pages = (total + _PAGE_SIZE - 1) // _PAGE_SIZE if total else (1 if items else 0)
    return DiscoveredNoticeListResult(
        source_id="kstartup",
        items=items,
        page=max(1, page),
        total_pages=total_pages,
        total_count=total,
        has_more=max(1, page) < total_pages,
    )


async def fetch_kstartup_notices(page: int = 1, keyword: str = "") -> DiscoveredNoticeListResult:
    if not settings.KSTARTUP_API_KEY:
        raise AnalysisError("K-Startup API 키가 설정되지 않았습니다.")
    page = max(1, page)
    keyword = keyword.strip()

    cache_key = (page, keyword)
    cached = _list_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    params: dict[str, str] = {
        "serviceKey": settings.KSTARTUP_API_KEY,
        "returnType": "json",
        "page": str(page),
        "perPage": str(_PAGE_SIZE),
    }
    if keyword:
        params["biz_pbanc_nm"] = keyword

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as client:
            response = await client.get(KSTARTUP_LIST_ENDPOINT, params=params)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as e:
        raise AnalysisError(f"K-Startup 공고 목록을 가져오지 못했습니다: {e}") from e

    result = parse_kstartup_response(data if isinstance(data, dict) else {}, page)
    _list_cache[cache_key] = (time.monotonic(), result)
    return result
