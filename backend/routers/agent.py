"""로컬 Excel 자동화 에이전트(docklive-inline-agent)를 위한 OpenAI 프록시.

로컬 에이전트가 사용자 PC에 OpenAI API 키를 두지 않도록, 이 엔드포인트가
DockLive 백엔드의 키로 대신 OpenAI Chat Completions를 호출해 결과를 돌려준다.
공유 토큰(AGENT_PROXY_TOKEN) + 토큰별 분당 요청 수 제한으로 남용을 최소화한다.
전체 사용자별 인증/과금은 후속 작업 — 지금은 배포판 에이전트가 즉시 동작하게 하는 것이 목적.
"""
import json
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from core.config import settings
from services.ai_provider import should_use_mock_ai

router = APIRouter()

_RATE_WINDOW_SECONDS = 60
_rate_buckets: dict[str, deque] = defaultdict(deque)


class AgentChatRequest(BaseModel):
    model: str = ""
    messages: list[dict]
    tools: list[dict] = []


class AgentChatResponse(BaseModel):
    success: bool
    message: dict
    finish_reason: str = ""


def _check_rate_limit(token: str) -> None:
    limit = settings.AGENT_PROXY_MAX_PER_MINUTE
    if limit <= 0:
        return
    now = time.monotonic()
    bucket = _rate_buckets[token]
    while bucket and now - bucket[0] > _RATE_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="Agent 요청이 너무 많습니다. 잠시 후 다시 시도하세요.")
    bucket.append(now)


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(payload: AgentChatRequest, x_agent_token: str = Header(default="")) -> AgentChatResponse:
    expected = settings.AGENT_PROXY_TOKEN
    if expected and x_agent_token != expected:
        raise HTTPException(status_code=401, detail="유효하지 않은 Agent 토큰입니다.")
    _check_rate_limit(x_agent_token or "anonymous")

    if should_use_mock_ai():
        raise HTTPException(status_code=503, detail="AI API 키가 설정되지 않았습니다.")

    body: dict = {
        "model": payload.model or settings.AGENT_PROXY_MODEL,
        "messages": payload.messages,
    }
    if payload.tools:
        body["tools"] = payload.tools

    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise HTTPException(status_code=exc.code, detail=detail) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 연결 실패: {exc}") from exc

    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message", {})
    return AgentChatResponse(success=True, message=message, finish_reason=choice.get("finish_reason", ""))
