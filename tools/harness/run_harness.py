from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from error_memory import record_failure


ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = ROOT / "harness" / "runs"


@dataclass(frozen=True)
class GateCommand:
    name: str
    argv: list[str]
    cwd: Path = ROOT

    def display(self) -> str:
        return " ".join(self.argv)


def npm_command() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def py_args(*args: str) -> list[str]:
    return [sys.executable, *args]


COMPILE_EXCLUDE = r"(venv|\.venv|__pycache__|\.pytest_cache|\.livedock_storage|\.tmp|node_modules|\.next)"


def base_profiles(include_hwpx: bool = False) -> dict[str, list[GateCommand]]:
    frontend_dir = ROOT / "frontend"
    profiles = {
        "quick": [
            GateCommand("python-compile", py_args("-m", "compileall", "-q", "-x", COMPILE_EXCLUDE, "backend", "tools/harness")),
            GateCommand("harness-self-tests", py_args("-m", "unittest", "discover", "-s", "tools/harness/tests", "-p", "test_*.py")),
            GateCommand("backend-contracts", py_args("-m", "unittest", "backend.tests.contracts.test_agent_mvp_contracts")),
        ],
        "backend": [
            GateCommand("backend-compile", py_args("-m", "compileall", "-q", "-x", COMPILE_EXCLUDE, "backend")),
            GateCommand("backend-contracts", py_args("-m", "unittest", "backend.tests.contracts.test_agent_mvp_contracts")),
        ],
        "agent": [
            GateCommand(
                "deterministic-fixture-e2e",
                py_args("backend/tests/evals/run_fixture_e2e.py", "--mode", "deterministic", "--min-score", "80"),
            ),
        ],
        "frontend": [
            GateCommand("frontend-tests", [npm_command(), "run", "test"], frontend_dir),
            GateCommand("frontend-build", [npm_command(), "run", "build"], frontend_dir),
        ],
        "hwpx": [
            GateCommand(
                "deterministic-fixture-e2e-hwpx",
                py_args(
                    "backend/tests/evals/run_fixture_e2e.py",
                    "--mode",
                    "deterministic",
                    "--min-score",
                    "80",
                    "--include-hwpx",
                ),
            ),
        ],
    }
    profiles["full"] = [*profiles["backend"], *profiles["agent"], *profiles["frontend"]]
    if include_hwpx and "deterministic-fixture-e2e-hwpx" not in {command.name for command in profiles["full"]}:
        profiles["full"] = [*profiles["full"], *profiles["hwpx"]]
    if include_hwpx and "deterministic-fixture-e2e-hwpx" not in {command.name for command in profiles["agent"]}:
        profiles["agent"] = [*profiles["agent"], *profiles["hwpx"]]
    return profiles


def ensure_frontend_ready(command: GateCommand) -> int | None:
    if not command.name.startswith("frontend-"):
        return None
    if not (ROOT / "frontend" / "node_modules").exists():
        print("frontend/node_modules is missing. Run `cd frontend; npm ci` before the frontend gate.")
        return 2
    if shutil.which(command.argv[0]) is None:
        print(f"{command.argv[0]} was not found on PATH. Install Node.js/npm before the frontend gate.")
        return 2
    return None


def run_command(command: GateCommand, run_dir: Path, index: int) -> int:
    readiness_exit = ensure_frontend_ready(command)
    log_path = run_dir / f"{index:02d}-{command.name}.log"
    header = f"$ {command.display()}\n# cwd: {command.cwd}\n\n"
    if readiness_exit is not None:
        log_path.write_text(header + "Skipped: frontend dependencies are not installed.\n", encoding="utf-8")
        record_failure(command.display(), readiness_exit, log_path.read_text(encoding="utf-8"), run_log_path=str(log_path))
        return readiness_exit

    print(f"\n==> {command.name}")
    print(command.display())
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    completed = subprocess.run(
        command.argv,
        cwd=command.cwd,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    output = header + (completed.stdout or "")
    log_path.write_text(output, encoding="utf-8")
    print(completed.stdout or "")

    if completed.returncode != 0:
        entry, matched = record_failure(
            command.display(),
            completed.returncode,
            output,
            run_log_path=str(log_path.relative_to(ROOT)),
        )
        print(f"Recorded failure: {entry['id']} ({'existing' if matched else 'new'})")
        if matched:
            print(f"Previous symptom: {entry.get('symptom', '')}")
            if entry.get("root_cause"):
                print(f"Root cause: {entry['root_cause']}")
            if entry.get("fix_summary"):
                print(f"Known fix: {entry['fix_summary']}")
            if entry.get("guard_test"):
                print(f"Guard test: {entry['guard_test']}")
    return completed.returncode


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Run Dock Live harness quality gates")
    parser.add_argument("--profile", choices=["quick", "backend", "agent", "frontend", "full", "hwpx"], default="quick")
    parser.add_argument("--include-hwpx", action="store_true")
    parser.add_argument("--continue-on-failure", action="store_true")
    args = parser.parse_args()

    profiles = base_profiles(include_hwpx=args.include_hwpx)
    commands = profiles[args.profile]
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = RUNS_DIR / f"{stamp}-{args.profile}"
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"Dock Live harness profile: {args.profile}")
    print(f"Run logs: {run_dir.relative_to(ROOT)}")

    failed = 0
    for index, command in enumerate(commands, start=1):
        exit_code = run_command(command, run_dir, index)
        if exit_code != 0:
            failed = exit_code
            if not args.continue_on_failure:
                break

    if failed:
        print(f"\nHarness failed with exit code {failed}.")
        return failed
    print("\nHarness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
