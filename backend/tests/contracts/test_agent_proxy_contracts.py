"""로컬 에이전트 OpenAI 프록시(/api/agent/chat) 계약 테스트.

토큰 검증, 분당 레이트리밋, MOCK_MODE 차단, OpenAI 응답 전달을 검증한다.
실제 OpenAI 호출은 urllib.request.urlopen을 모킹해 오프라인으로 검증한다.
"""
import json
import sys
import unittest
import urllib.error
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import asyncio  # noqa: E402

from fastapi import HTTPException  # noqa: E402

from core.config import settings  # noqa: E402
from routers import agent as agent_router  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


class FakeHttpResponse:
    def __init__(self, payload: dict):
        self._body = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class AgentProxyContractTests(unittest.TestCase):
    def setUp(self):
        self._token = settings.AGENT_PROXY_TOKEN
        self._mock = settings.MOCK_MODE
        self._key = settings.OPENAI_API_KEY
        self._limit = settings.AGENT_PROXY_MAX_PER_MINUTE
        agent_router._rate_buckets.clear()

    def tearDown(self):
        settings.AGENT_PROXY_TOKEN = self._token
        settings.MOCK_MODE = self._mock
        settings.OPENAI_API_KEY = self._key
        settings.AGENT_PROXY_MAX_PER_MINUTE = self._limit
        agent_router._rate_buckets.clear()

    def test_rejects_wrong_token_when_configured(self):
        settings.AGENT_PROXY_TOKEN = "secret-token"
        request = agent_router.AgentChatRequest(messages=[{"role": "user", "content": "hi"}])
        with self.assertRaises(HTTPException) as ctx:
            _run(agent_router.agent_chat(request, x_agent_token="wrong"))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_allows_any_token_when_none_configured(self):
        settings.AGENT_PROXY_TOKEN = ""
        settings.MOCK_MODE = False
        settings.OPENAI_API_KEY = "sk-real"
        request = agent_router.AgentChatRequest(messages=[{"role": "user", "content": "hi"}])
        with patch("routers.agent.urllib.request.urlopen", return_value=FakeHttpResponse(
            {"choices": [{"message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}]}
        )):
            result = _run(agent_router.agent_chat(request, x_agent_token="anything"))
        self.assertTrue(result.success)

    def test_blocks_when_ai_not_configured(self):
        settings.AGENT_PROXY_TOKEN = ""
        settings.MOCK_MODE = True
        request = agent_router.AgentChatRequest(messages=[{"role": "user", "content": "hi"}])
        with self.assertRaises(HTTPException) as ctx:
            _run(agent_router.agent_chat(request, x_agent_token=""))
        self.assertEqual(ctx.exception.status_code, 503)

    def test_rate_limit_enforced_per_token(self):
        settings.AGENT_PROXY_MAX_PER_MINUTE = 2
        agent_router._check_rate_limit("tok-a")
        agent_router._check_rate_limit("tok-a")
        with self.assertRaises(HTTPException) as ctx:
            agent_router._check_rate_limit("tok-a")
        self.assertEqual(ctx.exception.status_code, 429)
        # 다른 토큰은 별도 버킷 — 영향받지 않음
        agent_router._check_rate_limit("tok-b")

    def test_openai_http_error_becomes_http_exception(self):
        settings.AGENT_PROXY_TOKEN = ""
        settings.MOCK_MODE = False
        settings.OPENAI_API_KEY = "sk-real"
        request = agent_router.AgentChatRequest(messages=[{"role": "user", "content": "hi"}])
        error = urllib.error.HTTPError(
            "https://api.openai.com/v1/chat/completions", 429, "rate limited", None, BytesIO(b"limit hit")
        )
        with patch("routers.agent.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(HTTPException) as ctx:
                _run(agent_router.agent_chat(request, x_agent_token=""))
        self.assertEqual(ctx.exception.status_code, 429)

    def test_request_forwards_model_and_tools_with_auth_header(self):
        settings.AGENT_PROXY_TOKEN = ""
        settings.MOCK_MODE = False
        settings.OPENAI_API_KEY = "sk-real-key"
        tools = [{"type": "function", "function": {"name": "open_workbook", "parameters": {}}}]
        request = agent_router.AgentChatRequest(
            model="gpt-4o-mini", messages=[{"role": "user", "content": "hi"}], tools=tools
        )
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["headers"] = dict(req.headers)
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return FakeHttpResponse(
                {"choices": [{"message": {"role": "assistant", "tool_calls": []}, "finish_reason": "stop"}]}
            )

        with patch("routers.agent.urllib.request.urlopen", side_effect=fake_urlopen):
            _run(agent_router.agent_chat(request, x_agent_token=""))

        self.assertEqual(captured["headers"].get("Authorization"), "Bearer sk-real-key")
        self.assertEqual(captured["body"]["model"], "gpt-4o-mini")
        self.assertEqual(captured["body"]["tools"], tools)


if __name__ == "__main__":
    unittest.main()
