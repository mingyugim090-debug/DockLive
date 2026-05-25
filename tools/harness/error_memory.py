from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY_PATH = ROOT / "harness" / "errors" / "registry.json"
ERROR_PATTERNS = (
    "traceback",
    "error",
    "failed",
    "failure",
    "exception",
    "assertionerror",
    "modulenotfounderror",
    "syntaxerror",
    "typeerror",
    "valueerror",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_registry(path: Path = DEFAULT_REGISTRY_PATH) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "errors": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {"version": 1, "errors": []}
    data.setdefault("version", 1)
    data.setdefault("errors", [])
    return data


def save_registry(data: dict[str, Any], path: Path = DEFAULT_REGISTRY_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def representative_error_line(log_text: str) -> str:
    lines = [line.strip() for line in (log_text or "").splitlines() if line.strip()]
    for line in reversed(lines):
        lowered = line.lower()
        if any(pattern in lowered for pattern in ERROR_PATTERNS) and "warning:" not in lowered:
            return line[:500]
    return (lines[-1] if lines else "no output")[:500]


def related_file_paths(log_text: str) -> list[str]:
    patterns = [
        r"\b(?:backend|frontend|tools|harness|docs|scripts)[\\/][\w.\-\\/[\]]+",
        r"\b[A-Za-z]:[\\/][^\s:]+(?:\.py|\.ts|\.tsx|\.md|\.json|\.yaml|\.yml)",
    ]
    paths: list[str] = []
    for pattern in patterns:
        for match in re.findall(pattern, log_text or ""):
            cleaned = match.rstrip(").,;")
            if cleaned not in paths:
                paths.append(cleaned)
    return paths[:12]


def normalize_fingerprint_part(value: str) -> str:
    value = (value or "").replace("\\", "/").lower()
    value = re.sub(r"\b0x[0-9a-f]+\b", "0x", value)
    value = re.sub(r"\b\d{4,}\b", "<num>", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def build_fingerprint(command: str, exit_code: int, error_line: str, paths: list[str]) -> str:
    payload = {
        "command": normalize_fingerprint_part(command),
        "exit_code": int(exit_code),
        "error_line": normalize_fingerprint_part(error_line),
        "paths": [normalize_fingerprint_part(path) for path in sorted(paths)],
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    return digest[:24]


def _new_error_id(fingerprint: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"ERR-{stamp}-{fingerprint[:8]}"


def record_failure(
    command: str,
    exit_code: int,
    log_text: str,
    registry_path: Path = DEFAULT_REGISTRY_PATH,
    run_log_path: str | None = None,
) -> tuple[dict[str, Any], bool]:
    registry = load_registry(registry_path)
    error_line = representative_error_line(log_text)
    paths = related_file_paths(log_text)
    fingerprint = build_fingerprint(command, exit_code, error_line, paths)
    now = utc_now()

    for entry in registry["errors"]:
        if entry.get("fingerprint") == fingerprint:
            entry["last_seen"] = now
            entry["occurrences"] = int(entry.get("occurrences", 1)) + 1
            entry["last_command"] = command
            entry["last_exit_code"] = int(exit_code)
            entry["last_error_line"] = error_line
            entry["last_log_path"] = run_log_path
            save_registry(registry, registry_path)
            return entry, True

    entry = {
        "id": _new_error_id(fingerprint),
        "fingerprint": fingerprint,
        "symptom": error_line,
        "root_cause": "",
        "fix_summary": "",
        "guard_test": "",
        "first_seen": now,
        "last_seen": now,
        "occurrences": 1,
        "status": "active",
        "last_command": command,
        "last_exit_code": int(exit_code),
        "last_error_line": error_line,
        "last_log_path": run_log_path,
        "related_paths": paths,
    }
    registry["errors"].append(entry)
    save_registry(registry, registry_path)
    return entry, False


def resolve_error(
    error_id: str,
    fix_summary: str,
    guard_test: str,
    root_cause: str = "",
    registry_path: Path = DEFAULT_REGISTRY_PATH,
) -> dict[str, Any]:
    registry = load_registry(registry_path)
    for entry in registry["errors"]:
        if entry.get("id") == error_id:
            entry["status"] = "resolved"
            entry["fix_summary"] = fix_summary
            entry["guard_test"] = guard_test
            if root_cause:
                entry["root_cause"] = root_cause
            entry["resolved_at"] = utc_now()
            save_registry(registry, registry_path)
            return entry
    raise SystemExit(f"Unknown error id: {error_id}")


def command_from_log(log_text: str) -> str:
    for line in (log_text or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("$ "):
            return stripped[2:].strip()
    return ""


def match_log(log_path: Path, command: str = "", exit_code: int = 1) -> dict[str, Any] | None:
    text = log_path.read_text(encoding="utf-8", errors="replace")
    error_line = representative_error_line(text)
    paths = related_file_paths(text)
    command = command or command_from_log(text) or "manual-match"
    fingerprint = build_fingerprint(command, exit_code, error_line, paths)
    registry = load_registry()
    return next((entry for entry in registry["errors"] if entry.get("fingerprint") == fingerprint), None)


def _print_entries(entries: list[dict[str, Any]]) -> None:
    if not entries:
        print("No errors found.")
        return
    for entry in entries:
        print(f"{entry['id']} [{entry.get('status', 'active')}] x{entry.get('occurrences', 1)}")
        print(f"  symptom: {entry.get('symptom', '')}")
        if entry.get("root_cause"):
            print(f"  root cause: {entry['root_cause']}")
        if entry.get("fix_summary"):
            print(f"  fix: {entry['fix_summary']}")
        if entry.get("guard_test"):
            print(f"  guard: {entry['guard_test']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Dock Live harness error memory")
    subparsers = parser.add_subparsers(dest="command_name", required=True)

    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--status", choices=["active", "resolved", "all"], default="active")

    record_parser = subparsers.add_parser("record")
    record_parser.add_argument("--command", required=True)
    record_parser.add_argument("--exit-code", type=int, required=True)
    record_parser.add_argument("--log", type=Path)
    record_parser.add_argument("--message", default="")

    resolve_parser = subparsers.add_parser("resolve")
    resolve_parser.add_argument("--id", required=True)
    resolve_parser.add_argument("--fix-summary", required=True)
    resolve_parser.add_argument("--guard-test", required=True)
    resolve_parser.add_argument("--root-cause", default="")

    match_parser = subparsers.add_parser("match")
    match_parser.add_argument("--log", type=Path, required=True)
    match_parser.add_argument("--command", default="")
    match_parser.add_argument("--exit-code", type=int, default=1)

    args = parser.parse_args()

    if args.command_name == "list":
        registry = load_registry()
        entries = registry["errors"]
        if args.status != "all":
            entries = [entry for entry in entries if entry.get("status", "active") == args.status]
        _print_entries(entries)
        return 0

    if args.command_name == "record":
        log_text = args.message
        if args.log:
            log_text += "\n" + args.log.read_text(encoding="utf-8", errors="replace")
        entry, matched = record_failure(args.command, args.exit_code, log_text, run_log_path=str(args.log) if args.log else None)
        print(("Matched existing " if matched else "Recorded new ") + entry["id"])
        return 0

    if args.command_name == "resolve":
        entry = resolve_error(args.id, args.fix_summary, args.guard_test, args.root_cause)
        print(f"Resolved {entry['id']}")
        return 0

    if args.command_name == "match":
        entry = match_log(args.log, args.command, args.exit_code)
        if not entry:
            print("No matching error fingerprint.")
            return 1
        _print_entries([entry])
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
