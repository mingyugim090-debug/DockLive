"""HWPX compose tools for the local document agent.

The local agent does not edit HWPX XML directly. It sends the local form to the
DockLive backend HWPX pipeline, then stores the validated result back on the PC.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from tools import integrity_tools


def _ok(data) -> dict:
    return {"ok": True, "data": data}


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


def _validation_summary(path: str, original_path: str = "") -> dict:
    try:
        result = integrity_tools.validate_document(path, original_path=original_path, authored_ranges=[])
    except Exception as exc:
        return {"validation_passed": False, "checks": [], "warnings": [f"validation failed: {exc}"]}
    if result.get("ok"):
        return result.get("data", {})
    return {"validation_passed": False, "checks": [], "warnings": [result.get("error", "validation failed")]}


def _open_after_validation(path: str, open_result: bool, validation_summary: dict) -> bool:
    if not open_result:
        return False
    warnings = validation_summary.setdefault("warnings", [])
    if not validation_summary.get("validation_passed"):
        warnings.append("Result was not opened because local validation failed.")
        return False
    try:
        _open_path(path)
        return True
    except Exception as exc:
        warnings.append(f"Result was saved but could not be opened: {exc}")
        return False


def _api_url(explicit: str = "") -> str:
    return (
        explicit.strip()
        or os.environ.get("LIVEDOCK_API_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_API_URL", "").strip()
        or "http://127.0.0.1:8000"
    ).rstrip("/")


def _safe_hwpx_filename(name: str, default_name: str) -> str:
    candidate = (name or default_name).strip()
    cleaned = re.sub(r'[\\/:*?"<>|\r\n]+', "_", candidate).strip().strip(".")
    if not cleaned.lower().endswith(".hwpx"):
        cleaned = f"{Path(cleaned).stem or 'completed'}.hwpx"
    return cleaned


def _safe_output_path(source: Path, output_path: str = "", output_dir: str = "", filename: str = "") -> Path:
    if output_path:
        target = Path(output_path).expanduser()
    else:
        directory = Path(output_dir).expanduser() if output_dir else source.parent
        directory.mkdir(parents=True, exist_ok=True)
        default_name = f"{source.stem}_completed.hwpx"
        target = directory / _safe_hwpx_filename(filename, default_name)
    if target.suffix.lower() != ".hwpx":
        target = target.with_suffix(".hwpx")
    return target


def _open_path(path: str) -> None:
    os.startfile(path)  # type: ignore[attr-defined]


def _require_hwpx_source(path: str) -> Path:
    source = Path(path)
    if not source.exists():
        raise ValueError(f"파일이 없음: {path}")
    if source.suffix.lower() not in {".hwp", ".hwpx"}:
        raise ValueError("HWP 또는 HWPX 파일만 자동 작성할 수 있습니다.")
    return source


def _multipart_body(fields: dict[str, str], file_field: str, file_path: Path) -> tuple[bytes, str]:
    boundary = f"----DockLiveAgent{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )

    content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{file_path.name}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
            file_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _post_compose_request(
    api_url: str,
    path: str,
    request_text: str,
    applicant_context: str,
    title: str,
) -> dict:
    file_path = Path(path)
    body, content_type = _multipart_body(
        {
            "request_text": request_text,
            "applicant_context": applicant_context,
            "title": title,
        },
        "template",
        file_path,
    )
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/compose",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HWPX 자동작성 API 오류({exc.code}): {detail[:700]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"HWPX 자동작성 API 연결 실패: {exc.reason}") from exc


def _read_json_response(request: urllib.request.Request, timeout: int) -> dict:
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HWPX API 오류({exc.code}): {detail[:700]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"HWPX API 연결 실패: {exc.reason}") from exc


def _post_session_request(api_url: str, path: Path) -> dict:
    body, content_type = _multipart_body({}, "file", path)
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/sessions",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    return _read_json_response(request, timeout=60)


def _post_draft_all_request(
    api_url: str,
    session_id: str,
    base_input: str,
    global_prompt: str,
    overwrite_existing: bool,
) -> dict:
    data = json.dumps(
        {
            "base_input": base_input,
            "global_prompt": global_prompt,
            "overwrite_existing": overwrite_existing,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/sessions/{urllib.parse.quote(session_id)}/draft-all",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return _read_json_response(request, timeout=120)


def _post_export_session_request(api_url: str, session_id: str) -> dict:
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/sessions/{urllib.parse.quote(session_id)}/export",
        method="POST",
    )
    return _read_json_response(request, timeout=120)


def compose_hwpx_form(
    path: str,
    request: str,
    applicant_context: str = "",
    output_path: str = "",
    output_dir: str = "",
    filename: str = "",
    api_url: str = "",
    title: str = "",
    open_result: bool = False,
) -> dict:
    try:
        source = _require_hwpx_source(path)
    except ValueError as exc:
        return _err(str(exc))
    if not request.strip():
        return _err("request가 비어 있습니다.")

    try:
        result = _post_compose_request(
            _api_url(api_url),
            str(source),
            request.strip(),
            applicant_context.strip(),
            title.strip(),
        )
    except Exception as exc:
        return _err(str(exc))

    if result.get("encoding") != "base64" or not result.get("content"):
        return _err("HWPX 자동작성 응답에 저장 가능한 base64 content가 없습니다.")

    try:
        content = base64.b64decode(result["content"])
    except Exception as exc:
        return _err(f"HWPX 자동작성 응답 디코딩 실패: {exc}")

    target = _safe_output_path(source, output_path, output_dir, filename or str(result.get("filename") or ""))
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    except Exception as exc:
        return _err(f"HWPX 완성본 저장 실패: {exc}")

    validation_summary = _validation_summary(str(target), str(source))
    opened = _open_after_validation(str(target), open_result, validation_summary)

    return _ok(
        {
            "saved_path": str(target),
            "filename": result.get("filename") or target.name,
            "warnings": result.get("warnings", []),
            "verification": result.get("verification") or result.get("validation_summary", {}),
            "validation_summary": validation_summary,
            "opened": opened,
            "generated_fields": result.get("generated_fields", {}),
            "confirmation_required": result.get("confirmation_required", []),
        }
    )


def create_hwpx_session(path: str, api_url: str = "") -> dict:
    try:
        source = _require_hwpx_source(path)
        payload = _post_session_request(_api_url(api_url), source)
    except Exception as exc:
        return _err(str(exc))

    data = payload.get("data", payload)
    session_id = data.get("id") or data.get("session_id") or payload.get("session_id") or ""
    return _ok({"session_id": session_id, "session": data})


def draft_hwpx_session(
    session_id: str,
    base_input: str = "",
    global_prompt: str = "",
    overwrite_existing: bool = False,
    api_url: str = "",
) -> dict:
    if not session_id.strip():
        return _err("session_id가 비어 있습니다.")
    try:
        payload = _post_draft_all_request(
            _api_url(api_url),
            session_id.strip(),
            base_input,
            global_prompt,
            overwrite_existing,
        )
    except Exception as exc:
        return _err(str(exc))

    data = payload.get("data", payload)
    return _ok({"session_id": data.get("id", session_id), "session": data})


def export_hwpx_session(
    session_id: str,
    output_path: str = "",
    output_dir: str = "",
    filename: str = "",
    api_url: str = "",
    open_result: bool = False,
) -> dict:
    if not session_id.strip():
        return _err("session_id가 비어 있습니다.")
    try:
        result = _post_export_session_request(_api_url(api_url), session_id.strip())
    except Exception as exc:
        return _err(str(exc))

    encoded = result.get("content") or result.get("content_base64") or result.get("file_base64") or ""
    if not encoded:
        return _err("HWPX export 응답에 저장 가능한 base64 content가 없습니다.")

    try:
        content = base64.b64decode(encoded)
    except Exception as exc:
        return _err(f"HWPX export 응답 디코딩 실패: {exc}")

    exported_filename = filename or str(result.get("filename") or f"{session_id}.hwpx")
    target = _safe_output_path(Path(exported_filename), output_path, output_dir, exported_filename)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    except Exception as exc:
        return _err(f"HWPX export 저장 실패: {exc}")

    validation_summary = _validation_summary(str(target))
    opened = _open_after_validation(str(target), open_result, validation_summary)

    return _ok(
        {
            "saved_path": str(target),
            "filename": target.name,
            "warnings": result.get("warnings", []),
            "verification": result.get("validation_summary") or result.get("verification", {}),
            "validation_summary": validation_summary,
            "opened": opened,
            "confirmation_required": result.get("confirmation_required", []),
        }
    )
