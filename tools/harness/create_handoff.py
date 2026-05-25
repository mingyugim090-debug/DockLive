from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = ROOT / "harness" / "runs"
REGISTRY_PATH = ROOT / "harness" / "errors" / "registry.json"


def run_git(args: list[str]) -> str:
    try:
        completed = subprocess.run(
            ["git", "-c", "core.autocrlf=false", *args],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=15,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return f"(git unavailable: {exc})"
    return (completed.stdout or "").strip()


def load_active_errors() -> list[dict[str, Any]]:
    if not REGISTRY_PATH.exists():
        return []
    try:
        registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    errors = registry.get("errors", [])
    return [entry for entry in errors if entry.get("status", "active") == "active"]


def recent_runs(limit: int = 3) -> list[str]:
    if not RUNS_DIR.exists():
        return []
    run_dirs = [path for path in RUNS_DIR.iterdir() if path.is_dir()]
    run_dirs.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return [str(path.relative_to(ROOT)) for path in run_dirs[:limit]]


def safe_agent_name(agent: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_.-]+", "-", agent.strip().lower())
    return value.strip("-") or "agent"


def bullet_list(items: list[str], empty: str) -> str:
    if not items:
        return f"- {empty}"
    return "\n".join(f"- {item}" for item in items)


def fenced(value: str, empty: str = "(none)") -> str:
    value = value.strip() or empty
    return f"```text\n{value}\n```"


def build_handoff(task: str, agent: str) -> str:
    branch = run_git(["branch", "--show-current"]) or "(unknown)"
    status = run_git(["status", "--short"]) or "(clean)"
    changed_files = run_git(["diff", "--name-only"]) or "(no unstaged file diff)"
    staged_files = run_git(["diff", "--cached", "--name-only"]) or "(no staged file diff)"
    untracked_files = run_git(["ls-files", "--others", "--exclude-standard"]) or "(no untracked files)"
    diff_stat = run_git(["diff", "--stat"]) or "(no unstaged diff stat)"
    active_errors = load_active_errors()
    generated_at = datetime.now().isoformat(timespec="seconds")

    if active_errors:
        error_lines = [
            f"- {entry.get('id', '(no id)')}: {entry.get('symptom', '')} "
            f"(x{entry.get('occurrences', 1)})"
            for entry in active_errors
        ]
    else:
        error_lines = ["- No active recurring errors recorded."]

    return f"""# Dock Live Handoff For {agent}

Generated: {generated_at}

## Task

{task or "Continue the scoped Dock Live task described by Codex."}

## Required Context

- `AGENTS.md`
- `harness/state-spec.yaml`
- `harness/memory/PROJECT_MEMORY.md`
- `harness/memory/USER_WORKFLOW.md`
- `harness/roles/claude-code.md`
- Relevant source files named below

## Current Branch

{branch}

## Current Git Status

{fenced(status)}

## Changed Files From Unstaged Diff

{fenced(changed_files)}

## Staged Files

{fenced(staged_files)}

## Untracked Files

{fenced(untracked_files)}

## Diff Stat

{fenced(diff_stat)}

## Active Error Memory

{chr(10).join(error_lines)}

## Recent Harness Runs

{bullet_list(recent_runs(), "No harness runs found.")}

## Claude Code Working Rules

- Keep implementation inside this task's scope.
- Preserve source-grounded analysis and HWP/HWPX reliability contracts.
- Do not edit Codex-authored tests unless the handoff explicitly asks.
- Do not touch secrets, env files, runtime logs, generated caches, or unrelated files.
- Return commands run, results, failures, assumptions, and the suggested Codex verification gate.

## Expected Return To Codex

- Changed files
- Behavior summary
- Commands run and results
- Any failures or open questions
- Suggested harness profile for Codex verification
"""


def default_output_path(agent: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = RUNS_DIR / f"{stamp}-handoff"
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir / f"{safe_agent_name(agent)}-handoff.md"


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Generate a Codex-to-Claude Code handoff")
    parser.add_argument("--task", default="")
    parser.add_argument("--for-agent", default="Claude Code")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--stdout", action="store_true")
    args = parser.parse_args()

    text = build_handoff(args.task, args.for_agent)
    if args.stdout:
        print(text)
        return 0

    output_path = args.output or default_output_path(args.for_agent)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(text, encoding="utf-8")
    print(f"Wrote handoff: {output_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
