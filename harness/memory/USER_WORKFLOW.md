# Dock Live User Workflow Memory

This file captures stable preferences from the product owner.

## Product Owner Goals

- Build Dock Live toward an Inline AI-like workflow for official document
  creation, while keeping the actual MVP focused on public notices and HWPX.
- Recenter the MVP on IRIS/government R&D calls: users upload or paste a public
  R&D notice, provide company/project facts, and receive a submission document
  or business/R&D plan draft.
- Reduce unnecessary UI and user burden. The system should do the parsing,
  grounding, and draft preparation, then ask the user only for missing facts.
- Keep the repository clean so future feature work is easier and safer.
- Use harness engineering to prevent repeated mistakes.

## Agent Collaboration Preference

- Codex and Claude Code will be used together.
- Codex should create tests, inspect context, run quality gates, and verify
  Claude Code's output.
- Claude Code can perform broader implementation, but its work is not accepted
  until Codex runs the relevant harness profile.
- Gemini-style QA or planning prompts should become tests, fixtures, contracts,
  or quality gates before they influence production code.

## UX Priority

The core flow should stay simple:

1. Upload or enter notice/form source.
2. Extract text and tables.
3. Analyze only source-grounded facts.
4. Ask for missing user-specific information.
5. Generate table-first submission drafts section by section.
6. Review and confirm.
7. Export HTML/HWPX with validation or a clear fallback.
