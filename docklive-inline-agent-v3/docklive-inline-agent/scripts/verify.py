"""저장소 무결성 검증 — Codex는 매 태스크 완료 전 이 스크립트를 통과시켜야 한다.

검사: ① 문법 ② 스키마↔디스패처 동기화 ③ 계약 테스트 ④ 보호 경로 오염
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAIL = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global FAIL
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        FAIL += 1


def main() -> int:
    # 1) 문법
    r = subprocess.run([sys.executable, "-m", "compileall", "-q", str(ROOT / "src")],
                       capture_output=True, text=True)
    check("문법 검사 (compileall src)", r.returncode == 0, r.stderr.strip()[-300:])

    # 2) 스키마 ↔ 디스패처 동기화
    schemas = (ROOT / "src/tools/schemas.py").read_text(encoding="utf-8")
    dispatcher = (ROOT / "src/executor/dispatcher.py").read_text(encoding="utf-8")
    names = set(re.findall(r'"name":\s*"(\w+)"', schemas))
    missing = sorted(n for n in names if f'"{n}"' not in dispatcher)
    check("스키마↔디스패처 동기화", not missing, f"미등록: {missing}" if missing else f"{len(names)}개 도구")

    # 3) 계약 테스트
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", str(ROOT / "tests")],
                       capture_output=True, text=True)
    check("계약 테스트 (pytest)", r.returncode == 0, r.stdout.strip().splitlines()[-1] if r.stdout else "")

    # 4) 보호 경로가 git 변경에 포함되지 않았는지
    r = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, cwd=ROOT)
    dirty = [line for line in r.stdout.splitlines() if "samples/originals" in line]
    check("보호 경로 무변경 (samples/originals)", not dirty, "; ".join(dirty))

    # 5) 양식 무결성 게이트 (코퍼스가 있으면 통과율 100% 요구)
    if (ROOT / "corpus" / "manifest.json").exists():
        r = subprocess.run([sys.executable, str(ROOT / "scripts/grade.py"), "--min-rate", "100"],
                           capture_output=True, text=True)
        first = r.stdout.strip().splitlines()[0] if r.stdout else ""
        check("양식 무결성 (grade.py --min-rate 100)", r.returncode == 0, first)

    print("\n" + ("모든 검증 통과 ✔" if FAIL == 0 else f"{FAIL}개 검증 실패 ✘ — 완료 처리 금지"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
