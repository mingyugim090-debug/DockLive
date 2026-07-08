from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from integrity import grader  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Compare headless-filled and Windows COM-filled outputs with the same "
            "integrity grader. This is Phase 9c scaffolding for manual Windows validation."
        )
    )
    parser.add_argument("--original", required=True, help="Original HWPX/XLSX form path.")
    parser.add_argument("--headless", required=True, help="Output created by scripts/grade.py or headless fill.")
    parser.add_argument("--com", required=True, help="Output created through Excel/Hancom COM tooling.")
    args = parser.parse_args()

    headless = grader.grade_existing_pair(args.original, args.headless)
    com = grader.grade_existing_pair(args.original, args.com)

    _print("headless", headless)
    _print("com", com)

    if not headless["passed"] or not com["passed"]:
        return 1
    print("Both paths passed the same integrity checks.")
    return 0


def _print(label: str, result: dict) -> None:
    print(f"{label}: {'PASS' if result['passed'] else 'FAIL'}")
    for name, (passed, detail) in result["checks"].items():
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}: {detail}")


if __name__ == "__main__":
    raise SystemExit(main())
