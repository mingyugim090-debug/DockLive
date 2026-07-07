"""HWPX compose tool tests for the local document agent."""
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from tools import hwpx_tools  # noqa: E402


def fake_compose_response(api_url, path, request_text, applicant_context, title):
    return {
        "success": True,
        "filename": "completed.hwpx",
        "content": base64.b64encode(b"PK\x03\x04completed").decode("ascii"),
        "encoding": "base64",
        "warnings": ["check"],
        "verification": {"validation_passed": True},
        "generated_fields": {"summary": "drafted"},
        "confirmation_required": ["missing date"],
    }


def fake_export_response():
    return {
        "success": True,
        "filename": "session_completed.hwpx",
        "content": base64.b64encode(b"PK\x03\x04session").decode("ascii"),
        "encoding": "base64",
        "warnings": ["chart fallback"],
        "validation_summary": {"validation_passed": True},
    }


def test_compose_hwpx_form_requires_supported_source(tmp_path):
    source = tmp_path / "자료.txt"
    source.write_text("not hwpx", encoding="utf-8")

    out = hwpx_tools.compose_hwpx_form(str(source), "채워줘")

    assert out["ok"] is False
    assert "HWP 또는 HWPX" in out["error"]


def test_compose_hwpx_form_saves_into_output_dir(tmp_path, monkeypatch):
    source = tmp_path / "form.hwpx"
    source.write_bytes(b"PK\x03\x04source")
    output_dir = tmp_path / "done"
    monkeypatch.setattr(hwpx_tools, "_post_compose_request", fake_compose_response)

    out = hwpx_tools.compose_hwpx_form(
        path=str(source),
        request="Fill the form",
        output_dir=str(output_dir),
        filename="completed.hwpx",
    )

    assert out["ok"] is True
    assert out["data"]["saved_path"] == str(output_dir / "completed.hwpx")
    assert (output_dir / "completed.hwpx").read_bytes() == b"PK\x03\x04completed"


def test_compose_hwpx_form_open_result_uses_launcher(tmp_path, monkeypatch):
    source = tmp_path / "form.hwpx"
    source.write_bytes(b"PK\x03\x04source")
    opened = []
    monkeypatch.setattr(hwpx_tools, "_post_compose_request", fake_compose_response)
    monkeypatch.setattr(hwpx_tools, "_open_path", lambda path: opened.append(path))

    out = hwpx_tools.compose_hwpx_form(
        path=str(source),
        request="Fill",
        output_dir=str(tmp_path),
        open_result=True,
    )

    assert out["ok"] is True
    assert opened == [out["data"]["saved_path"]]


def test_hwpx_session_flow_posts_expected_endpoints(tmp_path, monkeypatch):
    source = tmp_path / "form.hwpx"
    source.write_bytes(b"PK\x03\x04source")
    calls = []

    monkeypatch.setattr(
        hwpx_tools,
        "_post_session_request",
        lambda *args, **kwargs: calls.append("session") or {"success": True, "data": {"id": "s1", "title": "Form"}},
    )
    monkeypatch.setattr(
        hwpx_tools,
        "_post_draft_all_request",
        lambda *args, **kwargs: calls.append("draft") or {"success": True, "data": {"id": "s1", "regions": []}},
    )
    monkeypatch.setattr(
        hwpx_tools,
        "_post_export_session_request",
        lambda *args, **kwargs: calls.append("export") or fake_export_response(),
    )

    session = hwpx_tools.create_hwpx_session(path=str(source))
    draft = hwpx_tools.draft_hwpx_session(session_id=session["data"]["session_id"], global_prompt="Use source only")
    export = hwpx_tools.export_hwpx_session(session_id="s1", output_dir=str(tmp_path))

    assert calls == ["session", "draft", "export"]
    assert draft["ok"] is True
    assert export["ok"] is True
    assert export["data"]["saved_path"].endswith(".hwpx")
    assert export["data"]["verification"]["validation_passed"] is True


def test_compose_hwpx_form_posts_to_backend_and_writes_output(tmp_path, monkeypatch):
    source = tmp_path / "신청서.hwpx"
    source.write_bytes(b"PK\x03\x04fake")
    output_bytes = b"PK\x03\x04completed"
    calls = []

    def fake_post(api_url, path, request_text, applicant_context, title):
        calls.append(
            {
                "api_url": api_url,
                "path": path,
                "request_text": request_text,
                "applicant_context": applicant_context,
                "title": title,
            }
        )
        return {
            "success": True,
            "filename": "신청서_completed.hwpx",
            "content": base64.b64encode(output_bytes).decode("ascii"),
            "encoding": "base64",
            "warnings": ["검토 필요"],
            "verification": {"validation_passed": True},
            "generated_fields": {"사업 개요": "자동 작성"},
            "confirmation_required": ["제출 전 검토"],
        }

    monkeypatch.setattr(hwpx_tools, "_post_compose_request", fake_post)

    out = hwpx_tools.compose_hwpx_form(
        str(source),
        "사업 개요를 채워줘",
        applicant_context="A사",
        api_url="http://127.0.0.1:8000",
    )

    assert out["ok"] is True
    assert Path(out["data"]["saved_path"]).read_bytes() == output_bytes
    assert out["data"]["warnings"] == ["검토 필요"]
    assert out["data"]["verification"]["validation_passed"] is True
    assert calls == [
        {
            "api_url": "http://127.0.0.1:8000",
            "path": str(source),
            "request_text": "사업 개요를 채워줘",
            "applicant_context": "A사",
            "title": "",
        }
    ]
