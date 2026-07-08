"""로컬 서버 WebSocket 스트리밍 테스트 (Phase 5) — 에이전트는 가짜로 대체."""
import base64
import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

fastapi_testclient = pytest.importorskip("fastapi.testclient")

import server  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

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


def test_select_output_folder_returns_path(monkeypatch, client):
    monkeypatch.setattr(server, "_select_output_folder_path", lambda: r"C:\work\done")

    res = client.get("/select-output-folder")

    assert res.status_code == 200
    assert res.json() == {"selected": True, "path": r"C:\work\done"}


def test_select_output_folder_reports_cancel(monkeypatch, client):
    monkeypatch.setattr(server, "_select_output_folder_path", lambda: "")

    res = client.get("/select-output-folder")

    assert res.status_code == 200
    assert res.json() == {"selected": False, "path": ""}


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


def test_build_request_carries_api_url_for_hwpx_tools():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Fill the uploaded HWP form",
            "file": r"C:\work\application.hwp",
            "output_dir": r"C:\work\done",
            "api_url": "https://docklive.onrender.com",
        }
    )

    assert built.mode == "hwpx"
    assert built.api_url == "https://docklive.onrender.com"
    assert "https://docklive.onrender.com" in built.request


def test_stream_agent_events_sets_livedock_api_url_for_hwpx_tools(monkeypatch):
    observed = {}

    def callback_agent(user_request, context="", on_event=None):
        observed["api_url"] = os.environ.get("LIVEDOCK_API_URL")
        on_event({"type": "done", "text": "ok", "iterations": 1})
        return "ok"

    async def collect_events():
        events = []
        async for event in server._stream_agent_events("request", "context", "https://docklive.onrender.com"):
            events.append(event)
        return events

    monkeypatch.delenv("LIVEDOCK_API_URL", raising=False)
    monkeypatch.setattr(server, "run_agent", callback_agent)

    events = asyncio.run(collect_events())

    assert observed["api_url"] == "https://docklive.onrender.com"
    assert os.environ.get("LIVEDOCK_API_URL") is None
    assert events == [{"type": "done", "text": "ok", "iterations": 1}]


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


def test_build_request_materializes_browser_uploads_and_targets_first_excel(tmp_path):
    encoded = base64.b64encode(b"PK-fake-xlsx").decode("ascii")

    built = server._build_request(
        {
            "mode": "auto",
            "request": "Fill the estimate workbook",
            "source_uploads": [
                {
                    "name": "estimate.xlsx",
                    "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "content_base64": encoded,
                }
            ],
            "output_dir": str(tmp_path),
        }
    )

    saved_source = Path(built.source_files[0])
    assert built.mode == "excel"
    assert saved_source.exists()
    assert saved_source.read_bytes() == b"PK-fake-xlsx"
    assert saved_source.name == "estimate.xlsx"
    assert saved_source.parent == tmp_path / ".docklive-agent-inputs"
    assert built.target_file == str(saved_source)
    assert str(saved_source) in built.context


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


def test_build_request_auto_routes_hwpx_from_legacy_source():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Fill the form",
            "file": r"C:\work\data.xlsx",
            "source": r"C:\work\form.hwpx",
            "output_dir": r"C:\work\done",
        }
    )

    assert built.mode == "hwpx"
    assert r"C:\work\form.hwpx" in built.source_files


def test_build_request_includes_source_excerpt(monkeypatch):
    def fake_read_document(path):
        assert path == r"C:\work\brief.pdf"
        return {
            "ok": True,
            "data": {
                "paragraphs": [
                    "Ignore this unrelated note.",
                    "Revenue increased 25 percent in Q4.",
                ]
            },
        }

    def fake_relevant_excerpt(paragraphs, request):
        assert "sales summary" in request
        return paragraphs[1]

    monkeypatch.setattr(server, "read_document", fake_read_document)
    monkeypatch.setattr(server, "relevant_excerpt", fake_relevant_excerpt)

    built = server._build_request(
        {
            "mode": "auto",
            "request": "Create a sales summary",
            "file": r"C:\work\sales.xlsx",
            "source": r"C:\work\brief.pdf",
            "output_dir": r"C:\work\done",
        }
    )

    assert r"C:\work\brief.pdf" in built.context
    assert "Revenue increased 25 percent in Q4." in built.context


def test_build_request_rejects_dict_source_files():
    with pytest.raises(ValueError, match="source_files"):
        server._build_request(
            {
                "mode": "auto",
                "request": "make report",
                "file": "x.xlsx",
                "source_files": {"path": "form.hwpx"},
                "output_dir": "C:/out",
            }
        )


def test_build_request_rejects_non_list_source_files_iterable():
    with pytest.raises(ValueError, match="source_files"):
        server._build_request(
            {
                "mode": "auto",
                "request": "make report",
                "file": "x.xlsx",
                "source_files": ("form.hwpx",),
                "output_dir": "C:/out",
            }
        )


def test_build_request_strips_mode_before_lowering():
    built = server._build_request(
        {
            "mode": " HWPX ",
            "request": "Fill the form",
            "file": r"C:\work\form.xlsx",
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


def test_ws_async_generator_error_stops_later_done(monkeypatch, client):
    async def error_then_done(user_request, context=""):
        yield {"type": "error", "message": "tool failed"}
        yield {"type": "done", "text": "should not be sent", "iterations": 1}

    monkeypatch.setattr(server, "run_agent", error_then_done)

    with client.websocket_connect("/ws/agent") as ws:
        ws.send_json({"request": "make workbook", "file": "x.xlsx", "output_dir": "C:/out"})
        assert ws.receive_json()["type"] == "run_started"
        assert ws.receive_json() == {"type": "mode_selected", "mode": "excel"}
        assert ws.receive_json() == {"type": "error", "message": "tool failed"}
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_ws_compat_forwards_callback_done_without_generic_done(monkeypatch, client):
    def callback_agent(user_request, context="", on_event=None):
        on_event({"type": "tool_call", "name": "open_workbook", "input": {"path": "x.xlsx"}})
        on_event({"type": "done", "text": "callback complete", "iterations": 3})
        return "callback complete"

    monkeypatch.setattr(server, "run_agent", callback_agent)

    with client.websocket_connect("/ws") as ws:
        ws.send_json({"request": "make workbook", "file": "x.xlsx", "output_dir": "C:/out"})
        assert ws.receive_json()["type"] == "run_started"
        assert ws.receive_json() == {"type": "mode_selected", "mode": "excel"}
        assert ws.receive_json()["type"] == "tool_call"
        assert ws.receive_json() == {"type": "done", "text": "callback complete", "iterations": 3}
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_ws_callback_error_does_not_emit_generic_done(monkeypatch, client):
    def callback_agent(user_request, context="", on_event=None):
        on_event({"type": "error", "message": "tool failed"})
        return "failed"

    monkeypatch.setattr(server, "run_agent", callback_agent)

    with client.websocket_connect("/ws/agent") as ws:
        ws.send_json({"request": "make workbook", "file": "x.xlsx", "output_dir": "C:/out"})
        assert ws.receive_json()["type"] == "run_started"
        assert ws.receive_json() == {"type": "mode_selected", "mode": "excel"}
        assert ws.receive_json() == {"type": "error", "message": "tool failed"}
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_ws_callback_max_iterations_does_not_emit_generic_done(monkeypatch, client):
    def callback_agent(user_request, context="", on_event=None):
        on_event({"type": "max_iterations", "text": "stopped", "iterations": 25})
        return "stopped"

    monkeypatch.setattr(server, "run_agent", callback_agent)

    with client.websocket_connect("/ws/agent") as ws:
        ws.send_json({"request": "make workbook", "file": "x.xlsx", "output_dir": "C:/out"})
        assert ws.receive_json()["type"] == "run_started"
        assert ws.receive_json() == {"type": "mode_selected", "mode": "excel"}
        assert ws.receive_json() == {"type": "max_iterations", "text": "stopped", "iterations": 25}
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
