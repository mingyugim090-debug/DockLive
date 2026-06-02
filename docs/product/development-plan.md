# Development Plan

For the IRIS/government R&D submission-document sequence, use
`docs/product/iris-mvp-phases.md` as the phase-by-phase execution plan.

## Milestone 1 - Stabilize Agent Harness

- Repair Korean docs and prompts.
- Add source evidence and confirmation contracts.
- Keep analysis, input collection, draft, confirmation, finalization as separate steps.
- Add eval fixture definitions.
- Add IRIS/government R&D fixture contracts for table-first submission documents.

## Milestone 2 - Improve Analysis Quality

- Add fixture files under `docs/evaluation/fixtures`.
- Add deterministic schema validation tests.
- Add AI-output validation and retry paths.
- Add OCR/HWP/HWPX ingestion strategy.
- Distinguish integrated R&D notice schedules from final submission deadlines.

## Milestone 3 - Live Drafting UX

- Use section-level draft generation.
- Add frontend stream handling with EventSource.
- Show section start/done/error state.
- Keep user confirmation before finalization.

## Milestone 4 - InsForge Persistence

- Create tables for users, documents, analyses, workflows, draft sections, exports.
- Store uploaded source files in InsForge Storage.
- Store generated export metadata.
- Keep Redis/in-memory only as fallback.

## Milestone 5 - HWPX Export

- Install HWPX toolchain in backend deployment.
- Convert final markdown to HWPX.
- Run namespace fix and validation.
- Store export validation summaries and retain HTML fallback when HWPX text
  extraction needs ZIP/XML fallback.
- Add uploaded HWPX template cloning workflow.
- Add HWP to HWPX conversion workflow.

## Milestone 6 - Community v2

- Opportunity source directory.
- Announcement feed.
- Team recruiting.
- Profiles and participation history.
- Interest-based recommendations.
