# Agent Evals

Core metric: **groundedness first**. Good writing is secondary to factual correctness.

## Scoring

| Criterion | Weight |
| --- | --- |
| Factual groundedness | 35 |
| Required document accuracy | 20 |
| Deadline/date accuracy | 15 |
| Uncertainty handling | 15 |
| Draft usefulness | 10 |
| Export readiness | 5 |

## Fixture Set

### Fixture 1 - Startup Grant PDF

Expected extraction:

- title
- organization
- application deadline
- required business plan
- eligibility stage
- benefits

Fail if:

- grant amount is invented
- eligibility is simplified without uncertainty

### Fixture 2 - Student Competition Announcement

Expected extraction:

- competition category
- team size limit
- submission format
- evaluation criteria
- required proposal sections

Fail if:

- optional portfolio is marked required without source evidence

### Fixture 3 - Scholarship Notice

Expected extraction:

- grade/department eligibility
- GPA or income criteria if present
- required certificates
- application period

Fail if:

- scholarship amount is guessed

### Fixture 4 - Research Program Call

Expected extraction:

- research area
- PI eligibility
- proposal sections
- budget/support details
- review criteria

Fail if:

- research period or budget is inferred without source text

### Fixture 5 - Ambiguous URL Notice

Expected extraction:

- available facts
- `uncertain_fields` for missing deadline/submission method

Fail if:

- Agent fills missing deadline or submission method from common patterns

### Fixture 6 - IRIS SME R&D Integrated Notice

Expected extraction:

- `government_rnd` document type
- Ministry and integrated R&D program title
- business overview and support-program table evidence
- structured `support_programs` rows for sub-program-specific scale, period,
  limit, ratio, and schedule
- support limit/ratio values only when source-grounded
- missing company/project facts for submission drafting
- required company/project input fields for company name, project title,
  technical summary, development goals, capability evidence,
  commercialization/use plan, and budget/use plan
- no duplicate missing-question fields for facts already covered by required
  company/project input fields
- table-first submission sections: business overview, technical goals, execution plan, commercialization, budget, expected impact, checklist
- section-specific `confirmation_required` values instead of copying every
  uncertainty into every section

Fail if:

- integrated month-level schedules become one invented submission deadline
- company project facts are filled without user input
- support amount, support ratio, schedule, or required documents are finalized without source evidence
- every government R&D draft section receives the same confirmation-required
  list without section-specific filtering

## Draft Eval

For each fixture:

1. Provide minimal user inputs.
2. Generate drafts.
3. Check that drafts cite only known facts and user inputs.
4. Check that uncertain claims appear in `confirmation_required`.
5. Finalize only after confirmation.

## HWPX Eval

When the HWPX toolchain is enabled:

1. Generate final document.
2. Export HWPX.
3. Run `fix_namespaces.py`.
4. Run `validate.py`.
5. Extract text and check title/section presence.
6. For government R&D fixtures, check title, `사업개요`, and at least one table-based section term.
7. If `python-hwpx` is unavailable, accept ZIP/XML fallback text extraction only
   when the fallback warning is recorded in the report.

## HTML Export Eval

For every deterministic fixture:

1. Convert the finalized markdown document to HWP-compatible HTML.
2. Save export metadata with a validation summary.
3. Check title, expected section text, and at least one table-based section.
4. For government R&D fixtures, require markdown pipe tables to render as HTML
   `<table>` elements instead of plain paragraph text.

## Fixture E2E Eval

Run the deterministic end-to-end fixture eval from the repository root:

```bash
py backend\tests\evals\run_fixture_e2e.py --mode deterministic
```

This validates that each real-notice-style fixture can move through analysis
normalization, workflow creation, required input collection, section draft
generation, confirmation, finalization, validated HTML export, and persistence
hooks.

To evaluate actual model extraction quality, configure the backend provider and
run:

```bash
py backend\tests\evals\run_fixture_e2e.py --mode real-ai --min-score 80
```

To include HWPX package validation and text extraction:

```bash
py backend\tests\evals\run_fixture_e2e.py --mode deterministic --min-score 90 --include-hwpx
```

The report is written to `outputs/fixture-e2e-report.json`.

## Production Smoke Eval

After Render and Vercel are deployed, run:

```bash
py backend\tests\evals\run_production_smoke.py --base-url https://your-backend.example.com
```

This checks health, text analysis, workflow resume, input saving, draft,
finalization, HTML export, export metadata listing, and stored export download.
Add `--require-hwpx` only when the deployed HWPX toolchain is expected to pass.

## Current Quality Gate

Before a production push that changes analysis, drafting, storage, or export behavior:

1. Run deterministic fixture E2E with `--min-score 80`.
2. Run backend contract tests.
3. Run frontend build if TS/TSX changed.
4. Check `/api/hwpx/status` in the target backend environment.
5. Run `--include-hwpx` only when status shows HWPX validation scripts are available.

Real-AI eval remains a separate quality check because it depends on provider keys and model behavior. Treat a real-AI average score below `80` as a prompt/schema regression to investigate before enabling live drafting for new users.
