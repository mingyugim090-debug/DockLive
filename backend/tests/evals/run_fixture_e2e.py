"""Run fixture-based end-to-end evals for the LiveDock Agent MVP.

Default mode is deterministic and CI-safe: it converts fixture expectations into
a grounded analysis payload, then exercises workflow, draft, finalization, export,
and persistence hooks. Use --mode real-ai to send fixture announcement text to
the configured AI provider and score the extracted result.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
FIXTURE_DIR = ROOT / "docs" / "evaluation" / "fixtures"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

from models.schemas import AnalysisResult  # noqa: E402
from services import storage  # noqa: E402
from services.analyzer import build_analysis_result  # noqa: E402
from services.drafting_service import (  # noqa: E402
    confirm_workflow,
    create_workflow_session,
    finalize_document,
    generate_drafts,
    markdown_to_hwp_compatible_html,
    update_inputs,
)
from services.openai_service import analyze_announcement  # noqa: E402


def load_fixtures() -> list[dict[str, Any]]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(FIXTURE_DIR.glob("*.json"))]


def _expected_list(expected: dict[str, Any], key: str) -> list[str]:
    value = expected.get(key, [])
    return [str(item) for item in value] if isinstance(value, list) else []


def _contains_any(text: str, values: list[str]) -> bool:
    return any(value and value in text for value in values)


def deterministic_raw_analysis(fixture: dict[str, Any]) -> dict[str, Any]:
    expected = fixture["expected"]
    required_docs = _expected_list(expected, "required_documents")
    optional_docs = _expected_list(expected, "optional_documents")
    evidence_text = fixture["announcement_text"]

    checklist = [
        {
            "label": label,
            "category": "required",
            "description": "Fixture expected required document.",
            "file_format": "PDF/HWPX or notice-specified format",
        }
        for label in required_docs
    ]
    checklist.extend(
        {
            "label": label,
            "category": "optional",
            "description": "Fixture expected optional document.",
            "file_format": "PDF/HWPX or notice-specified format",
        }
        for label in optional_docs
    )

    timeline = []
    if expected.get("deadline"):
        timeline.append({"label": "Submission deadline", "date": expected["deadline"], "is_deadline": True})

    title = expected.get("title_contains") or fixture["name"]
    raw = {
        "doc_type": expected.get("doc_type", "competition"),
        "title": title,
        "organization": expected.get("organization", ""),
        "summary": evidence_text[:180],
        "timeline": timeline,
        "checklist": checklist,
        "document_sections": [
            {"title": "Problem and purpose", "hint": "Use only facts from the notice and user input.", "order": 1},
            {"title": "Execution plan", "hint": "Describe concrete activities and schedule.", "order": 2},
            {"title": "Expected impact", "hint": "Keep claims grounded and reviewable.", "order": 3},
        ],
        "eligibility": _expected_list(expected, "eligibility_contains"),
        "submission_method": "See source notice" if expected.get("deadline") else None,
        "evaluation_criteria": _expected_list(expected, "research_areas"),
        "benefits": [],
        "cautions": [],
        "uncertain_fields": _expected_list(expected, "uncertain_fields"),
        "source_evidence": [
            {"field": "title", "quote": title, "note": "fixture expected"},
            {"field": "organization", "quote": expected.get("organization", ""), "note": "fixture expected"},
        ],
    }
    if expected.get("deadline"):
        raw["source_evidence"].append(
            {"field": "submission_deadline", "quote": expected["deadline"], "note": "fixture expected"}
        )
    return raw


def score_analysis(result: AnalysisResult, fixture: dict[str, Any]) -> dict[str, Any]:
    expected = fixture["expected"]
    checks: list[dict[str, Any]] = []

    def add(name: str, passed: bool, detail: str = "") -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    add("doc_type", result.doc_type == expected.get("doc_type"), f"{result.doc_type} != {expected.get('doc_type')}")

    title_contains = expected.get("title_contains")
    if title_contains:
        add("title_contains", title_contains in result.title, result.title)

    organization = expected.get("organization")
    if organization:
        add("organization", organization in result.organization, result.organization)

    deadline = expected.get("deadline")
    if deadline:
        dates = [item.date for item in result.timeline]
        add("deadline", deadline in dates, ", ".join(dates))
    else:
        add("no_invented_deadline", len(result.timeline) == 0, f"timeline_count={len(result.timeline)}")

    required_labels = " | ".join(item.label for item in result.checklist if item.category == "required")
    for label in _expected_list(expected, "required_documents"):
        add(f"required_document:{label}", label in required_labels, required_labels)

    optional_labels = " | ".join(item.label for item in result.checklist if item.category == "optional")
    for label in _expected_list(expected, "optional_documents"):
        add(f"optional_document:{label}", label in optional_labels, optional_labels)
        add(f"optional_not_required:{label}", label not in required_labels, required_labels)

    uncertainty_text = " | ".join(result.uncertain_fields)
    for label in _expected_list(expected, "uncertain_fields"):
        add(f"uncertain_field:{label}", label in uncertainty_text, uncertainty_text)

    evidence_fields = {item.field for item in result.source_evidence}
    for field in _expected_list(expected, "must_have_source_evidence"):
        add(f"source_evidence:{field}", field in evidence_fields, ", ".join(sorted(evidence_fields)))

    passed = sum(1 for check in checks if check["passed"])
    return {
        "fixture_id": fixture["id"],
        "score": round(100 * passed / max(1, len(checks)), 1),
        "passed": passed,
        "total": len(checks),
        "checks": checks,
    }


def run_one(fixture: dict[str, Any], mode: str) -> dict[str, Any]:
    raw = analyze_announcement(fixture["announcement_text"], fixture["name"]) if mode == "real-ai" else deterministic_raw_analysis(fixture)
    result = build_analysis_result(raw, source_type="text", source_name=fixture["name"])
    workflow = create_workflow_session(result)
    updates = {
        field.id: f"{field.label}: fixture eval input for {fixture['id']}"
        for field in workflow.user_inputs
        if field.required
    }
    workflow = update_inputs(workflow, updates)
    workflow = generate_drafts(workflow)
    workflow = confirm_workflow(workflow)
    workflow = finalize_document(workflow)

    storage.save_result(result.id, result.model_dump(mode="json"))
    storage.save_workflow(workflow.id, workflow.model_dump(mode="json"))

    assert workflow.final_document is not None
    html = markdown_to_hwp_compatible_html(workflow.final_document.content_markdown, workflow.final_document.title)
    storage.save_export_file(
        workflow.id,
        f"{fixture['id']}.html",
        html.encode("utf-8"),
        "text/html; charset=utf-8",
        "fixture_eval_html",
    )

    report = score_analysis(result, fixture)
    report["workflow_status"] = workflow.status
    report["draft_sections"] = len(workflow.draft_sections)
    report["final_document_chars"] = len(workflow.final_document.content_markdown)
    report["analysis_id"] = result.id
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["deterministic", "real-ai"], default="deterministic")
    parser.add_argument("--min-score", type=float, default=80.0)
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "fixture-e2e-report.json")
    args = parser.parse_args()

    reports = [run_one(fixture, args.mode) for fixture in load_fixtures()]
    summary = {
        "mode": args.mode,
        "min_score": args.min_score,
        "average_score": round(sum(item["score"] for item in reports) / max(1, len(reports)), 1),
        "reports": reports,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    failing = [item for item in reports if item["score"] < args.min_score or item["workflow_status"] != "finalized"]
    return 1 if failing else 0


if __name__ == "__main__":
    raise SystemExit(main())
