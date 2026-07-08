from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from integrity import extract, fill
from integrity.checks import hwpx_checks, xlsx_checks

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "corpus"
FORMS = CORPUS / "forms"
ROUNDTRIP = ROOT / "workspace" / "roundtrip"
REPORTS = ROOT / "workspace" / "reports"


def load_manifest() -> list[dict]:
    manifest_path = CORPUS / "manifest.json"
    if not manifest_path.exists():
        return []
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    return list(data.get("forms", []))


def manifest_entry_for(filename: str) -> dict:
    for entry in load_manifest():
        if entry.get("file") == filename:
            return entry
    return {"file": filename, "source": "ad hoc", "program": "single file grade"}


def grade_form(entry: dict) -> dict:
    source = FORMS / entry["file"]
    result: dict[str, Any] = {
        "file": entry["file"],
        "source": entry.get("source", ""),
        "program": entry.get("program", ""),
        "checks": {},
        "passed": False,
    }
    if not source.exists():
        result["checks"]["exists"] = (False, f"file does not exist: {source}")
        return _finalize(result)

    slots_result = _slots_for_entry(source, entry)
    if not slots_result["ok"]:
        result["checks"]["slot extraction"] = (False, slots_result["error"])
        return _finalize(result)
    slots = slots_result["slots"]
    result["slot_count"] = len(slots)

    ROUNDTRIP.mkdir(parents=True, exist_ok=True)
    filled = ROUNDTRIP / f"filled_{entry['file']}"
    fill_result = fill.fill_file(source, filled, slots)
    result["checks"]["fill"] = (
        bool(fill_result["ok"]),
        fill_result.get("error") or f"{fill_result.get('filled', 0)} slots filled",
    )
    if not fill_result["ok"]:
        return _finalize(result)

    result["checks"].update(_checks_for_pair(source, filled, slots))
    return _finalize(result)


def grade_existing_pair(original: str | Path, filled: str | Path, slots: list[dict] | None = None) -> dict:
    original_path = Path(original)
    filled_path = Path(filled)
    if slots is None:
        extracted = extract.extract_slots(original_path)
        slots = extracted.get("slots", []) if extracted.get("ok") else []
    result = {
        "file": filled_path.name,
        "source": str(original_path),
        "program": "existing pair comparison",
        "slot_count": len(slots),
        "checks": _checks_for_pair(original_path, filled_path, slots),
        "passed": False,
    }
    return _finalize(result)


def grade_all() -> dict:
    results = [grade_form(entry) for entry in load_manifest()]
    return write_report(_summary(results))


def grade_one(filename: str) -> dict:
    return write_report(_summary([grade_form(manifest_entry_for(filename))]))["results"][0]


def write_report(summary: dict) -> dict:
    REPORTS.mkdir(parents=True, exist_ok=True)
    json_summary = _jsonable(summary)
    (REPORTS / "integrity_latest.json").write_text(
        json.dumps(json_summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (REPORTS / "integrity_latest.md").write_text(_markdown(summary), encoding="utf-8")
    with (REPORTS / "history.jsonl").open("a", encoding="utf-8") as history:
        history.write(json.dumps(json_summary, ensure_ascii=False) + "\n")
    return summary


def _slots_for_entry(source: Path, entry: dict) -> dict:
    if entry.get("slots"):
        return {"ok": True, "slots": entry["slots"]}
    extracted = extract.extract_slots(source)
    if not extracted.get("ok"):
        return extracted
    slots = extracted.get("slots", [])
    default_max_chars = entry.get("max_chars")
    if isinstance(default_max_chars, int):
        for slot in slots:
            slot.setdefault("max_chars", default_max_chars)
    return {"ok": True, "slots": slots}


def _checks_for_pair(original: Path, filled: Path, slots: list[dict]) -> dict[str, tuple[bool, str]]:
    suffix = original.suffix.lower()
    if suffix == ".hwpx":
        return {
            "C1 zip/mimetype": hwpx_checks.check_zip_valid(filled),
            "C2 XML well-formed": hwpx_checks.check_xml_wellformed(filled),
            "C3 XML structure preserved": hwpx_checks.check_structure_preserved(original, filled),
            "C4 styles untouched": hwpx_checks.check_styles_untouched(original, filled),
            "C5 no placeholders left": hwpx_checks.check_no_placeholder_left(filled),
        }
    if suffix in {".xlsx", ".xlsm"}:
        fill_refs = {slot["ref"] for slot in slots if slot.get("kind") == "cell"}
        return {
            "C1 workbook loads": xlsx_checks.check_loads(filled),
            "C2 sheets preserved": xlsx_checks.check_sheets_preserved(original, filled),
            "C3 merged cells preserved": xlsx_checks.check_merged_cells_preserved(original, filled),
            "C4 formulas preserved": xlsx_checks.check_formulas_preserved(original, filled, fill_refs),
            "C5 character limits": xlsx_checks.check_char_limits(filled, slots),
        }
    return {"unsupported": (False, f"unsupported form type: {suffix}")}


def _finalize(result: dict) -> dict:
    result["failed_checks"] = [
        {"name": name, "detail": detail}
        for name, (passed, detail) in result["checks"].items()
        if not passed
    ]
    result["passed"] = not result["failed_checks"]
    return result


def _summary(results: list[dict]) -> dict:
    passed = sum(1 for result in results if result["passed"])
    total = len(results)
    return {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "total": total,
        "passed": passed,
        "pass_rate": round((passed / total) * 100, 1) if total else 0.0,
        "results": results,
    }


def _markdown(summary: dict) -> str:
    lines = [
        "# Integrity Grading Report",
        f"- Run: {summary['timestamp']}",
        f"- Pass rate: {summary['pass_rate']}% ({summary['passed']}/{summary['total']})",
        "",
        "| Form | Slots | Result | Failed checks |",
        "|---|---:|---|---|",
    ]
    for result in summary["results"]:
        failed = "; ".join(f"{item['name']}: {item['detail']}" for item in result["failed_checks"])
        lines.append(
            f"| {result['file']} | {result.get('slot_count', '-')} | "
            f"{'PASS' if result['passed'] else 'FAIL'} | {failed or '-'} |"
        )
    return "\n".join(lines) + "\n"


def _jsonable(value: Any) -> Any:
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value
