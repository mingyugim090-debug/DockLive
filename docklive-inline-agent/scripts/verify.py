from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILURES = 0
PYTEST_BASETEMP = ROOT / ".pytest-tmp"


def main() -> int:
    _check_compile()
    _check_schema_dispatcher_sync()
    _run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            str(ROOT / "tests"),
            "--basetemp",
            str(PYTEST_BASETEMP),
        ],
        "pytest",
    )
    if (ROOT / "corpus" / "manifest.json").exists():
        _run([sys.executable, str(ROOT / "scripts" / "grade.py"), "--min-rate", "100"], "integrity grade")
    print("\n" + ("All verify checks passed" if FAILURES == 0 else f"{FAILURES} verify checks failed"))
    return 1 if FAILURES else 0


def _check_compile() -> None:
    _run([sys.executable, "-m", "compileall", "-q", str(ROOT / "src")], "compileall src")


def _check_schema_dispatcher_sync() -> None:
    schemas = (ROOT / "src" / "tools" / "schemas.py").read_text(encoding="utf-8")
    dispatcher = (ROOT / "src" / "executor" / "dispatcher.py").read_text(encoding="utf-8")
    schema_names = set(re.findall(r'"name":\s*"(\w+)"', schemas))
    missing = sorted(name for name in schema_names if f'"{name}"' not in dispatcher)
    _report("schema/dispatcher sync", not missing, f"missing={missing}" if missing else f"{len(schema_names)} tools")


def _run(command: list[str], name: str) -> None:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    detail = _last_line(result.stdout) or _last_line(result.stderr)
    _report(name, result.returncode == 0, detail)
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)


def _report(name: str, ok: bool, detail: str = "") -> None:
    global FAILURES
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f": {detail}" if detail else ""))
    if not ok:
        FAILURES += 1


def _last_line(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[-1] if lines else ""


if __name__ == "__main__":
    raise SystemExit(main())
