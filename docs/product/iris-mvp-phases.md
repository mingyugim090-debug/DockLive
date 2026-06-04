# IRIS Submission Document MVP Phases

This plan keeps LiveDock's existing Agent MVP direction while focusing the
current product path on IRIS/government R&D notice analysis and company
submission document drafting.

## Phase 0 - Harness Anchor

Status: done

- Recenter state spec and durable memory on IRIS/government R&D submission
  documents.
- Add compact IRIS SME R&D fixture without committing the raw HWPX.
- Add `government_rnd` doc type across backend and frontend contracts.
- Verify table-first draft generation, confirmation gates, and HWPX fallback.

## Phase 1 - Structured R&D Notice Analysis

Status: done

- Represent support-program status tables as structured rows instead of loose
  benefit strings.
- Preserve sub-program-specific support scale, period, limit, ratio, and
  schedule.
- Prevent integrated month-level schedules from becoming a single invented
  submission deadline.
- Keep support amount, ratio, schedule, and required documents tied to source
  evidence or confirmation-required fields.

## Phase 2 - Company Input Collection

Status: done

- Convert missing company/project facts into user input fields grouped by draft
  section.
- Prioritize company name, project title, technical summary, development goals,
  capability evidence, and budget/use plan.
- Avoid asking for facts already grounded in the notice.

## Phase 3 - Section Drafting Workflow

Status: done

- Generate section drafts for business overview, technical goals, execution
  plan, commercialization/use plan, budget plan, expected effects, and
  submission checklist.
- Keep table-first output for v1 visuals.
- Track `confirmation_required` at section level until the user confirms.

## Phase 4 - Export Validation

Status: done

- Validate HTML/HWPX export text for title, business overview, and at least one
  table-based section.
- Keep ZIP/XML fallback available when `python-hwpx` is missing and record the
  fallback warning.
- Preserve user work and provide HTML fallback when HWPX validation fails.

## Phase 5 - Product UX And Persistence

Status: done

- Surface support-program rows, missing input questions, section drafts, and
  export status in the frontend.
- Add InsForge persistence for uploaded source files, analysis results,
  workflow sessions, draft sections, and export metadata when storage/auth work
  is in scope.

Progress:

- Done: result page surfaces support-program rows, table-first draft previews,
  and export validation summary/warnings.
- Done: persistence contract preserves uploaded source files, analyses,
  workflow payloads, user inputs, draft sections, confirmed items, final
  documents, and export metadata. Draft sections stay inside
  `workflow_sessions.payload` for the MVP.

## Phase 6 - University And Researcher R&D Harness

Status: done

- Add a compact bio/medical R&D fixture derived from the uploaded HWPX notice
  without committing the raw document.
- Add `applicant_kind` so `government_rnd` analysis can distinguish company
  drafts from university/researcher drafts.
- Preserve RFP-specific table fields such as RFP management number, research
  topic, research budget, selected project count, task type, RFP type code, and
  security level.
- Generate university/researcher input fields for lead research institution,
  principal investigator, RFP alignment, research goals, methodology, research
  team, partner institutions, DMP, budget, and expected outcomes.
- Generate table-first research plan sections and section-specific
  confirmation gates for RFP alignment, DMP, partner institutions, 3책5공, and
  participation restrictions.

## Out Of Scope For V1 Harness

- IRIS login or live crawler integration.
- Native HWPX chart objects.
- Inline AI editor UI; planned after the university/researcher harness is stable.
- Community, feed, team recruiting, or social features.
