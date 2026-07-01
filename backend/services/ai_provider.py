import json
import logging
import os
import re
import urllib.error
import urllib.request
import hashlib
import math
from typing import Any, Iterator, Literal

from core.config import settings
from core.errors import AnalysisError

logger = logging.getLogger(__name__)

AiTask = Literal["analysis", "draft", "match"]
MOCK_EMBEDDING_MODEL = "mock-token-hash-64"
MOCK_EMBEDDING_DIMENSION = 64


def provider_name() -> str:
    return (settings.AI_PROVIDER or "openai").strip().lower()


def _provider_key() -> str:
    if provider_name() == "gemma":
        return settings.GEMINI_API_KEY or getattr(settings, "GOOGLE_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
    return settings.OPENAI_API_KEY


def _is_placeholder_key(value: str) -> bool:
    key = (value or "").strip()
    if not key:
        return True
    lowered = key.lower()
    return lowered.startswith("mock") or "your_" in lowered or "your-" in lowered or "placeholder" in lowered


def should_use_mock_ai() -> bool:
    return bool(settings.MOCK_MODE or _is_placeholder_key(_provider_key()))


def _model_for_task(task: AiTask) -> str:
    if provider_name() == "gemma":
        return settings.GEMMA_DRAFT_MODEL if task == "draft" else settings.GEMMA_ANALYSIS_MODEL
    return settings.OPENAI_DRAFT_MODEL if task == "draft" else settings.OPENAI_ANALYSIS_MODEL


def _temperature_for_task(task: AiTask) -> float:
    if task in {"analysis", "match"}:
        return 0.0
    return 0.2


def clean_json(text: str) -> str:
    text = (text or "").strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if code_block:
        return code_block.group(1).strip()
    json_match = re.search(r"\{[\s\S]+\}", text)
    if json_match:
        return json_match.group(0).strip()
    return text


def call_json(
    task: AiTask,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
    json_schema: dict[str, Any] | None = None,
    schema_name: str | None = None,
) -> dict:
    provider = provider_name()
    if should_use_mock_ai():
        raise AnalysisError("AI API 키가 설정되지 않았습니다. MOCK_MODE를 사용하거나 provider API 키를 설정하세요.")
    if provider == "gemma":
        return _call_gemma_json(task, system_prompt, user_prompt, max_tokens)
    if provider == "openai":
        return _call_openai_json(task, system_prompt, user_prompt, max_tokens, json_schema, schema_name)
    raise AnalysisError(f"지원하지 않는 AI_PROVIDER입니다: {provider}")


def stream_text(task: AiTask, system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> Iterator[str]:
    """Stream text chunks for long-running draft generation when the provider supports it."""
    provider = provider_name()
    if should_use_mock_ai():
        raise AnalysisError("AI API 키가 설정되지 않았습니다. MOCK_MODE를 사용하거나 provider API 키를 설정하세요.")
    if provider != "openai":
        raise AnalysisError("실시간 토큰 스트리밍은 현재 OpenAI provider에서만 지원됩니다.")
    yield from _stream_openai_text(task, system_prompt, user_prompt, max_tokens)


def embed_text(text: str) -> tuple[list[float], str]:
    """Return an embedding through the configured provider abstraction.

    Agency NoticeOps uses this wrapper so recall code stays provider-neutral.
    In mock or missing-key environments the hash embedding is deterministic,
    small, and good enough for contract ranking tests.
    """
    cleaned = (text or "").strip()
    if should_use_mock_ai() or not settings.OPENAI_API_KEY:
        return _mock_embedding(cleaned), MOCK_EMBEDDING_MODEL
    return _call_openai_embedding(cleaned)


def _mock_embedding(text: str) -> list[float]:
    vector = [0.0] * MOCK_EMBEDDING_DIMENSION
    tokens = re.findall(r"[0-9A-Za-z가-힣]+", text.lower())
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:2], "big") % MOCK_EMBEDDING_DIMENSION
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _call_openai_embedding(text: str) -> tuple[list[float], str]:
    model = settings.OPENAI_EMBEDDING_MODEL
    try:
        from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError
    except ImportError:
        return _call_openai_embedding_http(text, model), model

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.embeddings.create(model=model, input=text[:16_000])
        return list(response.data[0].embedding), model
    except AuthenticationError as exc:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.") from exc
    except APIConnectionError as exc:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc
    except RateLimitError as exc:
        raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from exc


def _call_openai_embedding_http(text: str, model: str) -> list[float]:
    payload = {"model": model, "input": text[:16_000]}
    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
        embedding = data.get("data", [{}])[0].get("embedding", [])
        return [float(value) for value in embedding]
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        if exc.code in {401, 403}:
            raise AnalysisError("OpenAI API 키가 유효하지 않습니다.") from exc
        if exc.code == 429:
            raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from exc
        raise AnalysisError(f"OpenAI embedding 요청에 실패했습니다: {detail}") from exc
    except urllib.error.URLError as exc:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc


def _structured_response_format(json_schema: dict[str, Any] | None, schema_name: str | None) -> dict[str, Any]:
    if not json_schema:
        return {"type": "json_object"}
    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name or f"livedock_{task_safe_name(json_schema)}",
            "strict": True,
            "schema": json_schema,
        },
    }


def task_safe_name(json_schema: dict[str, Any]) -> str:
    title = str(json_schema.get("title") or "schema").lower()
    safe = re.sub(r"[^a-z0-9_-]+", "_", title).strip("_")
    return safe[:48] or "schema"


def _call_openai_json(
    task: AiTask,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    json_schema: dict[str, Any] | None = None,
    schema_name: str | None = None,
) -> dict:
    try:
        from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError
    except ImportError:
        logger.info("OpenAI SDK is not installed; using urllib fallback for JSON request.")
        return _call_openai_json_http(task, system_prompt, user_prompt, max_tokens, json_schema, schema_name)

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model=_model_for_task(task),
            max_tokens=max_tokens,
            temperature=_temperature_for_task(task),
            response_format=_structured_response_format(json_schema, schema_name),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        message = completion.choices[0].message
        refusal = getattr(message, "refusal", None)
        if refusal:
            raise AnalysisError(f"AI가 요청을 거부했습니다: {refusal}")
        return json.loads(clean_json(message.content or "{}"))
    except json.JSONDecodeError as exc:
        raise exc
    except AuthenticationError as exc:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.") from exc
    except APIConnectionError as exc:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc
    except RateLimitError as exc:
        raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from exc


def _call_openai_json_http(
    task: AiTask,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    json_schema: dict[str, Any] | None = None,
    schema_name: str | None = None,
) -> dict:
    payload = {
        "model": _model_for_task(task),
        "max_tokens": max_tokens,
        "temperature": _temperature_for_task(task),
        "response_format": _structured_response_format(json_schema, schema_name),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
        message = data.get("choices", [{}])[0].get("message", {})
        if message.get("refusal"):
            raise AnalysisError(f"AI가 요청을 거부했습니다: {message['refusal']}")
        content = message.get("content", "{}")
        return json.loads(clean_json(content))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        if exc.code in {401, 403}:
            raise AnalysisError("OpenAI API 키가 유효하지 않습니다.") from exc
        if exc.code == 429:
            raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from exc
        raise AnalysisError(f"OpenAI API 요청에 실패했습니다: {detail}") from exc
    except urllib.error.URLError as exc:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc


def _stream_openai_text(task: AiTask, system_prompt: str, user_prompt: str, max_tokens: int) -> Iterator[str]:
    try:
        from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError
    except ImportError as exc:
        raise AnalysisError("OpenAI SDK가 설치되어 있지 않습니다. backend requirements를 설치하세요.") from exc

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        stream = client.chat.completions.create(
            model=_model_for_task(task),
            max_tokens=max_tokens,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
            if content:
                yield content
    except AuthenticationError as exc:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.") from exc
    except APIConnectionError as exc:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc
    except RateLimitError as exc:
        raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from exc


def _call_gemma_json(task: AiTask, system_prompt: str, user_prompt: str, max_tokens: int) -> dict:
    try:
        import httpx
    except ImportError as exc:
        raise AnalysisError("httpx가 설치되어 있지 않습니다. backend requirements를 설치하세요.") from exc

    model = _model_for_task(task)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": _temperature_for_task(task),
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": _provider_key(),
    }

    try:
        with httpx.Client(timeout=90) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        data = response.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "".join(str(part.get("text", "")) for part in parts)
        return json.loads(clean_json(text or "{}"))
    except json.JSONDecodeError as exc:
        logger.warning("Gemma JSON parsing failed: %s", exc)
        raise exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] if exc.response is not None else str(exc)
        raise AnalysisError(f"Gemma API 요청에 실패했습니다: {detail}") from exc
    except httpx.HTTPError as exc:
        raise AnalysisError("Gemma API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc
