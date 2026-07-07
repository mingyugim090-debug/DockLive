# Inline Agent Integrity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only validation gate that runs after local Excel/HWPX save/export operations.

**Architecture:** Create a focused `tools/integrity_tools.py` module and expose it as `validate_document`. Save/export tools call the validator and attach `validation_summary` without blocking file persistence.

**Tech Stack:** Python, pytest, openpyxl, zipfile, ElementTree, existing local agent tool dispatcher.

---

### Task 1: Integrity Validator

**Files:**
- Create: `docklive-inline-agent/src/tools/integrity_tools.py`
- Create: `docklive-inline-agent/tests/test_integrity_tools.py`

- [ ] Write failing tests for Excel placeholder detection, formula preservation, and HWPX mimetype/XML validation.
- [ ] Run `uv run --with-requirements docklive-inline-agent/requirements.txt python -m pytest docklive-inline-agent/tests/test_integrity_tools.py -q` and confirm the missing module failure.
- [ ] Implement `validate_document(path, original_path="", authored_ranges=None)` returning `{ok, data}` with `validation_passed`, `checks`, and `warnings`.
- [ ] Run the focused integrity tests and confirm they pass.

### Task 2: Tool Registry And Contracts

**Files:**
- Modify: `docklive-inline-agent/src/tools/schemas.py`
- Modify: `docklive-inline-agent/src/executor/dispatcher.py`
- Modify: `docklive-inline-agent/tests/test_contracts.py`

- [ ] Write a failing contract test that `validate_document` is registered and fails gracefully for missing files.
- [ ] Add schema and dispatcher registration.
- [ ] Run contract tests and confirm they pass.

### Task 3: Save/Export Integration

**Files:**
- Modify: `docklive-inline-agent/src/tools/excel_tools.py`
- Modify: `docklive-inline-agent/src/tools/hwpx_tools.py`
- Modify: `docklive-inline-agent/tests/test_excel_tools.py`
- Modify: `docklive-inline-agent/tests/test_hwpx_tools.py`

- [ ] Write failing tests proving `save_workbook`, `compose_hwpx_form`, and `export_hwpx_session` include `validation_summary`.
- [ ] Attach validator output after successful saves/exports.
- [ ] Run the local agent test suite.

### Task 4: Verification

**Files:**
- No production edits expected.

- [ ] Run `uv run --with-requirements docklive-inline-agent/requirements.txt python -m pytest docklive-inline-agent/tests -q`.
- [ ] Run `.\scripts\harness.ps1 -Profile quick`.
- [ ] Report unrelated dirty files separately from this feature.
