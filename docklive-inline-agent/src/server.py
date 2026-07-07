"""로컬 실행기 서버 (Phase 5) — 웹(Next.js) ↔ 로컬 에이전트 페어링.

웹 UI가 ws://127.0.0.1:8765/ws 로 접속해 요청을 보내면, 에이전트 루프의
도구 호출 이벤트를 실시간 JSON으로 스트리밍한다. 로컬 PC에서만 수신한다.

사용: python src/server.py   (기본 127.0.0.1:8765)
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from agent.loop import run_agent  # noqa: E402
from tools.file_tools import read_document, relevant_excerpt  # noqa: E402

HOST = "127.0.0.1"
PORT = 8765
_TERMINAL_EVENTS = {"done", "max_iterations", "error"}

app = FastAPI(title="DockLive Inline Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://trgf5yzm.insforge.site"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "docklive-inline-agent"}


def _build_request(payload: dict) -> tuple[str, str]:
    request = str(payload.get("request") or "").strip()
    file_path = str(payload.get("file") or "").strip()
    source_path = str(payload.get("source") or "").strip()

    full_request = f"대상 파일: {file_path}\n요청: {request}" if file_path else request
    context = ""
    if source_path:
        parsed = read_document(source_path)
        if parsed["ok"]:
            context = relevant_excerpt(parsed["data"]["paragraphs"], request)
    return full_request, context


@app.websocket("/ws")
async def agent_ws(ws: WebSocket) -> None:
    await ws.accept()
    try:
        payload = await ws.receive_json()
    except WebSocketDisconnect:
        return
    if not str(payload.get("request") or "").strip():
        await ws.send_json({"type": "error", "text": "request 필드가 필요합니다."})
        await ws.close()
        return

    full_request, context = _build_request(payload)
    queue: asyncio.Queue[dict] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_event(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    def worker() -> None:
        try:
            run_agent(full_request, context=context, on_event=on_event)
        except Exception as e:  # 에이전트 실패도 이벤트로 전달 (연결은 유지)
            on_event({"type": "error", "text": f"{type(e).__name__}: {e}"})

    task = loop.run_in_executor(None, worker)
    try:
        while True:
            event = await queue.get()
            await ws.send_json(event)
            if event["type"] in _TERMINAL_EVENTS:
                break
    except WebSocketDisconnect:
        pass
    finally:
        # 스레드는 취소할 수 없으므로 종료까지 기다린다 (Excel 작업 중단 방지).
        try:
            await task
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
