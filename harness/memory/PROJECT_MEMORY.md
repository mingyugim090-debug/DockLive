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
- `docs/product/pivot-plan.md` adds an optional rubric-scoring loop to Ver1's
  Draft step: extract `EvaluationRubric` only when a notice states one
  verbatim (never invent one), score confirmed draft sections against it,
  and let the user revise only the weak sections (capped at 2 rounds) via
  the existing feedback/revise endpoints. PSST framing and 개조식 official
  style are applied during drafting for business-plan-style submissions.
  Rubric-null notices must skip Score entirely with no UI/step regression
  to the existing 6-step happy path.
- Ver2 Agency UX was rebuilt as a 5-stage "공고 스튜디오" (discover → brief →
  edit → review → export) replacing the single-screen control room. IRIS
  notice discovery is allowed as on-demand fetch only (`iris_ingestion.py`:
  IRIS's own JSON list endpoint + server-rendered detail HTML, 15-min TTL
  cache, no login automation, no background crawling — see
  `contracts.iris_discovery` in state-spec). Parsed fields only; fetch
  failures surface as explicit errors, tests stay offline with fixtures.
- The document editor renders an A4 paper page driven by
  `DocumentStyleProfile` CSS vars (pattern revived from the orphaned
  `NoticeWebEditor.tsx`); sections are click-to-edit in place and every save
  goes through the existing versioned `update_agency_notice_section`. AI
  section revise (`agency_section_ai.py`) may only rephrase existing content
  — mock mode is whitespace-normalization only, asserted by contract test.

- Notice discovery is now multi-source behind `notice_sources.py` (registry of
  IRIS + 기업마당 bizinfo + K-Startup adapters returning normalized
  `DiscoveredNotice`). bizinfo/K-Startup need API keys (`BIZINFO_API_KEY`,
  `KSTARTUP_API_KEY`); keyless sources report unavailable with a reason and
  never block IRIS. Unified endpoints live under `/api/agency/discovery/*`;
  the old `/iris/*` routes are thin delegates. Tests stay offline with
  fixtures (`bizinfo-list-sample.json`, `kstartup-list-sample.json`).
- 2026-07 direction pivot (user decision): DockLive is being reshaped into an
  Inline-AI-style document automation agent. v1 "document workspace" shipped:
  multi-file project (`/api/workspaces`, `workspace_service.py`), CSV parsed
  via stdlib (XLSX/image are warning-only stubs), deterministic rule-based
  blueprint→generate (`blueprint_service.py`), inline block transforms
  paragraph→table→chart (`block_transforms.py`, values only from source
  cells), Markdown/HTML export with chart→table fallback
  (`workspace_export.py`). Frontend at `/app/projects`
  (`components/projects/ProjectWorkspace.tsx`, pure-SVG `ChartBlock`).
  Phase 2 shipped: XLSX parsed via openpyxl (500-row/50-col caps, values
  verbatim), LLM paragraph synthesis + rewrite in `workspace_drafting.py`
  (mock/keyless mode stays byte-identical rule-based; LLM may only rewrite
  existing paragraph blocks, never tables/charts/needs-input placeholders,
  and falls back to rule-based on any failure), real DOCX/HWPX/PDF exports
  (charts always render as fallback tables; HWPX via
  `export_markdown_to_hwpx_with_validation`), and InsForge persistence via
  the `document_workspaces` table (`document_workspace:` storage prefix,
  migration `20260707110000`). OCR stays out of scope; see
  `contracts.document_workspace` in state-spec.
- Agency redesign Phases 2-4 (content library, agency LLM drafting, studio
  frontend rebuild) are ON HOLD after the pivot; the approved plan for them
  is in the 2026-07-06 session plan file if resumed.

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
