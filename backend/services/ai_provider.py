import json
import logging
import os
import re
from typing import Iterator, Literal

from core.config import settings
from core.errors import AnalysisError

logger = logging.getLogger(__name__)

AiTask = Literal["analysis", "draft", "match"]


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


def clean_json(text: str) -> str:
    text = (text or "").strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if code_block:
        return code_block.group(1).strip()
    json_match = re.search(r"\{[\s\S]+\}", text)
    if json_match:
        return json_match.group(0).strip()
    return text


def call_json(task: AiTask, system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
    provider = provider_name()
    if should_use_mock_ai():
        raise AnalysisError("AI API 키가 설정되지 않았습니다. MOCK_MODE를 사용하거나 provider API 키를 설정하세요.")
    if provider == "gemma":
        return _call_gemma_json(task, system_prompt, user_prompt, max_tokens)
    if provider == "openai":
        return _call_openai_json(task, system_prompt, user_prompt, max_tokens)
    raise AnalysisError(f"지원하지 않는 AI_PROVIDER입니다: {provider}")


def stream_text(task: AiTask, system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> Iterator[str]:
    """Stream text chunks for long-running draft generation when the provider supports it."""
    provider = provider_name()
    if should_use_mock_ai():
        raise AnalysisError("AI API 키가 설정되지 않았습니다. MOCK_MODE를 사용하거나 provider API 키를 설정하세요.")
    if provider != "openai":
        raise AnalysisError("실시간 토큰 스트리밍은 현재 OpenAI provider에서만 지원됩니다.")
    yield from _stream_openai_text(task, system_prompt, user_prompt, max_tokens)


def _call_openai_json(task: AiTask, system_prompt: str, user_prompt: str, max_tokens: int) -> dict:
    try:
        from openai import APIConnectionError, AuthenticationError, OpenAI, RateLimitError
    except ImportError as exc:
        raise AnalysisError("OpenAI SDK가 설치되어 있지 않습니다. backend requirements를 설치하세요.") from exc

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model=_model_for_task(task),
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return json.loads(clean_json(completion.choices[0].message.content or "{}"))
    except json.JSONDecodeError as exc:
        raise exc
    except AuthenticationError as exc:
        raise AnalysisError("OpenAI API 키가 유효하지 않습니다.") from exc
    except APIConnectionError as exc:
        raise AnalysisError("OpenAI API 연결에 실패했습니다. 네트워크 상태를 확인하세요.") from exc
    except RateLimitError as exc:
        raise AnalysisError("OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from exc


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
            "temperature": 0.2,
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
