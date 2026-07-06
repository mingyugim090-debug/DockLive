"""On-demand IRIS (iris.go.kr) public notice discovery.

List data comes from IRIS's own JSON endpoint; detail pages are
server-rendered HTML parsed best-effort. Only parsed values are surfaced —
missing fields stay empty, nothing is invented. Responses are cached
in-memory with a TTL so repeated feed views do not re-hit IRIS, and no
background crawling or login automation happens here.
"""

import html
import logging
import re
import time
from typing import Any

import httpx

from core.errors import AnalysisError
from models.schemas import IrisNoticeAttachment, IrisNoticeDetail, IrisNoticeItem, IrisNoticeListResult

logger = logging.getLogger(__name__)

IRIS_BASE_URL = "https://www.iris.go.kr"
IRIS_LIST_ENDPOINT = f"{IRIS_BASE_URL}/contents/retrieveBsnsAncmBtinSituList.do"
IRIS_DETAIL_ENDPOINT = f"{IRIS_BASE_URL}/contents/retrieveBsnsAncmView.do"

_HEADERS = {"User-Agent": "LiveDockBot/1.0 (+https://livedock.local)"}
_TIMEOUT = 15
_CACHE_TTL_SECONDS = 15 * 60
MAX_DETAIL_TEXT_LENGTH = 60_000

_list_cache: dict[tuple[int, str, str], tuple[float, IrisNoticeListResult]] = {}
_detail_cache: dict[str, tuple[float, IrisNoticeDetail]] = {}

# ancmPrg values IRIS uses for its receipt-status tabs.
_VALID_PROGRESS = {"ancmIng", "ancmPre", "ancmEnd", ""}


def _text(value: Any) -> str:
    return str(value or "").strip()


def detail_page_url(ancm_id: str, progress: str = "ancmIng") -> str:
    return f"{IRIS_DETAIL_ENDPOINT}?ancmId={ancm_id}&ancmPrg={progress or 'ancmIng'}"


def _item_from_row(row: dict, progress: str) -> IrisNoticeItem:
    ancm_id = _text(row.get("ancmId"))
    return IrisNoticeItem(
        ancm_id=ancm_id,
        title=_text(row.get("ancmTl")),
        ministry=_text(row.get("blngGovdSeNm")),
        agency=_text(row.get("sorgnNm")),
        notice_number=_text(row.get("ancmNo")),
        notice_date=_text(row.get("ancmDe")),
        status=_text(row.get("rcveSttSeNmLst")) or _text(row.get("rcveStt")),
        competition_type=_text(row.get("pbofrTpSeNmLst")),
        receipt_start=_text(row.get("rcveStrDe")),
        receipt_end=_text(row.get("rcveEndDe")),
        d_day=_text(row.get("dDay")),
        detail_url=detail_page_url(ancm_id, progress) if ancm_id else "",
    )


def parse_list_response(data: dict, progress: str = "ancmIng") -> IrisNoticeListResult:
    """Convert IRIS's list JSON into our schema. Never invents rows or fields."""
    rows = data.get("listBsnsAncmBtinSitu")
    items = [
        item
        for item in (_item_from_row(row, progress) for row in rows if isinstance(row, dict))
        if item.ancm_id and item.title
    ] if isinstance(rows, list) else []

    pagination = data.get("paginationInfo") if isinstance(data.get("paginationInfo"), dict) else {}

    def _page_int(key: str, fallback: int) -> int:
        try:
            return int(pagination.get(key))
        except (TypeError, ValueError):
            return fallback

    page = _page_int("currentPageNo", 1)
    total_pages = _page_int("totalPageCount", page if items else 0)
    return IrisNoticeListResult(
        items=items,
        page=page,
        total_pages=total_pages,
        total_count=_page_int("totalRecordCount", len(items)),
        has_more=page < total_pages,
    )


async def fetch_iris_notice_list(page: int = 1, keyword: str = "", progress: str = "ancmIng") -> IrisNoticeListResult:
    if progress not in _VALID_PROGRESS:
        progress = "ancmIng"
    page = max(1, page)
    keyword = keyword.strip()

    cache_key = (page, keyword, progress)
    cached = _list_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as client:
            response = await client.post(
                IRIS_LIST_ENDPOINT,
                data={"pageIndex": str(page), "bsnsTl": keyword, "ancmPrg": progress},
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as e:
        raise AnalysisError(f"IRIS 공고 목록을 가져오지 못했습니다: {e}") from e

    result = parse_list_response(data if isinstance(data, dict) else {}, progress)
    _list_cache[cache_key] = (time.monotonic(), result)
    return result


_METADATA_PATTERN = re.compile(
    r'<li class="write[^"]*">\s*<strong>(.*?)</strong>\s*<span[^>]*>(.*?)</span>',
    flags=re.I | re.S,
)
_BODY_PATTERN = re.compile(r'<div class="se-contents"[^>]*>(.*)', flags=re.I | re.S)
_ATTACHMENT_PATTERN = re.compile(
    r"f_bsnsAncm_downloadAtchFile\('([^']*)','([^']*)','([^']*)'\s*,'(\d*)'\)",
)


def _clean_fragment(fragment: str) -> str:
    cleaned = re.sub(r"(?is)<br\s*/?>", "\n", fragment)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"[ \t ]+", " ", cleaned)
    return "\n".join(line.strip() for line in cleaned.splitlines() if line.strip()).strip()


def _extract_body_text(raw_html: str) -> str:
    match = _BODY_PATTERN.search(raw_html)
    if not match:
        return ""
    fragment = match.group(1)
    # The se-contents div runs to the end of its enclosing container; cut at
    # the attachment list if present so file links do not pollute the body.
    cut = fragment.find('<ul class="add_file"')
    if cut != -1:
        fragment = fragment[:cut]
    cleaned = re.sub(r"(?is)<(script|style).*?</\1>", " ", fragment)
    cleaned = re.sub(r"(?is)</(p|div|li|tr|h[1-6]|td|table)>", "\n", cleaned)
    return _clean_fragment(cleaned)[:MAX_DETAIL_TEXT_LENGTH]


def parse_detail_response(raw_html: str, ancm_id: str, progress: str = "ancmIng") -> IrisNoticeDetail:
    """Parse a server-rendered IRIS detail page. Missing pieces stay empty."""
    metadata: dict[str, str] = {}
    for label, value in _METADATA_PATTERN.findall(raw_html):
        key = _clean_fragment(label)
        if key and key not in metadata:
            metadata[key] = _clean_fragment(value)

    attachments = [
        IrisNoticeAttachment(
            filename=_clean_fragment(filename),
            download_url=f"{IRIS_BASE_URL}/comm/file/fileDownload.do?atchDocId={doc_id}&atchFileId={file_id}",
            size_bytes=int(size) if size else 0,
        )
        for doc_id, file_id, filename, size in _ATTACHMENT_PATTERN.findall(raw_html)
        if filename.strip()
    ]

    body_text = _extract_body_text(raw_html)

    return IrisNoticeDetail(
        ancm_id=ancm_id,
        title=metadata.get("공고명", ""),
        ministry=metadata.get("소관부처", ""),
        agency=metadata.get("전문기관", ""),
        notice_number=metadata.get("공고번호", ""),
        notice_date=metadata.get("공고일자", ""),
        receipt_period=metadata.get("접수기간", ""),
        contact=metadata.get("사업담당자 연락처", "") or metadata.get("사업담당자연락처", ""),
        body_text=body_text,
        attachments=attachments,
        detail_available=bool(body_text or metadata),
        detail_url=detail_page_url(ancm_id, progress),
    )


async def fetch_iris_notice_detail(ancm_id: str, progress: str = "ancmIng") -> IrisNoticeDetail:
    ancm_id = ancm_id.strip()
    if not re.fullmatch(r"[0-9]{1,12}", ancm_id):
        raise AnalysisError("유효한 IRIS 공고 ID가 아닙니다.")
    if progress not in _VALID_PROGRESS:
        progress = "ancmIng"

    cached = _detail_cache.get(ancm_id)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as client:
            response = await client.get(IRIS_DETAIL_ENDPOINT, params={"ancmId": ancm_id, "ancmPrg": progress})
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise AnalysisError(f"IRIS 공고 상세를 가져오지 못했습니다: {e}") from e

    detail = parse_detail_response(response.text, ancm_id, progress)
    _detail_cache[ancm_id] = (time.monotonic(), detail)
    return detail
