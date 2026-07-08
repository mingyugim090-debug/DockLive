"""CLI 진입점 (Phase 3 데모).

사용:
  python src/cli.py --file "C:/작업/견적서양식.xlsx" --request "A사 데이터로 채워줘"
  python src/cli.py            # 대화형 모드
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agent.loop import run_agent  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="DockLive Inline Agent")
    parser.add_argument("--file", help="대상 Excel 파일 경로")
    parser.add_argument("--request", help="자연어 요청")
    args = parser.parse_args()

    if args.file and args.request:
        request = f"대상 파일: {args.file}\n요청: {args.request}"
        print(run_agent(request))
        return

    print("DockLive Inline Agent (종료: exit)")
    while True:
        try:
            line = input("요청> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not line or line.lower() == "exit":
            break
        print(run_agent(line))


if __name__ == "__main__":
    main()
