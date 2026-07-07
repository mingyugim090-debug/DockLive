"""로컬 서버 WebSocket 스트리밍 테스트 (Phase 5) — 에이전트는 가짜로 대체."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

fastapi_testclient = pytest.importorskip("fastapi.testclient")

import server  # noqa: E402

@pytest.fixture()
def client():
    with fastapi_testclient.TestClient(server.app) as test_client:
        yield test_client


async def fake_run_agent(user_request: str, context: str = ""):
    yield {"type": "tool_call", "name": "open_workbook", "input": {"path": "x.xlsx"}}
    yield {"type": "tool_result", "name": "open_workbook", "ok": True, "output": "{}"}


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["service"] == "docklive-inline-agent"


def test_build_request_auto_routes_excel_and_carries_output_dir():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Create a sales summary chart",
            "file": r"C:\work\sales.csv",
            "source_files": [r"C:\work\sales.csv", r"C:\work\brief.pdf"],
            "output_dir": r"C:\work\done",
            "open_result": True,
        }
    )

    assert built.mode == "excel"
    assert built.request.startswith("[Mode: excel]")
    assert "C:\\work\\done" in built.request
    assert "C:\\work\\sales.csv" in built.context
    assert built.output_dir == r"C:\work\done"
    assert built.open_result is True


def test_build_request_auto_routes_hwpx_from_target_extension():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Fill the form from the uploaded notice",
            "file": r"C:\work\form.hwpx",
            "source_files": [r"C:\work\notice.pdf"],
            "output_dir": r"C:\work\done",
        }
    )

    assert built.mode == "hwpx"
    assert "Use create_hwpx_session" in built.request
    assert "Use draft_hwpx_session" in built.request
    assert "Use export_hwpx_session" in built.request


def test_build_request_prefers_target_file_for_auto_route():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Fill the target form from spreadsheet data",
            "file": r"C:\work\data.xlsx",
            "target_file": r"C:\work\form.hwpx",
            "source_files": [r"C:\work\data.xlsx"],
            "output_dir": r"C:\work\done",
        }
    )

    assert built.mode == "hwpx"
    assert built.target_file == r"C:\work\form.hwpx"


def test_build_request_auto_routes_hwpx_from_source_files():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Prepare the workbook using the uploaded form",
            "file": r"C:\work\data.xlsx",
            "source_files": [r"C:\work\form.hwp"],
            "output_dir": r"C:\work\done",
        }
    )

    assert built.mode == "hwpx"


def test_build_request_rejects_missing_output_dir():
    with pytest.raises(ValueError, match="output_dir"):
        server._build_request({"mode": "auto", "request": "make report", "file": "x.xlsx"})


def test_websocket_emits_normalized_start_events(monkeypatch, client):
    events = []

    async def fake_run_agent(request, context):
        events.append((request, context))
        yield {"type": "tool_result", "tool": "save_workbook", "result": {"saved_path": "out.xlsx"}}

    monkeypatch.setattr(server, "run_agent", fake_run_agent)

    with client.websocket_connect("/ws/agent") as websocket:
        websocket.send_json(
            {
                "mode": "auto",
                "request": "make workbook",
                "file": r"C:\work\sales.csv",
                "output_dir": r"C:\work\done",
            }
        )
        first = websocket.receive_json()
        second = websocket.receive_json()
        third = websocket.receive_json()

    assert first["type"] == "run_started"
    assert second == {"type": "mode_selected", "mode": "excel"}
    assert third["type"] == "tool_result"


def test_ws_rejects_empty_request(client):
    with client.websocket_connect("/ws/agent") as ws:
        ws.send_json({"request": "", "output_dir": "C:/out"})
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "request" in event["message"]


def test_ws_agent_exception_becomes_error_event(monkeypatch, client):
    async def boom(user_request, context=""):
        raise RuntimeError("OPENAI_API_KEY 미설정")
        yield

    monkeypatch.setattr(server, "run_agent", boom)
    with client.websocket_connect("/ws/agent") as ws:
        ws.send_json({"request": "아무거나", "file": "x.xlsx", "output_dir": "C:/out"})
        assert ws.receive_json()["type"] == "run_started"
        assert ws.receive_json() == {"type": "mode_selected", "mode": "excel"}
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "OPENAI_API_KEY" in event["message"]


def test_ws_agent_value_error_streams_message_only(monkeypatch, client):
    async def invalid_request(user_request, context=""):
        raise ValueError("missing workbook path")
        yield

    monkeypatch.setattr(server, "run_agent", invalid_request)

    with client.websocket_connect("/ws/agent") as ws:
        ws.send_json({"request": "make workbook", "file": "x.xlsx", "output_dir": "C:/out"})
        assert ws.receive_json()["type"] == "run_started"
        assert ws.receive_json() == {"type": "mode_selected", "mode": "excel"}
        event = ws.receive_json()

    assert event == {"type": "error", "message": "missing workbook path"}
