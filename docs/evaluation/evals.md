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
