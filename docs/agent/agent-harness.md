# Agent Harness

## Goal

The harness makes Agent behavior repeatable and testable. It should prevent the model from drifting into unsupported claims or skipping user confirmation.

## Analysis Contract

The Analysis Agent must return:

- `doc_type`
- `title`
- `organization`
- `summary`
- `timeline`
- `checklist`
- `document_sections`
- `eligibility`
- `submission_method`
- `evaluation_criteria`
- `benefits`
- `cautions`
- `uncertain_fields`
- `source_evidence`

Failure conditions:

- Invented deadline
- Invented organization
- Required document not in source but marked required
- Missing uncertainty for ambiguous source text
- Invalid JSON

## Draft Contract

The Draft Agent must:

- Use only analysis output and user inputs.
- Draft by section.
- Preserve `confirmation_required`.
- Avoid submission-ready finalization before user confirmation.

Failure conditions:

- Unsupported claims about eligibility, budget, award, deadline, or submission method
- Whole document generated without section review
- No confirmation warning despite uncertain fields

## HWPX Harness

HWPX export must follow:

1. Generate or clone HWPX.
2. Run namespace fix.
3. Run validation.
4. Optionally extract text to confirm expected content.

If using an uploaded official form:

- Analyze form first.
- Clone and replace text.
- Preserve tables/images/styles.

## Local Commands

Backend:

```bash
cd backend
python -m compileall .
```

Frontend:

```bash
cd frontend
npm run build
```

HWPX:

```bash
python C:\Users\alseh\.codex\skills\hwpx\scripts\validate.py output.hwpx
```
