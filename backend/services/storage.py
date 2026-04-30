import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_in_memory_cache: dict[str, dict] = {}

RESULT_TTL_SECONDS = 7 * 24 * 3600  # 7일


def _make_redis_client():
    """REDIS_URL 환경변수가 있으면 Redis 클라이언트를 반환합니다."""
    try:
        from core.config import settings
        redis_url = getattr(settings, "REDIS_URL", "")
        if not redis_url:
            return None
        import redis as redis_lib
        client = redis_lib.from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
        client.ping()
        logger.info("Redis 연결 성공")
        return client
    except ImportError:
        logger.warning("redis 패키지 미설치 — 인메모리 캐시 사용")
        return None
    except Exception as e:
        logger.warning(f"Redis 연결 실패, 인메모리 캐시 사용: {e}")
        return None


_redis_client = None
_redis_initialized = False


def _get_redis():
    global _redis_client, _redis_initialized
    if not _redis_initialized:
        _redis_client = _make_redis_client()
        _redis_initialized = True
    return _redis_client


def save_result(result_id: str, data: dict) -> None:
    """결과를 Redis 또는 인메모리에 저장합니다."""
    r = _get_redis()
    if r is not None:
        try:
            r.setex(f"result:{result_id}", RESULT_TTL_SECONDS, json.dumps(data, ensure_ascii=False))
            logger.info(f"Redis 저장: {result_id}")
            return
        except Exception as e:
            logger.warning(f"Redis 저장 실패, 인메모리 대체: {e}")
    _in_memory_cache[result_id] = data
    logger.info(f"인메모리 저장: {result_id} (총 {len(_in_memory_cache)}개)")


def load_result(result_id: str) -> Optional[dict]:
    """결과를 Redis 또는 인메모리에서 조회합니다."""
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(f"result:{result_id}")
            if raw:
                logger.info(f"Redis 조회: {result_id}")
                return json.loads(raw)
        except Exception as e:
            logger.warning(f"Redis 조회 실패, 인메모리 확인: {e}")
    cached = _in_memory_cache.get(result_id)
    if cached:
        logger.info(f"인메모리 조회: {result_id}")
    return cached
