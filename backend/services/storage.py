import base64
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
_insforge_initialized = False
_insforge_available = False

INSFORGE_ANALYSIS_TABLE = "analysis_results"
INSFORGE_WORKFLOW_TABLE = "workflow_sessions"
INSFORGE_DOCUMENT_TABLE = "documents"
INSFORGE_EXPORT_TABLE = "exports"


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


def _insforge_configured() -> bool:
    return bool(settings.INSFORGE_BASE_URL and settings.INSFORGE_API_KEY)


def _insforge_headers(content_type: str | None = "application/json") -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.INSFORGE_API_KEY}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _insforge_timeout() -> float:
    return float(getattr(settings, "INSFORGE_TIMEOUT_SECONDS", 10))


def _insforge_url(path: str) -> str:
    return f"{settings.INSFORGE_BASE_URL.rstrip('/')}{path}"


def _encode_object_key(path: str) -> str:
    return quote(path, safe="")


def _check_insforge() -> bool:
    global _insforge_initialized, _insforge_available
    if _insforge_initialized:
        return _insforge_available
    _insforge_initialized = True
    if not _insforge_configured():
        _insforge_available = False
        return False
    try:
        import httpx

        url = _insforge_url(f"/api/database/records/{INSFORGE_ANALYSIS_TABLE}?select=id&limit=1")
        response = httpx.get(url, headers=_insforge_headers(), timeout=_insforge_timeout())
        response.raise_for_status()
        _insforge_available = True
        logger.info("InsForge persistence connected")
    except ImportError:
        logger.info("httpx package is not installed; InsForge persistence disabled")
        _insforge_available = False
    except Exception as e:
        logger.warning("InsForge persistence unavailable; using fallback cache: %s", e)
        _insforge_available = False
    return _insforge_available


def _insforge_upsert(table: str, payload: dict[str, Any]) -> bool:
    if not _check_insforge():
        return False
    try:
        import httpx

        url = _insforge_url(f"/api/database/records/{table}")
        headers = _insforge_headers()
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
        response = httpx.post(url, headers=headers, json=[payload], timeout=_insforge_timeout())
        response.raise_for_status()
        return True
    except Exception as e:
        logger.warning("InsForge upsert failed for table=%s id=%s: %s", table, payload.get("id"), e)
        return False


def _insforge_insert(table: str, payload: dict[str, Any]) -> bool:
    if not _check_insforge():
        return False
    try:
        import httpx

        url = _insforge_url(f"/api/database/records/{table}")
        headers = _insforge_headers()
        headers["Prefer"] = "return=minimal"
        response = httpx.post(url, headers=headers, json=[payload], timeout=_insforge_timeout())
        response.raise_for_status()
        return True
    except Exception as e:
        logger.warning("InsForge insert failed for table=%s: %s", table, e)
        return False


def _insforge_load_payload(table: str, item_id: str) -> Optional[dict]:
    if not _check_insforge():
        return None
    try:
        import httpx

        encoded_id = quote(item_id, safe="")
        url = _insforge_url(f"/api/database/records/{table}?id=eq.{encoded_id}&select=payload&limit=1")
        response = httpx.get(url, headers=_insforge_headers(), timeout=_insforge_timeout())
        response.raise_for_status()
        rows = response.json()
        if rows:
            payload = rows[0].get("payload")
            return payload if isinstance(payload, dict) else None
    except Exception as e:
        logger.warning("InsForge load failed for table=%s id=%s: %s", table, item_id, e)
    return None


def _insforge_select(path: str) -> list[dict[str, Any]]:
    if not _check_insforge():
        return []
    try:
        import httpx

        response = httpx.get(_insforge_url(path), headers=_insforge_headers(), timeout=_insforge_timeout())
        response.raise_for_status()
        rows = response.json()
        return rows if isinstance(rows, list) else []
    except Exception as e:
        logger.warning("InsForge select failed for path=%s: %s", path, e)
        return []


def _insforge_upload(path: str, content: bytes, content_type: str) -> Optional[str]:
    if not _check_insforge():
        return None
    try:
        import httpx

        bucket = settings.INSFORGE_STORAGE_BUCKET
        encoded_path = _encode_object_key(path)
        url = _insforge_url(f"/api/storage/buckets/{bucket}/objects/{encoded_path}")
        files = {"file": (Path(path).name, content, content_type)}
        response = httpx.put(
            url,
            headers=_insforge_headers(content_type=None),
            files=files,
            timeout=_insforge_timeout(),
        )
        response.raise_for_status()
        return path
    except Exception as e:
        logger.warning("InsForge storage upload failed for path=%s: %s", path, e)
        return None


def _insforge_download(bucket: str, path: str) -> Optional[bytes]:
    if not _check_insforge():
        return None
    try:
        import httpx

        encoded_path = _encode_object_key(path)
        strategy_url = _insforge_url(f"/api/storage/buckets/{bucket}/objects/{encoded_path}/download-strategy")
        strategy_response = httpx.post(
            strategy_url,
            headers=_insforge_headers(),
            json={"expiresIn": 300},
            timeout=_insforge_timeout(),
        )
        strategy_response.raise_for_status()
        strategy = strategy_response.json()
        download_url = strategy.get("url")
        if not isinstance(download_url, str) or not download_url:
            return None
        headers = None
        if download_url.startswith("/"):
            download_url = _insforge_url(download_url)
            headers = _insforge_headers(content_type=None)
        response = httpx.get(download_url, headers=headers, timeout=_insforge_timeout())
        response.raise_for_status()
        return response.content
    except Exception as e:
        logger.warning("InsForge storage download failed for path=%s: %s", path, e)
        return None


def _save_insforge_json(key: str, data: dict) -> bool:
    prefix, _, item_id = key.partition(":")
    if not item_id:
        return False
    now = _utc_now()
    if prefix == "result":
        return _insforge_upsert(
            INSFORGE_ANALYSIS_TABLE,
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
        return _insforge_upsert(
            INSFORGE_WORKFLOW_TABLE,
            {
                "id": item_id,
                "analysis_id": analysis.get("id") or item_id,
                "status": data.get("status"),
                "payload": data,
                "updated_at": now,
            },
        )
    return False


def _load_insforge_json(key: str) -> Optional[dict]:
    prefix, _, item_id = key.partition(":")
    if not item_id:
        return None
    if prefix == "result":
        return _insforge_load_payload(INSFORGE_ANALYSIS_TABLE, item_id)
    if prefix == "workflow":
        return _insforge_load_payload(INSFORGE_WORKFLOW_TABLE, item_id)
    return None


def _save_json(key: str, data: dict, ttl_seconds: int) -> None:
    saved_to_insforge = _save_insforge_json(key, data)
    if saved_to_insforge:
        logger.info("InsForge saved: %s", key)

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
    insforge_data = _load_insforge_json(key)
    if insforge_data:
        logger.info("InsForge loaded: %s", key)
        return insforge_data

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
    """Persist an uploaded source file.

    InsForge storage is preferred when configured, but local file-cache fallback is
    intentionally used as well. HWP/HWPX exports need the original upload later so
    the final document can clone the source form instead of falling back to
    markdown-only HWPX generation.
    """
    if not content:
        return None
    document_id = str(uuid4())
    safe_filename = _safe_storage_name(filename)
    storage_path = f"sources/{analysis_id}/{safe_filename}"
    uploaded_path = _insforge_upload(storage_path, content, content_type)

    row = {
        "id": document_id,
        "analysis_id": analysis_id,
        "workflow_id": analysis_id,
        "filename": filename or safe_filename,
        "content_type": content_type,
        "size_bytes": len(content),
        "storage_bucket": settings.INSFORGE_STORAGE_BUCKET if uploaded_path else "file_cache",
        "storage_path": uploaded_path or storage_path,
        "created_at": _utc_now(),
    }
    if uploaded_path and _insforge_insert(INSFORGE_DOCUMENT_TABLE, row):
        return row

    fallback_key = f"source:{analysis_id}:{document_id}"
    fallback_row = {**row, "storage_bucket": "file_cache", "storage_path": fallback_key}
    _save_file_cache(
        fallback_key,
        {
            **fallback_row,
            "content_base64": base64.b64encode(content).decode("ascii"),
        },
    )
    list_key = f"sources:{analysis_id}"
    existing = _load_file_cache(list_key) or {}
    items = [item for item in existing.get("items", []) if isinstance(item, dict) and item.get("id") != document_id]
    items.insert(0, fallback_row)
    _save_file_cache(list_key, {"items": items})
    return fallback_row


def list_source_files(analysis_id: str) -> list[dict[str, Any]]:
    """List uploaded source files for an analysis/workflow id."""
    if not analysis_id:
        return []

    encoded_analysis_id = quote(analysis_id, safe="")
    columns = (
        "id,analysis_id,workflow_id,filename,content_type,size_bytes,"
        "storage_bucket,storage_path,created_at"
    )
    path = (
        f"/api/database/records/{INSFORGE_DOCUMENT_TABLE}"
        f"?analysis_id=eq.{encoded_analysis_id}&select={columns}&order=created_at.desc"
    )
    rows = _insforge_select(path)
    if rows:
        return [dict(row) for row in rows]

    fallback = _load_file_cache(f"sources:{analysis_id}") or {}
    items = fallback.get("items", [])
    return [dict(item) for item in items] if isinstance(items, list) else []


def load_source_file(analysis_id: str, source_id: str) -> Optional[dict[str, Any]]:
    """Load an uploaded source file and its bytes."""
    if not analysis_id or not source_id:
        return None

    encoded_analysis_id = quote(analysis_id, safe="")
    encoded_source_id = quote(source_id, safe="")
    columns = (
        "id,analysis_id,workflow_id,filename,content_type,size_bytes,"
        "storage_bucket,storage_path,created_at"
    )
    path = (
        f"/api/database/records/{INSFORGE_DOCUMENT_TABLE}"
        f"?id=eq.{encoded_source_id}&analysis_id=eq.{encoded_analysis_id}&select={columns}&limit=1"
    )
    rows = _insforge_select(path)
    if rows:
        row = rows[0]
        content = _insforge_download(row.get("storage_bucket") or settings.INSFORGE_STORAGE_BUCKET, row.get("storage_path", ""))
        if content is not None:
            return {**dict(row), "content": content}

    fallback = _load_file_cache(f"source:{analysis_id}:{source_id}")
    if not fallback:
        return None
    encoded_content = fallback.get("content_base64")
    if not isinstance(encoded_content, str):
        return None
    try:
        content = base64.b64decode(encoded_content.encode("ascii"))
    except Exception as e:
        logger.warning("Fallback source decode failed for analysis=%s source=%s: %s", analysis_id, source_id, e)
        return None
    return {**fallback, "content": content}


def load_latest_source_file(analysis_id: str) -> Optional[dict[str, Any]]:
    """Load the newest uploaded source file for an analysis/workflow id."""
    for row in list_source_files(analysis_id):
        source = load_source_file(analysis_id, str(row.get("id") or ""))
        if source is not None:
            return source
    return None


def save_export_file(
    workflow_id: str,
    filename: str,
    content: bytes,
    content_type: str,
    export_type: str,
    status: str = "success",
    error_message: str | None = None,
    validation_summary: dict[str, Any] | None = None,
) -> Optional[dict]:
    """Persist a generated export in InsForge Storage when configured."""
    if not content:
        return None
    export_id = str(uuid4())
    safe_filename = _safe_storage_name(filename)
    storage_path = f"exports/{workflow_id}/{export_id}_{safe_filename}"
    row = {
        "id": export_id,
        "workflow_id": workflow_id,
        "filename": filename or safe_filename,
        "content_type": content_type,
        "export_type": export_type,
        "size_bytes": len(content),
        "storage_bucket": settings.INSFORGE_STORAGE_BUCKET,
        "storage_path": storage_path,
        "status": status,
        "error_message": error_message,
        "validation_summary": validation_summary or {},
        "created_at": _utc_now(),
    }

    uploaded_path = _insforge_upload(storage_path, content, content_type)
    if uploaded_path:
        stored_row = {**row, "storage_path": uploaded_path}
        if _insforge_insert(INSFORGE_EXPORT_TABLE, stored_row):
            return row
        legacy_row = _legacy_export_row(stored_row)
        if _insforge_insert(INSFORGE_EXPORT_TABLE, legacy_row):
            return row

    fallback_key = f"export:{workflow_id}:{export_id}"
    fallback_row = {**row, "storage_bucket": "file_cache", "storage_path": fallback_key}
    _save_file_cache(
        fallback_key,
        {
            **fallback_row,
            "content_base64": base64.b64encode(content).decode("ascii"),
        },
    )
    list_key = f"exports:{workflow_id}"
    existing = _load_file_cache(list_key) or {}
    items = [item for item in existing.get("items", []) if isinstance(item, dict) and item.get("id") != export_id]
    items.insert(0, fallback_row)
    _save_file_cache(list_key, {"items": items})
    return fallback_row


def list_export_files(workflow_id: str) -> list[dict[str, Any]]:
    """List generated exports for a workflow from InsForge metadata."""
    if not workflow_id:
        return []
    encoded_workflow_id = quote(workflow_id, safe="")
    columns = "id,workflow_id,filename,content_type,export_type,size_bytes,created_at,status,error_message,validation_summary"
    path = (
        f"/api/database/records/{INSFORGE_EXPORT_TABLE}"
        f"?workflow_id=eq.{encoded_workflow_id}&select={columns}&order=created_at.desc"
    )
    rows = _insforge_select(path)
    if rows:
        return [_normalize_export_row(row) for row in rows]

    legacy_columns = "id,workflow_id,filename,content_type,export_type,size_bytes,created_at"
    legacy_path = (
        f"/api/database/records/{INSFORGE_EXPORT_TABLE}"
        f"?workflow_id=eq.{encoded_workflow_id}&select={legacy_columns}&order=created_at.desc"
    )
    legacy_rows = _insforge_select(legacy_path)
    if legacy_rows:
        return [_normalize_export_row(row) for row in legacy_rows]

    fallback = _load_file_cache(f"exports:{workflow_id}") or {}
    items = fallback.get("items", [])
    return [_normalize_export_row(item) for item in items] if isinstance(items, list) else []


def load_export_file(workflow_id: str, export_id: str) -> Optional[dict[str, Any]]:
    """Load a generated export and its bytes from InsForge Storage."""
    if not workflow_id or not export_id:
        return None
    encoded_workflow_id = quote(workflow_id, safe="")
    encoded_export_id = quote(export_id, safe="")
    columns = "id,workflow_id,filename,content_type,export_type,size_bytes,created_at,storage_bucket,storage_path,status,error_message,validation_summary"
    path = (
        f"/api/database/records/{INSFORGE_EXPORT_TABLE}"
        f"?id=eq.{encoded_export_id}&workflow_id=eq.{encoded_workflow_id}&select={columns}&limit=1"
    )
    rows = _insforge_select(path)
    if rows:
        row = rows[0]
        content = _insforge_download(row.get("storage_bucket") or settings.INSFORGE_STORAGE_BUCKET, row.get("storage_path", ""))
        if content is not None:
            return {**_normalize_export_row(row), "content": content}

    legacy_columns = "id,workflow_id,filename,content_type,export_type,size_bytes,created_at,storage_bucket,storage_path"
    legacy_path = (
        f"/api/database/records/{INSFORGE_EXPORT_TABLE}"
        f"?id=eq.{encoded_export_id}&workflow_id=eq.{encoded_workflow_id}&select={legacy_columns}&limit=1"
    )
    legacy_rows = _insforge_select(legacy_path)
    if legacy_rows:
        row = legacy_rows[0]
        content = _insforge_download(row.get("storage_bucket") or settings.INSFORGE_STORAGE_BUCKET, row.get("storage_path", ""))
        if content is not None:
            return {**_normalize_export_row(row), "content": content}

    fallback = _load_file_cache(f"export:{workflow_id}:{export_id}")
    if not fallback:
        return None
    encoded_content = fallback.get("content_base64")
    if not isinstance(encoded_content, str):
        return None
    try:
        content = base64.b64decode(encoded_content.encode("ascii"))
    except Exception as e:
        logger.warning("Fallback export decode failed for workflow=%s export=%s: %s", workflow_id, export_id, e)
        return None
    return {**_normalize_export_row(fallback), "content": content}


def _normalize_export_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized.setdefault("status", "success")
    normalized.setdefault("error_message", None)
    summary = normalized.get("validation_summary")
    normalized["validation_summary"] = summary if isinstance(summary, dict) else {}
    return normalized


def _legacy_export_row(row: dict[str, Any]) -> dict[str, Any]:
    """Return the export columns that existed before status metadata was added."""
    return {
        key: value
        for key, value in row.items()
        if key not in {"status", "error_message", "validation_summary"}
    }
