# LiveDock Current Status and Roadmap

Last updated: 2026-07-05

## Current Status

- Ver1 applicant workflow remains the product core: ingest notice/form sources, analyze grounded facts, ask only missing inputs, draft by section, review, and export HTML/HWPX.
- Ver2 Agency NoticeOps is present as a separate agency-facing track with organization-scoped notice drafting, mandatory clause checks, prior-notice recall, and approval workflow state.
- The pivot plan in `docs/product/pivot-plan.md` has been implemented through Phase 6:
  - `EvaluationRubric` extraction is synchronized across backend schemas and frontend types.
  - Rubric scoring is optional and skipped when the source notice has no explicit rubric.
  - PSST framing and official-style drafting are applied to business-plan-style submissions.
  - Score UI lets users score drafts and route weak criteria into the existing feedback/revise flow.
  - Deterministic fixtures cover rubric-present and rubric-absent notices.
- Repository runtime outputs remain ignored: `node_modules`, `.next`, `.tmp`, `outputs`, `.uv-cache`, `.livedock_storage`, and `harness/runs`.

## Clean Structure

- `frontend/`: Next.js app, UI components, API client, frontend tests.
- `backend/`: FastAPI app, schemas, routers, services, contract/eval tests, HWPX toolchain.
- `docs/product/`: product plans, pivot plan, roadmap, demo notes.
- `docs/agent/`: Codex/Claude workflow and harness/skill architecture.
- `docs/engineering/`: deployment, architecture, environment, InsForge notes.
- `docs/evaluation/`: deterministic fixtures and eval documentation.
- `harness/`: state spec, quality gates, durable memory, error registry, handoffs.
- `tools/`: harness utilities and optional HWP MCP helper.
- `scripts/`: local wrappers for harness and dev servers.
- `migrations/`: InsForge/Postgres schema migrations.

## Follow-Up Plan

1. Production smoke: after frontend/backend deployment, run `/health`, `/api/hwpx/status`, demo workflow, and one representative analyze/draft/export flow.
2. Score loop hardening: add an end-to-end UI test for rubric-present scoring and weak-section revise count behavior.
3. Backend deployment clarity: confirm the current Render service has the HWPX toolchain paths and environment variables described in `docs/engineering/deployment.md`.
4. Rubric quality: add more real-style fixtures where evaluation tables use nested rows, subtotal weights, or non-100 totals.
5. HWPX readiness: run the `hwpx` harness profile when the local or deployed HWPX toolchain is available.
6. Documentation polish: refresh README Korean rendering and link the new product/agent docs from the README document index.
