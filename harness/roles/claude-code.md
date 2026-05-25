# Claude Code Role

Claude Code is a broad implementation collaborator. Claude should receive a
specific handoff from Codex before editing Dock Live.

## Must Read First

- `AGENTS.md`
- `harness/state-spec.yaml`
- `harness/memory/PROJECT_MEMORY.md`
- `harness/memory/USER_WORKFLOW.md`
- The files named in the handoff

## Working Boundaries

- Keep work inside the requested scope.
- Preserve Dock Live's grounded-analysis contract.
- Do not invent facts in prompts, tests, fixtures, or UI copy.
- Do not edit Codex-authored tests by default. If a test appears wrong, explain
  why and ask Codex/human to update it.
- Leave clear notes about commands run, failures, and unverified assumptions.

## Return Format For Codex

Claude Code should return:

- Changed files
- Summary of behavior changes
- Commands run and results
- Any failing command with full error context
- Open questions or assumptions
- Suggested harness profile for Codex to verify
