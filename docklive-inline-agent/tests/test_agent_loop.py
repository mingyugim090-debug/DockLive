"""에이전트 루프 단위 테스트 — DockLive 백엔드 프록시 호출을 가짜로 대체해 검증 (Phase 2)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent import loop  # noqa: E402


def _message(content=None, tool_calls=None):
    msg = {"content": content}
    if tool_calls is not None:
        msg["tool_calls"] = tool_calls
    return msg


def _tool_call(call_id: str, name: str, arguments: str):
    return {"id": call_id, "type": "function", "function": {"name": name, "arguments": arguments}}


class FakeProxy:
    """미리 정해진 백엔드 응답을 차례로 돌려주는 가짜 _call_agent_proxy."""

    def __init__(self, responses: list):
        self._responses = list(responses)
        self.calls: list[dict] = []

    def __call__(self, messages, tools):
        self.calls.append({"messages": [dict(m) for m in messages], "tools": tools})
        return self._responses.pop(0)


def _run(monkeypatch, responses, request="테스트 요청", context=""):
    monkeypatch.setenv("AGENT_PROXY_TOKEN", "test-token")
    proxy = FakeProxy(responses)
    monkeypatch.setattr(loop, "_call_agent_proxy", proxy)
    events: list[dict] = []
    final = loop.run_agent(request, context=context, on_event=events.append)
    return proxy, events, final


def test_plain_answer_returns_text_and_done_event(monkeypatch):
    responses = [_message("완료 보고입니다.")]
    _, events, final = _run(monkeypatch, responses)
    assert final == "완료 보고입니다."
    assert events[-1]["type"] == "done"
    assert events[-1]["iterations"] == 1


def test_tool_error_feeds_back_with_error_prefix_for_self_recovery(monkeypatch):
    # 1턴: 열린 워크북 없이 list_sheets 호출 → 에러 → 2턴: 모델이 보고로 마무리
    responses = [
        _message(None, [_tool_call("tc_1", "list_sheets", "{}")]),
        _message("워크북이 없어 열기부터 다시 안내합니다."),
    ]
    proxy, events, final = _run(monkeypatch, responses)

    tool_events = [e for e in events if e["type"] == "tool_result"]
    assert tool_events and tool_events[0]["ok"] is False

    second_messages = proxy.calls[1]["messages"]
    tool_msg = second_messages[-1]
    assert tool_msg["role"] == "tool"
    assert tool_msg["tool_call_id"] == "tc_1"
    assert tool_msg["content"].startswith("[TOOL ERROR]")
    assert "open_workbook" in tool_msg["content"]
    assert "다시 안내" in final


def test_invalid_tool_arguments_fed_back_as_error(monkeypatch):
    responses = [
        _message(None, [_tool_call("tc_1", "read_range", "{잘못된 json")]),
        _message("인자를 고쳐 다시 시도하겠습니다."),
    ]
    proxy, events, _ = _run(monkeypatch, responses)
    tool_events = [e for e in events if e["type"] == "tool_result"]
    assert tool_events[0]["ok"] is False
    assert "JSON 파싱 실패" in tool_events[0]["output"]
    tool_msg = proxy.calls[1]["messages"][-1]
    assert tool_msg["role"] == "tool" and "[TOOL ERROR]" in tool_msg["content"]


def test_system_prompt_and_context_are_wrapped(monkeypatch):
    responses = [_message("ok")]
    proxy, _, _ = _run(monkeypatch, responses, request="채워줘", context="예산: 5000만원")
    messages = proxy.calls[0]["messages"]
    assert messages[0]["role"] == "system"
    first_user = messages[1]["content"]
    assert first_user.startswith("<참고자료>")
    assert "예산: 5000만원" in first_user
    assert first_user.rstrip().endswith("채워줘")


def test_tools_are_openai_function_format(monkeypatch):
    responses = [_message("ok")]
    proxy, _, _ = _run(monkeypatch, responses)
    tools = proxy.calls[0]["tools"]
    assert all(t["type"] == "function" for t in tools)
    assert any(t["function"]["name"] == "open_workbook" for t in tools)
    assert all("parameters" in t["function"] for t in tools)


def test_max_iterations_guard_stops_infinite_tool_use(monkeypatch):
    responses = [
        _message(None, [_tool_call(f"tc_{i}", "list_sheets", "{}")])
        for i in range(loop.MAX_ITERATIONS)
    ]
    _, events, final = _run(monkeypatch, responses)
    assert "최대 반복" in final
    assert events[-1]["type"] == "max_iterations"


def test_retryable_proxy_error_is_retried_then_succeeds(monkeypatch):
    monkeypatch.setenv("AGENT_PROXY_TOKEN", "test-token")
    monkeypatch.setattr(loop.time, "sleep", lambda _s: None)
    call_count = {"n": 0}

    def flaky(messages, tools):
        call_count["n"] += 1
        if call_count["n"] < 3:
            raise loop._RetryableProxyError("429")
        return _message("완료")

    monkeypatch.setattr(loop, "_call_agent_proxy", flaky)
    final = loop.run_agent("테스트", on_event=lambda _e: None)
    assert final == "완료"
    assert call_count["n"] == 3


def test_non_retryable_proxy_error_raises(monkeypatch):
    monkeypatch.setenv("AGENT_PROXY_TOKEN", "test-token")

    def always_fails(messages, tools):
        raise loop.AgentProxyError("DockLive 서버 오류 (401): 유효하지 않은 Agent 토큰입니다.")

    monkeypatch.setattr(loop, "_call_agent_proxy", always_fails)
    try:
        loop.run_agent("테스트", on_event=lambda _e: None)
        assert False, "AgentProxyError가 전파돼야 함"
    except loop.AgentProxyError as exc:
        assert "401" in str(exc)


def test_ensure_agent_token_reads_env_file(monkeypatch, tmp_path):
    monkeypatch.delenv("AGENT_PROXY_TOKEN", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text('SOMETHING=x\nAGENT_PROXY_TOKEN="tok-from-file"\n', encoding="utf-8")
    monkeypatch.setattr(loop, "_bundled_env_files", lambda: [tmp_path / "없음.env", env_file])
    loop._ensure_agent_token()
    assert loop.os.environ["AGENT_PROXY_TOKEN"] == "tok-from-file"


def test_api_url_defaults_to_production_backend(monkeypatch):
    monkeypatch.delenv("LIVEDOCK_API_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_API_URL", raising=False)
    assert loop._api_url() == loop._DEFAULT_API_URL


def test_api_url_prefers_livedock_api_url_env(monkeypatch):
    monkeypatch.setenv("LIVEDOCK_API_URL", "http://127.0.0.1:8000/")
    assert loop._api_url() == "http://127.0.0.1:8000"
