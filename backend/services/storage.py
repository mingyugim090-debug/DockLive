import json
import logging
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote
from uuid import uuid4

from core.config import settings

logger = logging.getLogger(__name__)

_in_memory_cache: dict[str, dict] = {}
_file_cache_dir = Path(__file__).resolve().parents[1] / ".livedock_storage"
_redis_client = None
_redis_initialized = False
_supabase_initialized = False
_supabase_available = False

SUPABASE_ANALYSIS_TABLE = "analysis_results"
SUPABASE_WORKFLOW_TABLE = "workflow_sessions"
SUPABASE_DOCUMENT_TABLE = "documents"
SUPABASE_EXPORT_TABLE = "exports"


def _file_path_for_key(key: str) -> Path:
    safe_key = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in key)
    return _file_cache_dir / f"{safe_key}.json"


def _safe_storage_name(name: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in name.strip())
    return safe.strip("._") or "document"


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _save_file_cache(key: str, data: dict) -> None:
    try:
        _file_cache_dir.mkdir(parents=True, exist_ok=True)
        _file_path_for_key(key).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        logger.warning(f"File cache save failed for {key}: {e}")


def _load_file_cache(key: str) -> Optional[dict]:
    try:
        path = _file_path_for_key(key)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"File cache load failed for {key}: {e}")
        return None


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


def _supabase_configured() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def _supabase_headers(content_type: str = "application/json") -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": content_type,
    }


def _supabase_timeout() -> float:
    return float(getattr(settings, "SUPABASE_TIMEOUT_SECONDS", 10))


def _check_supabase() -> bool:
    global _supabase_initialized, _supabase_available
    if _supabase_initialized:
        return _supabase_available
    _supabase_initialized = True
    if not _supabase_configured():
        _supabase_available = False
        return False
    try:
        import httpx

        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{SUPABASE_ANALYSIS_TABLE}?select=id&limit=1"
        response = httpx.get(url, headers=_supabase_headers(), timeout=_supabase_timeout())
        response.raise_for_status()
        _supabase_available = True
        logger.info("Supabase persistence connected")
    except ImportError:
        logger.info("httpx package is not installed; Supabase persistence disabled")
        _supabase_available = False
    except Exception as e:
        logger.warning("Supabase persistence unavailable; using fallback cache: %s", e)
        _supabase_available = False
    return _supabase_available


def _supabase_upsert(table: str, payload: dict[str, Any]) -> bool:
    if not _check_supabase():
        return False
    try:
        import httpx

        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{table}?on_conflict=id"
        headers = _supabase_headers()
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
        response = httpx.post(url, headers=headers, json=payload, timeout=_supabase_timeout())
        response.raise_for_status()
        return True
    except Exception as e:
        logger.warning("Supabase upsert failed for table=%s id=%s: %s", table, payload.get("id"), e)
        return False


def _supabase_insert(table: str, payload: dict[str, Any]) -> bool:
    if not _check_supabase():
        return False
    try:
        import httpx

        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
        headers = _supabase_headers()
        headers["Prefer"] = "return=minimal"
        response = httpx.post(url, headers=headers, json=payload, timeout=_supabase_timeout())
        response.raise_for_status()
        return True
    except Exception as e:
        logger.warning("Supabase insert failed for table=%s: %s", table, e)
        return False


def _supabase_load_payload(table: str, item_id: str) -> Optional[dict]:
    if not _check_supabase():
        return None
    try:
        import httpx

        encoded_id = quote(item_id, safe="")
        url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{table}?id=eq.{encoded_id}&select=payload&limit=1"
        response = httpx.get(url, headers=_supabase_headers(), timeout=_supabase_timeout())
        response.raise_for_status()
        rows = response.json()
        if rows:
            payload = rows[0].get("payload")
            return payload if isinstance(payload, dict) else None
    except Exception as e:
        logger.warning("Supabase load failed for table=%s id=%s: %s", table, item_id, e)
    return None


def _supabase_select(url: str) -> list[dict[str, Any]]:
    if not _check_supabase():
        return []
    try:
        import httpx

        response = httpx.get(url, headers=_supabase_headers(), timeout=_supabase_timeout())
        response.raise_for_status()
        rows = response.json()
        return rows if isinstance(rows, list) else []
    except Exception as e:
        logger.warning("Supabase select failed for url=%s: %s", url, e)
        return []


def _supabase_upload(path: str, content: bytes, content_type: str) -> Optional[str]:
    if not _check_supabase():
        return None
    try:
        import httpx

        bucket = settings.SUPABASE_STORAGE_BUCKET
        encoded_path = "/".join(quote(part, safe="") for part in path.split("/"))
        url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{encoded_path}"
        headers = _supabase_headers(content_type)
        headers["x-upsert"] = "true"
        response = httpx.put(url, headers=headers, content=content, timeout=_supabase_timeout())
        response.raise_for_status()
        return path
    except Exception as e:
        logger.warning("Supabase storage upload failed for path=%s: %s", path, e)
        return None


def _supabase_download(bucket: str, path: str) -> Optional[bytes]:
    if not _check_supabase():
        return None
    try:
        import httpx

        encoded_path = "/".join(quote(part, safe="") for part in path.split("/"))
        url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{encoded_path}"
        response = httpx.get(url, headers=_supabase_headers(), timeout=_supabase_timeout())
        response.raise_for_status()
        return response.content
    except Exception as e:
        logger.warning("Supabase storage download failed for path=%s: %s", path, e)
        return None


def _save_supabase_json(key: str, data: dict) -> bool:
    prefix, _, item_id = key.partition(":")
    if not item_id:
        return False
    now = _utc_now()
    if prefix == "result":
        return _supabase_upsert(
            SUPABASE_ANALYSIS_TABLE,
            {
                "id": item_id,
                "source_type": data.get("source_type"),
                "source_name": data.get("source_name"),
                "title": data.get("title"),
                "organization": data.get("organization"),
                "doc_type": data.get("doc_type"),
                "payload": data,
                "updated_at": now,
            },
        )
    if prefix == "workflow":
        analysis = data.get("analysis") if isinstance(data.get("analysis"), dict) else {}
        return _supabase_upsert(
            SUPABASE_WORKFLOW_TABLE,
            {
                "id": item_id,
                "analysis_id": analysis.get("id") or item_id,
                "status": data.get("status"),
                "payload": data,
                "updated_at": now,
            },
        )
    return False


def _load_supabase_json(key: str) -> Optional[dict]:
    prefix, _, item_id = key.partition(":")
    if not item_id:
        return None
    if prefix == "result":
        return _supabase_load_payload(SUPABASE_ANALYSIS_TABLE, item_id)
    if prefix == "workflow":
        return _supabase_load_payload(SUPABASE_WORKFLOW_TABLE, item_id)
    return None


def _save_json(key: str, data: dict, ttl_seconds: int) -> None:
    saved_to_supabase = _save_supabase_json(key, data)
    if saved_to_supabase:
        logger.info("Supabase saved: %s", key)

    r = _get_redis()
    if r is not None:
        try:
            r.setex(key, ttl_seconds, json.dumps(data, ensure_ascii=False))
            logger.info(f"Redis saved: {key}")
            return
        except Exception as e:
            logger.warning(f"Redis save failed; using in-memory cache: {e}")

    _in_memory_cache[key] = data
    _save_file_cache(key, data)
    logger.info(f"In-memory saved: {key} (total={len(_in_memory_cache)})")


def _load_json(key: str) -> Optional[dict]:
    supabase_data = _load_supabase_json(key)
    if supabase_data:
        logger.info("Supabase loaded: %s", key)
        return supabase_data

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

    file_cached = _load_file_cache(key)
    if file_cached:
        logger.info(f"File cache loaded: {key}")
    return file_cached


def save_result(result_id: str, data: dict) -> None:
    _save_json(f"result:{result_id}", data, settings.WORKFLOW_TTL_SECONDS)


def load_result(result_id: str) -> Optional[dict]:
    return _load_json(f"result:{result_id}")


def save_workflow(workflow_id: str, data: dict) -> None:
    _save_json(f"workflow:{workflow_id}", data, settings.WORKFLOW_TTL_SECONDS)


def load_workflow(workflow_id: str) -> Optional[dict]:
    return _load_json(f"workflow:{workflow_id}")


def save_source_file(
    analysis_id: str,
    filename: str,
    content: bytes,
    content_type: str = "application/octet-stream",
) -> Optional[dict]:
    """Persist an uploaded source file in Supabase Storage when configured."""
    if not content:
        return None
    document_id = str(uuid4())
    safe_filename = _safe_storage_name(filename)
    storage_path = f"sources/{analysis_id}/{safe_filename}"
    uploaded_path = _supabase_upload(storage_path, content, content_type)
    if not uploaded_path:
        return None

    row = {
        "id": document_id,
        "analysis_id": analysis_id,
        "workflow_id": analysis_id,
        "filename": filename or safe_filename,
        "content_type": content_type,
        "size_bytes": len(content),
        "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
        "storage_path": uploaded_path,
        "created_at": _utc_now(),
    }
    if _supabase_insert(SUPABASE_DOCUMENT_TABLE, row):
        return row
    return None


def save_export_file(
    workflow_id: str,
    filename: str,
    content: bytes,
    content_type: str,
    export_type: str,
) -> Optional[dict]:
    """Persist a generated export in Supabase Storage when configured."""
    if not content:
        return None
    export_id = str(uuid4())
    safe_filename = _safe_storage_name(filename)
    storage_path = f"exports/{workflow_id}/{export_id}_{safe_filename}"
    uploaded_path = _supabase_upload(storage_path, content, content_type)
    if not uploaded_path:
        return None

    row = {
        "id": export_id,
        "workflow_id": workflow_id,
        "filename": filename or safe_filename,
        "content_type": content_type,
        "export_type": export_type,
        "size_bytes": len(content),
        "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
        "storage_path": uploaded_path,
        "created_at": _utc_now(),
    }
    if _supabase_insert(SUPABASE_EXPORT_TABLE, row):
        return row
    return None


def list_export_files(workflow_id: str) -> list[dict[str, Any]]:
    """List generated exports for a workflow from Supabase metadata."""
    if not workflow_id:
        return []
    encoded_workflow_id = quote(workflow_id, safe="")
    columns = "id,workflow_id,filename,content_type,export_type,size_bytes,created_at"
    url = (
        f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{SUPABASE_EXPORT_TABLE}"
        f"?workflow_id=eq.{encoded_workflow_id}&select={columns}&order=created_at.desc"
    )
    return _supabase_select(url)


def load_export_file(workflow_id: str, export_id: str) -> Optional[dict[str, Any]]:
    """Load a generated export and its bytes from Supabase Storage."""
    if not workflow_id or not export_id:
        return None
    encoded_workflow_id = quote(workflow_id, safe="")
    encoded_export_id = quote(export_id, safe="")
    columns = "id,workflow_id,filename,content_type,export_type,size_bytes,created_at,storage_bucket,storage_path"
    url = (
        f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{SUPABASE_EXPORT_TABLE}"
        f"?id=eq.{encoded_export_id}&workflow_id=eq.{encoded_workflow_id}&select={columns}&limit=1"
    )
    rows = _supabase_select(url)
    if not rows:
        return None
    row = rows[0]
    content = _supabase_download(row.get("storage_bucket") or settings.SUPABASE_STORAGE_BUCKET, row.get("storage_path", ""))
    if content is None:
        return None
    return {**row, "content": content}
