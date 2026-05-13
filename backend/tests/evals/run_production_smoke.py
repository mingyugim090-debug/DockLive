"""Smoke-test a deployed LiveDock backend.

Flow:
health -> analyze text -> load workflow -> save inputs -> draft -> finalize
-> HTML export -> optional HWPX export -> exports list/download.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "docs" / "evaluation" / "fixtures" / "startup-grant.json"


def request_json(base_url: str, method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 180) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"} if payload is not None else {},
    )
    try:
        with urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: HTTP {exc.code} {detail[:500]}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc}") from exc
    return json.loads(raw or "{}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True, help="Deployed backend URL, e.g. https://docklive.onrender.com")
    parser.add_argument("--require-hwpx", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "production-smoke-report.json")
    args = parser.parse_args()

    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    checks: list[dict[str, Any]] = []

    def add(name: str, passed: bool, detail: str = "") -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    health = request_json(args.base_url, "GET", "/health", timeout=30)
    add("health", health.get("status") == "ok", json.dumps(health, ensure_ascii=False))

    analysis = request_json(
        args.base_url,
        "POST",
        "/api/analyze/text",
        {
            "title": fixture["name"],
            "source_name": fixture["name"],
            "text": fixture["announcement_text"],
        },
    )
    workflow_id = analysis["data"]["id"]
    add("analysis", analysis.get("success") is True and bool(workflow_id), workflow_id)

    workflow = request_json(args.base_url, "GET", f"/api/workflow/{workflow_id}")
    add("workflow_load", workflow.get("success") is True, workflow.get("data", {}).get("status", ""))

    inputs = [
        {"field_id": field["id"], "value": f"{field['label']}: production smoke input"}
        for field in workflow["data"]["user_inputs"]
        if field.get("required")
    ]
    saved = request_json(args.base_url, "POST", f"/api/workflow/{workflow_id}/inputs", {"inputs": inputs})
    add("inputs_saved", saved.get("success") is True, f"{len(inputs)} inputs")

    drafted = request_json(args.base_url, "POST", f"/api/workflow/{workflow_id}/draft", timeout=240)
    add("draft", drafted.get("data", {}).get("status") == "reviewing", drafted.get("data", {}).get("status", ""))

    finalized = request_json(args.base_url, "POST", f"/api/workflow/{workflow_id}/finalize", timeout=180)
    add("finalize", finalized.get("data", {}).get("status") == "finalized", finalized.get("data", {}).get("status", ""))

    html = request_json(args.base_url, "GET", f"/api/workflow/{workflow_id}/export/html", timeout=180)
    add("html_export", html.get("success") is True and html.get("encoding") == "text", html.get("filename", ""))

    hwpx_ok = False
    try:
        hwpx = request_json(args.base_url, "GET", f"/api/workflow/{workflow_id}/export/hwpx", timeout=240)
        hwpx_bytes = base64.b64decode(hwpx.get("content", ""))
        hwpx_ok = hwpx.get("success") is True and hwpx_bytes.startswith(b"PK")
        add("hwpx_export", hwpx_ok, hwpx.get("filename", ""))
    except Exception as exc:
        add("hwpx_export", False, str(exc)[:500])

    time.sleep(1)
    exports = request_json(args.base_url, "GET", f"/api/workflow/{workflow_id}/exports", timeout=60)
    export_items = exports.get("data", [])
    add("exports_list", len(export_items) >= 1, f"{len(export_items)} exports")

    if export_items:
        downloaded = request_json(args.base_url, "GET", f"/api/workflow/{workflow_id}/exports/{export_items[0]['id']}", timeout=120)
        add("export_download", downloaded.get("success") is True and bool(downloaded.get("content")), downloaded.get("filename", ""))
    else:
        add("export_download", False, "no export metadata")

    if args.require_hwpx and not hwpx_ok:
        add("require_hwpx", False, "HWPX export is required for this smoke run")

    summary = {
        "base_url": args.base_url,
        "workflow_id": workflow_id,
        "passed": sum(1 for check in checks if check["passed"]),
        "total": len(checks),
        "checks": checks,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if all(check["passed"] for check in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
