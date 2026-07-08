"""에이전트 코어: DockLive 백엔드 프록시를 통한 tool 호출 루프.

이 에이전트는 OpenAI를 직접 호출하지 않는다 — 사용자 PC에 OpenAI API 키를 두지 않기 위해
DockLive 백엔드(/api/agent/chat)가 대신 호출하고 결과만 돌려받는다. 백엔드가 회사 키로
과금을 부담하므로, 배포된 에이전트를 다운로드한 어떤 사용자도 키 설정 없이 바로 쓸 수 있다.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

from agent.prompts import SYSTEM_PROMPT
from executor import dispatcher
from tools.schemas import OPENAI_TOOLS

MODEL = os.environ.get("AGENT_MODEL", "")  # 비우면 백엔드 기본 모델 사용
MAX_ITERATIONS = 25
_MAX_API_RETRIES = 5

# 배포 백엔드 기본값 — 웹(/app/new)에서 실행하면 요청마다 실제 api_url로 대체된다.
_DEFAULT_API_URL = "https://livedock-api-4c5c4ebd-2c52-4a23-933b-6c62364deeb1.fly.dev"

EventCallback = Callable[[dict], None]


def _api_url() -> str:
    return (
        os.environ.get("LIVEDOCK_API_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_API_URL", "").strip()
        or _DEFAULT_API_URL
    ).rstrip("/")


def _bundled_env_files() -> list[Path]:
    """AGENT_PROXY_TOKEN을 찾을 .env 후보. 개발 모드/PyInstaller 배포판 모두 지원."""
    if getattr(sys, "frozen", False):
        candidates = [Path(sys.executable).parent / ".env"]
        mei = getattr(sys, "_MEIPASS", "")
        if mei:
            candidates.append(Path(mei) / ".env")
        return candidates
    project_root = Path(__file__).resolve().parents[2]
    return [project_root / ".env", project_root.parent / "backend" / ".env"]


def _ensure_agent_token() -> None:
    """AGENT_PROXY_TOKEN이 환경에 없으면 .env 파일에서 찾아 주입한다."""
    if os.environ.get("AGENT_PROXY_TOKEN"):
        return
    for env_file in _bundled_env_files():
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == "AGENT_PROXY_TOKEN" and value.strip():
                os.environ["AGENT_PROXY_TOKEN"] = value.strip().strip('"').strip("'")
                return


class AgentProxyError(RuntimeError):
    """백엔드 프록시 호출 실패 (인증/설정 오류 등 재시도해도 소용없는 경우)."""


class _RetryableProxyError(RuntimeError):
    """레이트리밋/네트워크/서버 오류 — 백오프 후 재시도 대상."""


def _call_agent_proxy(messages: list[dict], tools: list[dict]) -> dict:
    """백엔드 /api/agent/chat을 호출해 OpenAI 호환 message dict를 반환한다."""
    body: dict = {"messages": messages, "tools": tools}
    if MODEL:
        body["model"] = MODEL
    headers = {"Content-Type": "application/json"}
    token = os.environ.get("AGENT_PROXY_TOKEN", "")
    if token:
        headers["X-Agent-Token"] = token

    request = urllib.request.Request(
        f"{_api_url()}/api/agent/chat",
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        if exc.code == 429 or exc.code >= 500:
            raise _RetryableProxyError(f"{exc.code}: {detail}") from exc
        raise AgentProxyError(f"DockLive 서버 오류 ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise _RetryableProxyError(f"연결 실패: {exc.reason}") from exc
    return data.get("message", {})


def _call_with_retry(messages: list[dict], tools: list[dict]) -> dict:
    delay = 1.0
    for attempt in range(_MAX_API_RETRIES):
        try:
            return _call_agent_proxy(messages, tools)
        except _RetryableProxyError as exc:
            if attempt == _MAX_API_RETRIES - 1:
                raise AgentProxyError(str(exc)) from exc
            time.sleep(delay)
            delay = min(delay * 2, 15.0)
    raise AssertionError("unreachable")  # pragma: no cover


def _print_event(event: dict) -> None:
    """기본 이벤트 핸들러 — CLI 실시간 로그."""
    if event["type"] == "tool_call":
        print(f"[tool] {event['name']}({event['input']})")
    elif event["type"] == "tool_result" and not event["ok"]:
        print(f"[tool:error] {event['output']}")


def run_agent(user_request: str, context: str = "", on_event: EventCallback | None = None) -> str:
    """한 번의 사용자 요청을 완료까지 수행하고 최종 보고 텍스트를 반환.

    on_event로 도구 호출/결과 이벤트를 실시간 전달한다 (CLI 로그, WebSocket 스트리밍 공용).
    """
    emit = on_event or _print_event
    _ensure_agent_token()

    initial = user_request if not context else f"<참고자료>\n{context}\n</참고자료>\n\n{user_request}"
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": initial},
    ]

    for iteration in range(MAX_ITERATIONS):
        message = _call_with_retry(messages, OPENAI_TOOLS)
        tool_calls = message.get("tool_calls") or []

        if not tool_calls:
            final = message.get("content") or ""
            emit({"type": "done", "text": final, "iterations": iteration + 1})
            return final

        messages.append({
            "role": "assistant",
            "content": message.get("content"),
            "tool_calls": tool_calls,
        })

        for tc in tool_calls:
            function = tc.get("function", {})
            name = function.get("name", "")
            try:
                tool_input = json.loads(function.get("arguments") or "{}")
                parse_error = ""
            except json.JSONDecodeError as e:
                tool_input, parse_error = {}, f"도구 인자 JSON 파싱 실패: {e}"

            emit({"type": "tool_call", "name": name, "input": tool_input})
            if parse_error:
                ok, text = False, parse_error
            else:
                out = dispatcher.execute(name, tool_input)
                ok, text = out.ok, out.text
            emit({"type": "tool_result", "name": name, "ok": ok, "output": text})
            # OpenAI tool 메시지에는 is_error 플래그가 없어 접두어로 실패를 명시한다.
            content = text if ok else f"[TOOL ERROR] {text}"
            messages.append({"role": "tool", "tool_call_id": tc.get("id", ""), "content": content})

    final = f"최대 반복({MAX_ITERATIONS})에 도달하여 중단. 지금까지의 도구 호출 로그를 확인하세요."
    emit({"type": "max_iterations", "text": final})
    return final
