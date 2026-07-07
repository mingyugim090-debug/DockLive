"""Registry of public notice discovery sources (IRIS, 기업마당, K-Startup).

Each source normalizes its notices into DiscoveredNotice. Sources missing an
API key report unavailable instead of erroring, and IRIS never depends on a
key. Reference text is built only from parsed fields — nothing is invented.
"""

import time
from typing import Protocol

from core.config import settings
from core.errors import AnalysisError
from models.schemas import (
    DiscoveredNotice,
    DiscoveredNoticeListResult,
    IrisNoticeItem,
    NoticeSourceStatus,
)
from services.bizinfo_ingestion import fetch_bizinfo_notices
from services.iris_ingestion import fetch_iris_notice_detail, fetch_iris_notice_list
from services.kstartup_ingestion import fetch_kstartup_notices

_CACHE_TTL_SECONDS = 15 * 60


class TtlCache:
    """Tiny monotonic-clock TTL cache for parsed notice items."""

    def __init__(self, ttl_seconds: float = _CACHE_TTL_SECONDS):
        self._ttl = ttl_seconds
        self._entries: dict[str, tuple[float, DiscoveredNotice]] = {}

    def get(self, key: str) -> DiscoveredNotice | None:
        entry = self._entries.get(key)
        if entry and time.monotonic() - entry[0] < self._ttl:
            return entry[1]
        return None

    def put(self, key: str, value: DiscoveredNotice) -> None:
        self._entries[key] = (time.monotonic(), value)


class NoticeSource(Protocol):
    source_id: str
    label: str
    supports_detail: bool

    def available(self) -> bool: ...

    def unavailable_reason(self) -> str: ...

    async def list_notices(self, page: int, keyword: str) -> DiscoveredNoticeListResult: ...

    async def fetch_reference_text(self, notice_id: str, progress: str = "") -> tuple[str, str, str]:
        """Return (title, grounded_text, detail_url) for save-reference."""
        ...


def iris_item_to_discovered(item: IrisNoticeItem) -> DiscoveredNotice:
    return DiscoveredNotice(
        source_id="iris",
        id=item.ancm_id,
        title=item.title,
        organization=item.agency,
        ministry=item.ministry,
        category=item.competition_type,
        receipt_start=item.receipt_start,
        receipt_end=item.receipt_end,
        d_day=item.d_day,
        status=item.status,
        detail_url=item.detail_url,
        extras={
            key: value
            for key, value in (("공고번호", item.notice_number), ("공고일자", item.notice_date))
            if value
        },
    )


def _reference_text_from_item(item: DiscoveredNotice) -> str:
    lines = [
        line
        for line in (
            f"공고명: {item.title}" if item.title else "",
            f"소관부처: {item.ministry}" if item.ministry else "",
            f"수행기관: {item.organization}" if item.organization else "",
            f"분야: {item.category}" if item.category else "",
            f"접수기간: {item.receipt_start} ~ {item.receipt_end}"
            if item.receipt_start or item.receipt_end
            else "",
            f"지원지역: {item.region}" if item.region else "",
            f"원문: {item.detail_url}" if item.detail_url else "",
        )
        if line
    ]
    lines.extend(f"{key}: {value}" for key, value in item.extras.items())
    if item.summary:
        lines.extend(["", item.summary])
    return "\n".join(lines).strip()


class IrisSource:
    source_id = "iris"
    label = "IRIS 국가R&D"
    supports_detail = True

    def available(self) -> bool:
        return True

    def unavailable_reason(self) -> str:
        return ""

    async def list_notices(self, page: int, keyword: str) -> DiscoveredNoticeListResult:
        result = await fetch_iris_notice_list(page, keyword, "ancmIng")
        return DiscoveredNoticeListResult(
            source_id=self.source_id,
            items=[iris_item_to_discovered(item) for item in result.items],
            page=result.page,
            total_pages=result.total_pages,
            total_count=result.total_count,
            has_more=result.has_more,
        )

    async def fetch_reference_text(self, notice_id: str, progress: str = "") -> tuple[str, str, str]:
        detail = await fetch_iris_notice_detail(notice_id, progress or "ancmIng")
        meta_lines = [
            line
            for line in (
                f"공고번호: {detail.notice_number}" if detail.notice_number else "",
                f"소관부처: {detail.ministry}" if detail.ministry else "",
                f"전문기관: {detail.agency}" if detail.agency else "",
                f"공고일자: {detail.notice_date}" if detail.notice_date else "",
                f"접수기간: {detail.receipt_period}" if detail.receipt_period else "",
            )
            if line
        ]
        text = "\n".join([*meta_lines, "", detail.body_text]).strip()
        title = detail.title or f"IRIS 공고 {notice_id}"
        return title, text, detail.detail_url


class _ItemCacheSource:
    """Shared behavior for sources whose reference text comes from list items."""

    source_id = ""
    label = ""
    supports_detail = False

    def __init__(self):
        self._item_cache = TtlCache()

    def _api_key(self) -> str:
        raise NotImplementedError

    async def _fetch(self, page: int, keyword: str) -> DiscoveredNoticeListResult:
        raise NotImplementedError

    def available(self) -> bool:
        return bool(self._api_key())

    def unavailable_reason(self) -> str:
        return "" if self.available() else "API 키가 설정되지 않았습니다."

    async def list_notices(self, page: int, keyword: str) -> DiscoveredNoticeListResult:
        result = await self._fetch(page, keyword)
        for item in result.items:
            self._item_cache.put(item.id, item)
        return result

    async def fetch_reference_text(self, notice_id: str, progress: str = "") -> tuple[str, str, str]:
        item = self._item_cache.get(notice_id)
        if item is None:
            # Repopulate from the first page (cache-backed, cheap) before failing.
            result = await self._fetch(1, "")
            for row in result.items:
                self._item_cache.put(row.id, row)
            item = self._item_cache.get(notice_id)
        if item is None:
            raise AnalysisError("해당 공고를 찾을 수 없습니다. 목록을 다시 연 뒤 시도해 주세요.")
        return item.title, _reference_text_from_item(item), item.detail_url


class BizinfoSource(_ItemCacheSource):
    source_id = "bizinfo"
    label = "기업마당"

    def _api_key(self) -> str:
        return settings.BIZINFO_API_KEY

    async def _fetch(self, page: int, keyword: str) -> DiscoveredNoticeListResult:
        return await fetch_bizinfo_notices(page, keyword)


class KstartupSource(_ItemCacheSource):
    source_id = "kstartup"
    label = "K-Startup"

    def _api_key(self) -> str:
        return settings.KSTARTUP_API_KEY

    async def _fetch(self, page: int, keyword: str) -> DiscoveredNoticeListResult:
        return await fetch_kstartup_notices(page, keyword)


SOURCES: dict[str, NoticeSource] = {
    source.source_id: source for source in (IrisSource(), BizinfoSource(), KstartupSource())
}


def get_source(source_id: str) -> NoticeSource:
    source = SOURCES.get(source_id)
    if source is None:
        raise AnalysisError("지원하지 않는 공고 소스입니다.")
    return source


def list_source_statuses() -> list[NoticeSourceStatus]:
    return [
        NoticeSourceStatus(
            source_id=source.source_id,
            label=source.label,
            available=source.available(),
            supports_detail=source.supports_detail,
            unavailable_reason=source.unavailable_reason(),
        )
        for source in SOURCES.values()
    ]
