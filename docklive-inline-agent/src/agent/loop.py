"""에이전트 코어: OpenAI Chat Completions tool 호출 루프."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Callable

import openai

from agent.prompts import SYSTEM_PROMPT
from executor import dispatcher
from tools.schemas import OPENAI_TOOLS

MODEL = os.environ.get("AGENT_MODEL", "gpt-4o")
MAX_ITERATIONS = 25

# 일시적 API 오류(레이트리밋/네트워크/서버)는 백오프 후 재시도한다.
_RETRYABLE_ERRORS: tuple = (
    openai.RateLimitError,
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.InternalServerError,
)
_MAX_API_RETRIES = 5


def _create_with_retry(client, **kwargs):
    delay = 1.0
    for attempt in range(_MAX_API_RETRIES):
        try:
            return client.chat.completions.create(**kwargs)
        except _RETRYABLE_ERRORS:
            if attempt == _MAX_API_RETRIES - 1:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 15.0)

EventCallback = Callable[[dict], None]

# OPENAI_API_KEY 탐색 순서: 환경변수 → 이 저장소 .env → DockLive 백엔드 .env (키 공유)
_ENV_FILES = [
    Path(__file__).resolve().parents[2] / ".env",
    Path(__file__).resolve().parents[3] / "backend" / ".env",
]


def _ensure_api_key() -> None:
    """OPENAI_API_KEY가 환경에 없으면 .env 파일에서 찾아 주입한다."""
    if os.environ.get("OPENAI_API_KEY"):
        return
    for env_file in _ENV_FILES:
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == "OPENAI_API_KEY" and value.strip():
                os.environ["OPENAI_API_KEY"] = value.strip().strip('"').strip("'")
                return


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
    _ensure_api_key()
    client = openai.OpenAI()  # OPENAI_API_KEY 환경변수 사용

    initial = user_request if not context else f"<참고자료>\n{context}\n</참고자료>\n\n{user_request}"
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": initial},
    ]

    for iteration in range(MAX_ITERATIONS):
        resp = _create_with_retry(
            client,
            model=MODEL,
            messages=messages,
            tools=OPENAI_TOOLS,
        )
        msg = resp.choices[0].message
        tool_calls = msg.tool_calls or []

        if not tool_calls:
            final = msg.content or ""
            emit({"type": "done", "text": final, "iterations": iteration + 1})
            return final

        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            name = tc.function.name
            try:
                tool_input = json.loads(tc.function.arguments or "{}")
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
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": content})

    final = f"최대 반복({MAX_ITERATIONS})에 도달하여 중단. 지금까지의 도구 호출 로그를 확인하세요."
    emit({"type": "max_iterations", "text": final})
    return final
