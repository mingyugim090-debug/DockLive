"""에이전트 코어: Claude API tool_use 루프. 규약은 anthropic-tool-use-loop 스킬 참조."""
from __future__ import annotations

import os
from typing import Callable

import anthropic

from agent.prompts import SYSTEM_PROMPT
from executor import dispatcher
from tools.schemas import TOOLS

MODEL = os.environ.get("AGENT_MODEL", "claude-sonnet-4-6")
MAX_ITERATIONS = 25
MAX_TOKENS = 4096

EventCallback = Callable[[dict], None]


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
    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수 사용

    initial = user_request if not context else f"<참고자료>\n{context}\n</참고자료>\n\n{user_request}"
    messages: list[dict] = [{"role": "user", "content": initial}]

    for iteration in range(MAX_ITERATIONS):
        resp = client.messages.create(
            model=MODEL,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            max_tokens=MAX_TOKENS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            final = "".join(b.text for b in resp.content if b.type == "text")
            emit({"type": "done", "text": final, "iterations": iteration + 1})
            return final

        results = []
        for block in resp.content:
            if block.type != "tool_use":
                continue
            emit({"type": "tool_call", "name": block.name, "input": block.input})
            out = dispatcher.execute(block.name, block.input)
            emit({"type": "tool_result", "name": block.name, "ok": out.ok, "output": out.text})
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": out.text,
                "is_error": not out.ok,
            })
        messages.append({"role": "user", "content": results})

    final = f"최대 반복({MAX_ITERATIONS})에 도달하여 중단. 지금까지의 도구 호출 로그를 확인하세요."
    emit({"type": "max_iterations", "text": final})
    return final
