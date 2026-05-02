import json
import logging
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)

_in_memory_cache: dict[str, dict] = {}
_redis_client = None
_redis_initialized = False


def _make_redis_client():
    """Return a Redis client when REDIS_URL is configured."""
    try:
        redis_url = getattr(settings, "REDIS_URL", "")
        if not redis_url:
            return None
        import redis as redis_lib

        client = redis_lib.from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
        client.ping()
        logger.info("Redis connected")
        return client
    except ImportError:
        logger.warning("redis package is not installed; using in-memory cache")
        return None
    except Exception as e:
        logger.warning(f"Redis connection failed; using in-memory cache: {e}")
        return None


def _get_redis():
    global _redis_client, _redis_initialized
    if not _redis_initialized:
        _redis_client = _make_redis_client()
        _redis_initialized = True
    return _redis_client


def _save_json(key: str, data: dict, ttl_seconds: int) -> None:
    r = _get_redis()
    if r is not None:
        try:
            r.setex(key, ttl_seconds, json.dumps(data, ensure_ascii=False))
            logger.info(f"Redis saved: {key}")
            return
        except Exception as e:
            logger.warning(f"Redis save failed; using in-memory cache: {e}")

    _in_memory_cache[key] = data
    logger.info(f"In-memory saved: {key} (total={len(_in_memory_cache)})")


def _load_json(key: str) -> Optional[dict]:
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(key)
            if raw:
                logger.info(f"Redis loaded: {key}")
                return json.loads(raw)
        except Exception as e:
            logger.warning(f"Redis load failed; checking in-memory cache: {e}")

    cached = _in_memory_cache.get(key)
    if cached:
        logger.info(f"In-memory loaded: {key}")
    return cached


def save_result(result_id: str, data: dict) -> None:
    _save_json(f"result:{result_id}", data, settings.WORKFLOW_TTL_SECONDS)


def load_result(result_id: str) -> Optional[dict]:
    return _load_json(f"result:{result_id}")


def save_workflow(workflow_id: str, data: dict) -> None:
    _save_json(f"workflow:{workflow_id}", data, settings.WORKFLOW_TTL_SECONDS)


def load_workflow(workflow_id: str) -> Optional[dict]:
    return _load_json(f"workflow:{workflow_id}")
