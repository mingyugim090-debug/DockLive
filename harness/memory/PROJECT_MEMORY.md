# Dock Live Project Memory

This file stores durable facts that should survive agent sessions. Keep it short,
source-grounded, and useful for future Codex or Claude Code work.

## Product Direction

- Dock Live is an Agent MVP for public notice ingestion, grounded analysis,
  section-by-section drafting, user confirmation, and editable HTML/HWPX export.
- Current MVP emphasis is IRIS/government R&D notice analysis for company,
  university, researcher, and research-lab submission documents and R&D plan
  drafts, not public notice publication as the primary output.
- Ver2 is a separate Agency NoticeOps track for agency staff who author public
  notices and route them through internal review/approval. Keep Ver1 applicant
  drafting intact while adding organization-scoped agency workflows.
- The target experience is Inline AI-like assisted authoring, but the first
  product priority is reliability: upload, parse, analyze, ask only missing
  questions, draft, review, export.
- The service must remove unnecessary user work. Do not add social/community,
  recruiting, or feed features unless the human explicitly asks.

## Non-Negotiable Contracts

- Analysis must be based only on extracted source text and table data.
- Missing facts remain missing. Do not infer deadlines, organizations,
  eligibility, documents, budgets, or submission methods without evidence.
- Each analysis item should be traceable through evidence quotes/source fields.
- HWP/HWPX reliability is a core workflow, not an optional export feature.
- v1 R&D document visuals are table-first. Native HWPX chart objects are out of
  scope until the table-based harness is stable.
- Government R&D analysis now carries `applicant_kind`; university/researcher
  notices must ask for research institution, PI, RFP alignment, DMP, partner
  institutions, budget, and outcomes instead of company-only facts.
- API schema changes must stay synchronized across backend schemas, frontend
  types, and API consumers.
- Ver2 agency records must be scoped by `organization_id`; approval comments
  stay tied to specific notice versions, and published state is blocked until
  approved.

## Harness Decisions

- `harness/state-spec.yaml` is the machine-readable product contract.
- `harness/quality-gates.yaml` documents quality profiles.
- `tools/harness/run_harness.py` is the executable local/CI gate runner.
- `harness/errors/registry.json` is tracked and stores recurring failure memory.
- `harness/runs/` is ignored and stores raw command logs and generated handoffs.

## Update Rules

- Add only stable decisions, repeated lessons, and product constraints here.
- Do not store secrets, API keys, personal tokens, or one-off debug output.
- If a fact is temporary, put it in a handoff or run log instead.
