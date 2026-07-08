from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from integrity import grader  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Grade HWPX/XLSX form round-trip integrity.")
    parser.add_argument("--file", help="Single file name under corpus/forms.")
    parser.add_argument("--min-rate", type=float, default=None, help="Fail when corpus pass rate is below this value.")
    args = parser.parse_args()

    if args.file:
        result = grader.grade_one(args.file)
        _print_result(result)
        return 0 if result["passed"] else 1

    summary = grader.grade_all()
    print(f"Integrity pass rate: {summary['pass_rate']}% ({summary['passed']}/{summary['total']})")
    for result in summary["results"]:
        _print_result(result, indent="  ")
    print("Report: workspace/reports/integrity_latest.md")
    if args.min_rate is not None and summary["pass_rate"] < args.min_rate:
        print(f"Integrity gate failed: {summary['pass_rate']}% < {args.min_rate}%")
        return 1
    return 0


def _print_result(result: dict, indent: str = "") -> None:
    mark = "PASS" if result["passed"] else "FAIL"
    print(f"{indent}{mark} {result['file']} ({result.get('slot_count', 0)} slots)")
    for name, (passed, detail) in result["checks"].items():
        check_mark = "PASS" if passed else "FAIL"
        print(f"{indent}  [{check_mark}] {name}: {detail}")


if __name__ == "__main__":
    raise SystemExit(main())
