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
from tools.file_tools import read_document, relevant_excerpt  # noqa: E402


def _source_context(source_path: str, request: str) -> str:
    """참고자료 문서에서 요청 관련 부분만 추출해 컨텍스트로 만든다."""
    result = read_document(source_path)
    if not result["ok"]:
        print(f"[warn] 참고자료를 읽지 못함: {result['error']}")
        return ""
    return relevant_excerpt(result["data"]["paragraphs"], request)


def main() -> None:
    parser = argparse.ArgumentParser(description="DockLive Inline Agent")
    parser.add_argument("--file", help="대상 Excel 파일 경로")
    parser.add_argument("--request", help="자연어 요청")
    parser.add_argument("--source", help="참고자료 문서 경로 (HWPX/DOCX/PDF)")
    args = parser.parse_args()

    if args.file and args.request:
        request = f"대상 파일: {args.file}\n요청: {args.request}"
        context = _source_context(args.source, args.request) if args.source else ""
        print(run_agent(request, context=context))
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
