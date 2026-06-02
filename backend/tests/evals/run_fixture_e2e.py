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


def load_backend_env() -> None:
    env_path = BACKEND / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_backend_env()
os.environ.setdefault("MOCK_MODE", "true")

from core.config import settings  # noqa: E402
from models.schemas import AnalysisResult  # noqa: E402
from services import storage  # noqa: E402
from services.analyzer import build_analysis_result  # noqa: E402
from services.document_ingestion import ingest_uploaded_document  # noqa: E402
from services.drafting_service import (  # noqa: E402
    confirm_workflow,
    create_workflow_session,
    export_markdown_to_hwpx,
    finalize_document,
    generate_drafts,
    markdown_to_hwp_compatible_html,
    update_inputs,
)
from services.openai_service import analyze_announcement  # noqa: E402


def load_fixtures(fixture_id: str | None = None) -> list[dict[str, Any]]:
    fixtures = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(FIXTURE_DIR.glob("*.json"))]
    if fixture_id:
        fixtures = [fixture for fixture in fixtures if fixture.get("id") == fixture_id]
    return fixtures


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

    timeline = list(expected.get("timeline", [])) if isinstance(expected.get("timeline"), list) else []
    if expected.get("deadline"):
        timeline.append({"label": "Submission deadline", "date": expected["deadline"], "is_deadline": True})

    title = expected.get("title_contains") or fixture["name"]
    document_sections = expected.get("document_sections")
    if not isinstance(document_sections, list):
        document_sections = [
            {"title": "Problem and purpose", "hint": "Use only facts from the notice and user input.", "order": 1},
            {"title": "Execution plan", "hint": "Describe concrete activities and schedule.", "order": 2},
            {"title": "Expected impact", "hint": "Keep claims grounded and reviewable.", "order": 3},
        ]
    source_evidence = expected.get("source_evidence")
    if not isinstance(source_evidence, list):
        source_evidence = [
            {"field": "title", "quote": title, "note": "fixture expected"},
            {"field": "organization", "quote": expected.get("organization", ""), "note": "fixture expected"},
        ]
    raw = {
        "doc_type": expected.get("doc_type", "competition"),
        "title": title,
        "organization": expected.get("organization", ""),
        "summary": evidence_text[:180],
        "timeline": timeline,
        "checklist": checklist,
        "document_sections": document_sections,
        "eligibility": _expected_list(expected, "eligibility_contains"),
        "submission_method": expected.get("submission_method_contains") or ("See source notice" if expected.get("deadline") else None),
        "evaluation_criteria": expected.get("evaluation_criteria", []) or _expected_list(expected, "research_areas"),
        "benefits": _expected_list(expected, "benefits_contains"),
        "cautions": _expected_list(expected, "cautions"),
        "uncertain_fields": _expected_list(expected, "uncertain_fields"),
        "source_evidence": source_evidence,
        "missing_questions": expected.get("missing_questions", []),
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

    submission_method = expected.get("submission_method_contains")
    if submission_method:
        add("submission_method", submission_method in (result.submission_method or ""), result.submission_method or "")

    for label in _expected_list(expected, "evaluation_criteria"):
        criteria_text = " | ".join(result.evaluation_criteria)
        add(f"evaluation_criteria:{label}", label in criteria_text, criteria_text)

    for label in _expected_list(expected, "eligibility_contains"):
        eligibility_text = " | ".join(result.eligibility)
        add(f"eligibility:{label}", label in eligibility_text, eligibility_text)

    for label in _expected_list(expected, "benefits_contains"):
        benefits_text = " | ".join(result.benefits)
        add(f"benefit:{label}", label in benefits_text, benefits_text)

    section_text = " | ".join(section.title for section in result.document_template)
    for label in _expected_list(expected, "must_have_sections"):
        add(f"document_section:{label}", label in section_text, section_text)

    question_text = " | ".join(question.question for question in result.missing_questions)
    for label in _expected_list(expected, "must_have_missing_questions"):
        add(f"missing_question:{label}", label in question_text, question_text)

    forbidden_benefits = _expected_list(expected, "forbidden_benefits")
    if forbidden_benefits:
        benefits_text = " | ".join(result.benefits)
        add("no_forbidden_benefits", not _contains_any(benefits_text, forbidden_benefits), benefits_text)

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


def score_workflow_text(report: dict[str, Any], fixture: dict[str, Any], draft_text: str, confirmation_items: list[str]) -> None:
    expected = fixture["expected"]
    checks: list[dict[str, Any]] = []

    def add(name: str, passed: bool, detail: str = "") -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    for label in _expected_list(expected, "draft_must_contain"):
        add(f"draft_contains:{label}", label in draft_text, draft_text[:400])

    if expected.get("doc_type") == "government_rnd":
        add("draft_has_markdown_table", "| 항목 | 내용 |" in draft_text or "| 구분 |" in draft_text, draft_text[:400])
        add("confirmation_required_from_uncertainty", bool(confirmation_items), " | ".join(confirmation_items))

    report["draft_checks"] = checks
    if checks and not all(item["passed"] for item in checks):
        report["score"] = min(report["score"], 79.0)


def run_one(fixture: dict[str, Any], mode: str, include_hwpx: bool) -> dict[str, Any]:
    old_mock_mode = settings.MOCK_MODE
    if mode == "real-ai":
        settings.MOCK_MODE = False
        raw = analyze_announcement(fixture["announcement_text"], fixture["name"])
    else:
        raw = deterministic_raw_analysis(fixture)

    result = build_analysis_result(raw, source_type="text", source_name=fixture["name"])
    settings.MOCK_MODE = True
    workflow = create_workflow_session(result)
    updates = {
        field.id: f"{field.label}: fixture eval input for {fixture['id']}"
        for field in workflow.user_inputs
        if field.required
    }
    workflow = update_inputs(workflow, updates)
    workflow = generate_drafts(workflow)
    draft_text = "\n\n".join(draft.content_markdown for draft in workflow.draft_sections)
    confirmation_items = [
        item
        for draft in workflow.draft_sections
        for item in (draft.confirmation_required or [])
    ]
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
    score_workflow_text(report, fixture, draft_text, confirmation_items)
    if include_hwpx:
        filename, content = export_markdown_to_hwpx(workflow.final_document.content_markdown, workflow.final_document.title)
        ingested = ingest_uploaded_document(content, filename)
        expected_hwpx_terms = _expected_list(fixture["expected"], "hwpx_text_must_contain")
        hwpx_terms_found = {term: term in ingested.text for term in expected_hwpx_terms}
        report["hwpx"] = {
            "filename": filename,
            "is_zip": content.startswith(b"PK"),
            "text_chars": len(ingested.text),
            "title_found": workflow.final_document.title[:20] in ingested.text,
            "terms_found": hwpx_terms_found,
            "table_section_found": bool(expected_hwpx_terms and any(term in ingested.text for term in expected_hwpx_terms)),
        }
        if not report["hwpx"]["is_zip"] or report["hwpx"]["text_chars"] < 20 or not all(hwpx_terms_found.values()):
            report["score"] = min(report["score"], 79.0)
    settings.MOCK_MODE = old_mock_mode
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["deterministic", "real-ai"], default="deterministic")
    parser.add_argument("--min-score", type=float, default=80.0)
    parser.add_argument("--include-hwpx", action="store_true")
    parser.add_argument("--fixture-id")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "fixture-e2e-report.json")
    args = parser.parse_args()

    fixtures = load_fixtures(args.fixture_id)
    if args.fixture_id and not fixtures:
        print(f"No fixture found for --fixture-id {args.fixture_id}")
        return 2
    reports = [run_one(fixture, args.mode, args.include_hwpx) for fixture in fixtures]
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
