"""On-demand 기업마당(bizinfo.go.kr) support-program notice discovery.

Uses bizinfo's official open API (crtfcKey issued on bizinfo.go.kr). Only
parsed values are surfaced — missing fields stay empty, nothing is invented.
Responses are cached in-memory with a TTL; no background crawling happens here.
"""

import html
import logging
import re
import time
from typing import Any

import httpx

from core.config import settings
from core.errors import AnalysisError
from models.schemas import DiscoveredNotice, DiscoveredNoticeListResult

logger = logging.getLogger(__name__)

BIZINFO_BASE_URL = "https://www.bizinfo.go.kr"
BIZINFO_LIST_ENDPOINT = f"{BIZINFO_BASE_URL}/uss/rss/bizinfoApi.do"

_HEADERS = {"User-Agent": "LiveDockBot/1.0 (+https://livedock.local)"}
_TIMEOUT = 15
_CACHE_TTL_SECONDS = 15 * 60
_PAGE_SIZE = 20

_list_cache: dict[tuple[int, str], tuple[float, DiscoveredNoticeListResult]] = {}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _strip_tags(value: str) -> str:
    cleaned = re.sub(r"(?is)<[^>]+>", " ", value)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _absolute_url(url: str) -> str:
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"{BIZINFO_BASE_URL}{url if url.startswith('/') else '/' + url}"


def _split_period(value: str) -> tuple[str, str]:
    parts = [part.strip() for part in value.split("~")]
    if len(parts) == 2:
        return parts[0], parts[1]
    return value.strip(), ""


def _item_from_row(row: dict) -> DiscoveredNotice:
    notice_id = _text(row.get("pblancId")) or _text(row.get("pblancSn"))
    receipt_start, receipt_end = _split_period(_text(row.get("reqstBeginEndDe")))
    return DiscoveredNotice(
        source_id="bizinfo",
        id=notice_id,
        title=_strip_tags(_text(row.get("pblancNm"))),
        ministry=_text(row.get("jrsdInsttNm")),
        organization=_text(row.get("excInsttNm")),
        category=_text(row.get("pldirSportRealmLclasCodeNm")),
        receipt_start=receipt_start,
        receipt_end=receipt_end,
        status=_text(row.get("pblancStts")),
        detail_url=_absolute_url(_text(row.get("pblancUrl"))),
        summary=_strip_tags(_text(row.get("bsnsSumryCn")))[:600],
        extras={
            key: _text(row.get(source_key))
            for key, source_key in (("등록일", "creatPnttm"), ("해시태그", "hashtags"))
            if _text(row.get(source_key))
        },
    )


def parse_bizinfo_response(data: dict, page: int = 1, keyword: str = "") -> DiscoveredNoticeListResult:
    """Convert bizinfo's list JSON into our schema. Never invents rows or fields."""
    rows: Any = data
    for key in ("jsonArray", "item", "items", "data"):
        if isinstance(rows, dict) and key in rows:
            rows = rows[key]
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        rows = []

    items = [
        item
        for item in (_item_from_row(row) for row in rows if isinstance(row, dict))
        if item.id and item.title
    ]
    keyword = keyword.strip()
    if keyword:
        lowered = keyword.lower()
        items = [
            item
            for item in items
            if lowered in item.title.lower()
            or lowered in item.summary.lower()
            or lowered in item.category.lower()
        ]

    total = len(items)
    start = (max(1, page) - 1) * _PAGE_SIZE
    page_items = items[start : start + _PAGE_SIZE]
    total_pages = (total + _PAGE_SIZE - 1) // _PAGE_SIZE
    return DiscoveredNoticeListResult(
        source_id="bizinfo",
        items=page_items,
        page=max(1, page),
        total_pages=total_pages,
        total_count=total,
        has_more=max(1, page) < total_pages,
    )


async def fetch_bizinfo_notices(page: int = 1, keyword: str = "") -> DiscoveredNoticeListResult:
    if not settings.BIZINFO_API_KEY:
        raise AnalysisError("기업마당 API 키가 설정되지 않았습니다.")
    page = max(1, page)
    keyword = keyword.strip()

    cache_key = (page, keyword)
    cached = _list_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as client:
            response = await client.get(
                BIZINFO_LIST_ENDPOINT,
                params={
                    "crtfcKey": settings.BIZINFO_API_KEY,
                    "dataType": "json",
                    "searchCnt": "200",
                },
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as e:
        raise AnalysisError(f"기업마당 공고 목록을 가져오지 못했습니다: {e}") from e

    result = parse_bizinfo_response(data if isinstance(data, dict) else {"jsonArray": data}, page, keyword)
    _list_cache[cache_key] = (time.monotonic(), result)
    return result
