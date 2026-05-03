import html
import re
from urllib.parse import urlparse

import httpx

from core.errors import AnalysisError

MAX_URL_TEXT_LENGTH = 80_000


def _strip_html(raw_html: str) -> tuple[str, str]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, flags=re.I | re.S)
    title = html.unescape(re.sub(r"\s+", " ", title_match.group(1)).strip()) if title_match else ""

    meta_desc = ""
    for pattern in (
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
    ):
        match = re.search(pattern, raw_html, flags=re.I | re.S)
        if match:
            meta_desc = html.unescape(match.group(1)).strip()
            break

    cleaned = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", raw_html)
    cleaned = re.sub(r"(?is)<br\s*/?>", "\n", cleaned)
    cleaned = re.sub(r"(?is)</(p|div|li|tr|h[1-6]|section|article)>", "\n", cleaned)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    text = "\n".join(line.strip() for line in cleaned.splitlines() if line.strip())

    if meta_desc and meta_desc not in text[:1000]:
        text = f"{meta_desc}\n\n{text}"

    return title, text[:MAX_URL_TEXT_LENGTH]


async def fetch_announcement_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AnalysisError("유효한 http/https URL을 입력해 주세요.")

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15,
            headers={"User-Agent": "LiveDockBot/1.0 (+https://livedock.local)"},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise AnalysisError(f"URL 내용을 가져오지 못했습니다: {e}")

    content_type = response.headers.get("content-type", "")
    if "pdf" in content_type:
        from services.pdf_parser import extract_text_from_pdf

        return parsed.netloc, extract_text_from_pdf(response.content, parsed.path or url)

    title, text = _strip_html(response.text)
    if len(text) < 100:
        raise AnalysisError("URL에서 분석할 만한 본문을 찾지 못했습니다. 공고문 PDF 또는 본문 텍스트를 직접 넣어 주세요.")
    return title or parsed.netloc, text
