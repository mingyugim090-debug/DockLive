"""에이전트 루프 단위 테스트 — 가짜 OpenAI 클라이언트로 tool 호출 루프를 검증 (Phase 2)."""
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent import loop  # noqa: E402


def _response(content: str | None, tool_calls: list | None = None):
    """OpenAI chat.completions 응답 모양의 SimpleNamespace."""
    message = SimpleNamespace(content=content, tool_calls=tool_calls)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _tool_call(call_id: str, name: str, arguments: str):
    return SimpleNamespace(
        id=call_id,
        function=SimpleNamespace(name=name, arguments=arguments),
    )


class FakeClient:
    """미리 정해진 응답을 차례로 돌려주는 가짜 client.chat.completions.create."""

    def __init__(self, responses: list):
        self._responses = list(responses)
        self.calls: list[dict] = []
        self.chat = self
        self.completions = self

    def create(self, **kwargs):
        kwargs["messages"] = [dict(m) for m in kwargs["messages"]]  # 호출 시점 스냅샷
        self.calls.append(kwargs)
        return self._responses.pop(0)


def _run(monkeypatch, responses, request="테스트 요청", context=""):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")  # .env 탐색 차단
    client = FakeClient(responses)
    monkeypatch.setattr(loop.openai, "OpenAI", lambda: client)
    events: list[dict] = []
    final = loop.run_agent(request, context=context, on_event=events.append)
    return client, events, final


def test_plain_answer_returns_text_and_done_event(monkeypatch):
    responses = [_response("완료 보고입니다.")]
    _, events, final = _run(monkeypatch, responses)
    assert final == "완료 보고입니다."
    assert events[-1]["type"] == "done"
    assert events[-1]["iterations"] == 1


def test_tool_error_feeds_back_with_error_prefix_for_self_recovery(monkeypatch):
    # 1턴: 열린 워크북 없이 list_sheets 호출 → 에러 → 2턴: 모델이 보고로 마무리
    responses = [
        _response(None, [_tool_call("tc_1", "list_sheets", "{}")]),
        _response("워크북이 없어 열기부터 다시 안내합니다."),
    ]
    client, events, final = _run(monkeypatch, responses)

    tool_events = [e for e in events if e["type"] == "tool_result"]
    assert tool_events and tool_events[0]["ok"] is False

    # 두 번째 API 호출의 마지막 메시지는 role=tool + [TOOL ERROR] 접두어여야 한다.
    second_messages = client.calls[1]["messages"]
    tool_msg = second_messages[-1]
    assert tool_msg["role"] == "tool"
    assert tool_msg["tool_call_id"] == "tc_1"
    assert tool_msg["content"].startswith("[TOOL ERROR]")
    assert "open_workbook" in tool_msg["content"]
    assert "다시 안내" in final


def test_invalid_tool_arguments_fed_back_as_error(monkeypatch):
    responses = [
        _response(None, [_tool_call("tc_1", "read_range", "{잘못된 json")]),
        _response("인자를 고쳐 다시 시도하겠습니다."),
    ]
    client, events, _ = _run(monkeypatch, responses)
    tool_events = [e for e in events if e["type"] == "tool_result"]
    assert tool_events[0]["ok"] is False
    assert "JSON 파싱 실패" in tool_events[0]["output"]
    tool_msg = client.calls[1]["messages"][-1]
    assert tool_msg["role"] == "tool" and "[TOOL ERROR]" in tool_msg["content"]


def test_system_prompt_and_context_are_wrapped(monkeypatch):
    responses = [_response("ok")]
    client, _, _ = _run(monkeypatch, responses, request="채워줘", context="예산: 5000만원")
    messages = client.calls[0]["messages"]
    assert messages[0]["role"] == "system"
    first_user = messages[1]["content"]
    assert first_user.startswith("<참고자료>")
    assert "예산: 5000만원" in first_user
    assert first_user.rstrip().endswith("채워줘")


def test_tools_are_openai_function_format(monkeypatch):
    responses = [_response("ok")]
    client, _, _ = _run(monkeypatch, responses)
    tools = client.calls[0]["tools"]
    assert all(t["type"] == "function" for t in tools)
    assert any(t["function"]["name"] == "open_workbook" for t in tools)
    assert all("parameters" in t["function"] for t in tools)


def test_max_iterations_guard_stops_infinite_tool_use(monkeypatch):
    responses = [
        _response(None, [_tool_call(f"tc_{i}", "list_sheets", "{}")])
        for i in range(loop.MAX_ITERATIONS)
    ]
    _, events, final = _run(monkeypatch, responses)
    assert "최대 반복" in final
    assert events[-1]["type"] == "max_iterations"


def test_ensure_api_key_reads_env_file(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text('OPENAI_MODEL=x\nOPENAI_API_KEY="sk-from-file"\n', encoding="utf-8")
    monkeypatch.setattr(loop, "_ENV_FILES", [tmp_path / "없음.env", env_file])
    loop._ensure_api_key()
    assert loop.os.environ["OPENAI_API_KEY"] == "sk-from-file"
