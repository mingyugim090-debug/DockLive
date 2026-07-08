"""무결성 채점 CLI.

  python scripts/grade.py            # 코퍼스 전체 채점 → 스코어카드
  python scripts/grade.py --file 양식.hwpx   # 단일 양식
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from integrity import grader  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="단일 양식 파일명 (corpus/forms/ 기준)")
    ap.add_argument("--min-rate", type=float, default=None,
                    help="이 통과율(%%) 미만이면 exit 1 (CI 게이트용)")
    args = ap.parse_args()

    if args.file:
        r = grader.grade_form({"file": args.file})
        for name, (ok, detail) in r["checks"].items():
            print(f"  [{'PASS' if ok else 'FAIL'}] {name} — {detail}")
        print("결과:", "통과 ✅" if r["passed"] else "실패 ❌")
        return 0 if r["passed"] else 1

    s = grader.grade_all()
    print(f"무결성 통과율: {s['pass_rate']}% ({s['passed']}/{s['total']})")
    for r in s["results"]:
        mark = "✅" if r["passed"] else "❌"
        print(f"  {mark} {r['file']}")
        for name, (ok, detail) in r["checks"].items():
            if not ok:
                print(f"       └ FAIL {name}: {detail}")
    print("리포트: workspace/reports/integrity_latest.md")
    if args.min_rate is not None and s["pass_rate"] < args.min_rate:
        print(f"게이트 실패: {s['pass_rate']}% < {args.min_rate}%")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
