"""라운드트립 채점기: 코퍼스의 모든 양식에 대해
원본 → 슬롯 추출 → 더미 채움 → 무결성 검사 → 스코어카드.

이 숫자(무결성 통과율)가 DockLive의 핵심 지표다.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from integrity import extract, fill
from integrity.checks import hwpx_checks as hc
from integrity.checks import xlsx_checks as xc

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "corpus"
OUT = ROOT / "workspace" / "roundtrip"
REPORTS = ROOT / "workspace" / "reports"


def load_manifest() -> list[dict]:
    manifest = CORPUS / "manifest.json"
    if not manifest.exists():
        return []
    return json.loads(manifest.read_text(encoding="utf-8"))["forms"]


def grade_form(entry: dict) -> dict:
    """한 양식의 라운드트립 채점. entry: {file, slots?(수동 오버라이드), ...}"""
    src = CORPUS / "forms" / entry["file"]
    result: dict = {"file": entry["file"], "checks": {}, "passed": False}
    if not src.exists():
        result["checks"]["존재"] = (False, f"파일 없음: {src}")
        return _finalize(result)

    # 1) 슬롯: manifest 오버라이드 > 자동 추출
    if entry.get("slots"):
        slots = entry["slots"]
    else:
        ex = extract.extract_slots(src)
        if not ex["ok"]:
            result["checks"]["슬롯추출"] = (False, ex["error"])
            return _finalize(result)
        slots = ex["slots"]
    result["slot_count"] = len(slots)

    # 2) 채움
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"filled_{entry['file']}"
    fr = fill.fill_file(src, dst, slots)
    result["checks"]["채움"] = (fr["ok"], fr.get("error", f"{fr.get('filled', 0)}개 슬롯 채움"))
    if not fr["ok"]:
        return _finalize(result)

    # 3) 무결성 검사
    suffix = src.suffix.lower()
    if suffix == ".hwpx":
        result["checks"]["C1 zip/mimetype"] = hc.check_zip_valid(dst)
        result["checks"]["C2 XML well-formed"] = hc.check_xml_wellformed(dst)
        result["checks"]["C3 태그구조 보존"] = hc.check_structure_preserved(src, dst)
        result["checks"]["C4 스타일 무변경"] = hc.check_styles_untouched(src, dst)
        result["checks"]["C5 미채움 칸 없음"] = hc.check_no_placeholder_left(dst)
    elif suffix in (".xlsx", ".xlsm"):
        fill_refs = {s["ref"] for s in slots if s["kind"] == "cell"}
        result["checks"]["C1 파일 로드"] = xc.check_loads(dst)
        result["checks"]["C2 시트 보존"] = xc.check_sheets_preserved(src, dst)
        result["checks"]["C3 병합셀 보존"] = xc.check_merged_cells_preserved(src, dst)
        result["checks"]["C4 수식 보존"] = xc.check_formulas_preserved(src, dst, fill_refs)
        result["checks"]["C5 글자수 제한"] = xc.check_char_limits(dst, slots)
    return _finalize(result)


def _finalize(result: dict) -> dict:
    result["passed"] = all(ok for ok, _ in result["checks"].values())
    return result


def grade_all() -> dict:
    forms = load_manifest()
    results = [grade_form(f) for f in forms]
    passed = sum(1 for r in results if r["passed"])
    summary = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "total": len(results),
        "passed": passed,
        "pass_rate": round(passed / len(results) * 100, 1) if results else 0.0,
        "results": results,
    }
    _write_reports(summary)
    return summary


def _write_reports(summary: dict) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "integrity_latest.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    lines = [
        "# 양식 무결성 스코어카드",
        f"- 실행: {summary['timestamp']}",
        f"- **통과율: {summary['pass_rate']}% ({summary['passed']}/{summary['total']})**",
        "",
        "| 양식 | 슬롯 | 결과 | 실패 검사 |",
        "|---|---|---|---|",
    ]
    for r in summary["results"]:
        fails = "; ".join(f"{k}: {d}" for k, (ok, d) in r["checks"].items() if not ok)
        lines.append(f"| {r['file']} | {r.get('slot_count', '-')} | "
                     f"{'✅' if r['passed'] else '❌'} | {fails or '-'} |")
    (REPORTS / "integrity_latest.md").write_text("\n".join(lines), encoding="utf-8")
