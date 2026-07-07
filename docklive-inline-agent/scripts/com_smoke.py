"""Windows COM 스모크 테스트 — LLM 없이 도구 계층만 실제 Excel로 검증한다 (Phase 3).

시나리오:
1) 견적서 양식 열기(자동 백업) → 구조 읽기 → A사 3개 품목 쓰기 → 합계 수식 → 저장 → 닫기
2) 실패 경로: 없는 시트 접근 → 에러 dict 확인 (예외 아님)

사용: python scripts/com_smoke.py   (Excel 설치된 Windows 전용)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tools import excel_tools  # noqa: E402

SAMPLE = ROOT / "samples" / "견적서양식.xlsx"

ITEMS = [
    [1, "노트북 거치대", 10, 25000, "=D9*E9"],
    [2, "무선 키보드", 5, 42000, "=D10*E10"],
    [3, "모니터암", 3, 89000, "=D11*E11"],
]


def check(step: str, out: dict) -> dict:
    status = "OK" if out.get("ok") else f"ERROR: {out.get('error')}"
    print(f"[{step}] {status}")
    return out


def main() -> int:
    if not SAMPLE.exists():
        print("샘플이 없음 — 먼저 python scripts/make_samples.py 실행")
        return 1

    out = check("open", excel_tools.open_workbook(str(SAMPLE), visible=True))
    if not out["ok"]:
        return 1
    check("sheets", excel_tools.list_sheets())
    check("read-header", excel_tools.read_range("견적서", "B8:F8"))

    # 실패 경로: 없는 시트 → 에러 dict (예외가 아니어야 함)
    bad = excel_tools.read_range("없는시트", "A1")
    assert bad["ok"] is False, "없는 시트는 에러를 반환해야 함"
    print(f"[missing-sheet] OK (에러 메시지: {bad['error'][:40]}...)")

    check("write-recipient", excel_tools.write_range("견적서", "C4", [["A사"]]))
    for row, item in zip(range(9, 12), ITEMS):
        check(f"write-item-{row}", excel_tools.write_range("견적서", f"B{row}:E{row}", [item[:4]]))
        check(f"formula-{row}", excel_tools.apply_formula("견적서", f"F{row}", item[4]))
    check("formula-total", excel_tools.apply_formula("견적서", "F14", "=SUM(F9:F13)"))
    check("format-total", excel_tools.format_range("견적서", "F9:F14", number_format="#,##0"))

    saved = check("save", excel_tools.save_workbook())
    check("close", excel_tools.close_workbook())

    if saved["ok"]:
        print(f"\n완료 - 저장본: {saved['data']['saved']}")
        print("백업본: workspace/backups/ 확인")
    return 0 if saved["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
