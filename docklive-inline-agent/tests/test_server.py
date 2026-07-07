"""로컬 서버 WebSocket 스트리밍 테스트 (Phase 5) — 에이전트는 가짜로 대체."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

fastapi_testclient = pytest.importorskip("fastapi.testclient")

import server  # noqa: E402

client = fastapi_testclient.TestClient(server.app)


def fake_run_agent(user_request: str, context: str = "", on_event=None):
    on_event({"type": "tool_call", "name": "open_workbook", "input": {"path": "x.xlsx"}})
    on_event({"type": "tool_result", "name": "open_workbook", "ok": True, "output": "{}"})
    on_event({"type": "done", "text": f"요청 처리 완료: {user_request[:20]}", "iterations": 1})
    return "요청 처리 완료"


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["service"] == "docklive-inline-agent"


def test_ws_streams_tool_events_then_done(monkeypatch):
    monkeypatch.setattr(server, "run_agent", fake_run_agent)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"request": "견적서 채워줘", "file": "C:/견적서.xlsx"})
        first = ws.receive_json()
        second = ws.receive_json()
        last = ws.receive_json()
    assert first["type"] == "tool_call" and first["name"] == "open_workbook"
    assert second["type"] == "tool_result" and second["ok"] is True
    assert last["type"] == "done"
    assert "대상 파일" in last["text"] or "요청 처리" in last["text"]


def test_ws_rejects_empty_request():
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"request": ""})
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "request" in event["text"]


def test_ws_agent_exception_becomes_error_event(monkeypatch):
    def boom(user_request, context="", on_event=None):
        raise RuntimeError("OPENAI_API_KEY 미설정")

    monkeypatch.setattr(server, "run_agent", boom)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"request": "아무거나"})
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "OPENAI_API_KEY" in event["text"]
