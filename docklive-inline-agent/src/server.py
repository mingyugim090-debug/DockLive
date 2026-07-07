"""로컬 실행기 서버 (Phase 5) — 웹(Next.js) ↔ 로컬 에이전트 페어링.

웹 UI가 ws://127.0.0.1:8765/ws 로 접속해 요청을 보내면, 에이전트 루프의
도구 호출 이벤트를 실시간 JSON으로 스트리밍한다. 로컬 PC에서만 수신한다.

사용: python src/server.py   (기본 127.0.0.1:8765)
"""
from __future__ import annotations

import asyncio
import inspect
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from agent.loop import run_agent  # noqa: E402

HOST = "127.0.0.1"
PORT = 8765
_TERMINAL_EVENTS = {"done", "max_iterations", "error"}
_EXCEL_SUFFIXES = {".csv", ".tsv", ".xlsx", ".xls", ".xlsm"}
_HWPX_SUFFIXES = {".hwp", ".hwpx"}

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


@dataclass(frozen=True)
class BuiltAgentRequest:
    mode: str
    request: str
    context: str
    output_dir: str
    target_file: str
    source_files: list[str] = field(default_factory=list)
    open_result: bool = True


def _suffix(path: str) -> str:
    return Path(str(path)).suffix.lower()


def _select_mode(payload: dict) -> str:
    requested = str(payload.get("mode") or "auto").lower()
    if requested in {"excel", "hwpx"}:
        return requested
    if requested != "auto":
        raise ValueError("mode must be auto, excel, or hwpx")

    target = str(payload.get("target_file") or payload.get("file") or "")
    suffixes = [_suffix(target)]
    suffixes.extend(_suffix(path) for path in payload.get("source_files") or [])

    if any(suffix in _HWPX_SUFFIXES for suffix in suffixes):
        return "hwpx"
    return "excel"


def _source_files(payload: dict) -> list[str]:
    raw_source_files = payload.get("source_files") or []
    if isinstance(raw_source_files, (str, bytes)):
        raise ValueError("source_files must be a list of paths")

    source_files = [str(path).strip() for path in raw_source_files if str(path).strip()]
    legacy_source = str(payload.get("source") or "").strip()
    if legacy_source and legacy_source not in source_files:
        source_files.append(legacy_source)
    return source_files


def _coerce_open_result(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return True
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def _error_message(exc: Exception) -> str:
    if isinstance(exc, ValueError):
        return str(exc)
    return f"{type(exc).__name__}: {exc}"


def _build_context(
    *,
    mode: str,
    target_file: str,
    output_dir: str,
    source_files: list[str],
) -> str:
    lines = [
        "Local agent run inputs:",
        f"- Mode: {mode}",
        f"- Target file: {target_file or '(new file)'}",
        f"- Output folder: {output_dir}",
    ]
    if source_files:
        lines.append("- Source files:")
        lines.extend(f"  - {path}" for path in source_files)
    else:
        lines.append("- Source files: (none)")
    return "\n".join(lines)


def _build_request(payload: dict) -> BuiltAgentRequest:
    request = str(payload.get("request") or "").strip()
    if not request:
        raise ValueError("request field is required")

    output_dir = str(payload.get("output_dir") or "").strip()
    if not output_dir:
        raise ValueError("output_dir is required")

    target_file = str(payload.get("target_file") or payload.get("file") or "").strip()
    source_files = _source_files(payload)
    mode = _select_mode(payload)
    open_result = _coerce_open_result(payload.get("open_result", True))

    context = _build_context(
        mode=mode,
        target_file=target_file,
        output_dir=output_dir,
        source_files=source_files,
    )

    base_lines = [
        f"[Mode: {mode}] {request}",
        "",
        "Run contract:",
        f"- Target file: {target_file or '(create a new file)'}",
        f"- Output folder: {output_dir}",
        f"- Open result after saving: {open_result}",
        "- Save completed files inside the output folder; do not save beside source files.",
    ]

    if mode == "excel":
        mode_lines = [
            "",
            "Excel tool plan:",
            "- Use open_workbook when the target file exists.",
            "- Use create_workbook when a new workbook is needed.",
            "- Use write_range, format_range, create_chart, and save_workbook for workbook authoring.",
            "- Use source files only as grounding material; do not invent numbers or facts.",
        ]
    else:
        mode_lines = [
            "",
            "HWPX tool plan:",
            "- Use create_hwpx_session through DockLive backend HWPX compose/session APIs.",
            "- Use draft_hwpx_session for grounded section and field drafting.",
            "- Use export_hwpx_session to write the validated completed HWPX under the output folder.",
            "- Surface confirmation_required when values are missing; do not invent values.",
        ]

    return BuiltAgentRequest(
        mode=mode,
        request="\n".join(base_lines + mode_lines),
        context=context,
        output_dir=output_dir,
        target_file=target_file,
        source_files=source_files,
        open_result=open_result,
    )


async def _stream_callback_agent(user_request: str, context: str):
    queue: asyncio.Queue[dict | object] = asyncio.Queue()
    loop = asyncio.get_running_loop()
    sentinel = object()

    def on_event(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    def finish() -> None:
        loop.call_soon_threadsafe(queue.put_nowait, sentinel)

    def worker() -> None:
        try:
            run_agent(user_request, context=context, on_event=on_event)
        except Exception as exc:  # 에이전트 실패도 이벤트로 전달 (연결은 유지)
            on_event({"type": "error", "message": _error_message(exc)})
        finally:
            finish()

    task = loop.run_in_executor(None, worker)
    try:
        while True:
            event = await queue.get()
            if event is sentinel:
                break
            event_type = event.get("type")
            if event_type == "done":
                break
            yield event
            if event_type in _TERMINAL_EVENTS:
                break
    finally:
        try:
            await task
        except Exception:
            pass


async def _stream_agent_events(user_request: str, context: str):
    signature = inspect.signature(run_agent)
    is_callback_runner = (
        "on_event" in signature.parameters
        and not inspect.isasyncgenfunction(run_agent)
        and not inspect.iscoroutinefunction(run_agent)
    )
    if is_callback_runner:
        async for event in _stream_callback_agent(user_request, context):
            yield event
        return

    result = run_agent(user_request, context)
    if inspect.isawaitable(result):
        result = await result
    if hasattr(result, "__aiter__"):
        async for event in result:
            yield event


@app.websocket("/ws")
@app.websocket("/ws/agent")
async def agent_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        payload = await websocket.receive_json()
    except WebSocketDisconnect:
        return

    try:
        built = _build_request(payload)
    except ValueError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close()
        return

    await websocket.send_json({"type": "run_started"})
    await websocket.send_json({"type": "mode_selected", "mode": built.mode})

    disconnected = False
    try:
        async for event in _stream_agent_events(built.request, built.context):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        disconnected = True
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": _error_message(exc)})
    else:
        await websocket.send_json({"type": "done"})
    finally:
        if not disconnected:
            try:
                await websocket.close()
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
