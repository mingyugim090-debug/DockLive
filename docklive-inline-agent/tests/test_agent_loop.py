"""에이전트 루프 단위 테스트 — 가짜 Anthropic 클라이언트로 tool_use 루프를 검증 (Phase 2)."""
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent import loop  # noqa: E402


class FakeResponse:
    def __init__(self, stop_reason: str, content: list):
        self.stop_reason = stop_reason
        self.content = content


def _tool_use(block_id: str, name: str, tool_input: dict):
    return SimpleNamespace(type="tool_use", id=block_id, name=name, input=tool_input)


def _text(text: str):
    return SimpleNamespace(type="text", text=text)


class FakeClient:
    """미리 정해진 응답을 차례로 돌려주는 가짜 client.messages.create."""

    def __init__(self, responses: list[FakeResponse]):
        self._responses = list(responses)
        self.calls: list[dict] = []
        self.messages = self

    def create(self, **kwargs):
        kwargs["messages"] = list(kwargs["messages"])  # 호출 시점 스냅샷 (루프가 리스트를 계속 append함)
        self.calls.append(kwargs)
        return self._responses.pop(0)


def _run(monkeypatch, responses, request="테스트 요청", context=""):
    client = FakeClient(responses)
    monkeypatch.setattr(loop.anthropic, "Anthropic", lambda: client)
    events: list[dict] = []
    final = loop.run_agent(request, context=context, on_event=events.append)
    return client, events, final


def test_plain_answer_returns_text_and_done_event(monkeypatch):
    responses = [FakeResponse("end_turn", [_text("완료 보고입니다.")])]
    _, events, final = _run(monkeypatch, responses)
    assert final == "완료 보고입니다."
    assert events[-1]["type"] == "done"
    assert events[-1]["iterations"] == 1


def test_tool_error_feeds_back_with_is_error_for_self_recovery(monkeypatch):
    # 1턴: 열린 워크북 없이 list_sheets 호출 → 에러 → 2턴: 모델이 보고로 마무리
    responses = [
        FakeResponse("tool_use", [_tool_use("tu_1", "list_sheets", {})]),
        FakeResponse("end_turn", [_text("워크북이 없어 열기부터 다시 안내합니다.")]),
    ]
    client, events, final = _run(monkeypatch, responses)

    tool_events = [e for e in events if e["type"] == "tool_result"]
    assert tool_events and tool_events[0]["ok"] is False

    # 두 번째 API 호출의 마지막 user 메시지에 is_error=True tool_result가 들어가야 한다.
    second_messages = client.calls[1]["messages"]
    tool_result = second_messages[-1]["content"][0]
    assert tool_result["type"] == "tool_result"
    assert tool_result["tool_use_id"] == "tu_1"
    assert tool_result["is_error"] is True
    assert "open_workbook" in tool_result["content"]
    assert "다시 안내" in final


def test_context_is_wrapped_in_reference_tags(monkeypatch):
    responses = [FakeResponse("end_turn", [_text("ok")])]
    client, _, _ = _run(monkeypatch, responses, request="채워줘", context="예산: 5000만원")
    first_user = client.calls[0]["messages"][0]["content"]
    assert first_user.startswith("<참고자료>")
    assert "예산: 5000만원" in first_user
    assert first_user.rstrip().endswith("채워줘")


def test_max_iterations_guard_stops_infinite_tool_use(monkeypatch):
    responses = [
        FakeResponse("tool_use", [_tool_use(f"tu_{i}", "list_sheets", {})])
        for i in range(loop.MAX_ITERATIONS)
    ]
    _, events, final = _run(monkeypatch, responses)
    assert "최대 반복" in final
    assert events[-1]["type"] == "max_iterations"
