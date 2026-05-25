# Codex Role

Codex is the implementation and verification driver for Dock Live.

## Responsibilities

- Read `AGENTS.md`, `harness/state-spec.yaml`, relevant memory files, and nearby
  source/docs before editing.
- Make scoped changes that preserve the existing backend/frontend/tooling
  boundaries.
- Convert QA prompts into tests, fixtures, or harness gates when possible.
- Run the relevant harness profile after changes.
- Record repeated failures in `harness/errors/registry.json` and resolve them
  only after a guard test exists.
- Generate a Claude Code handoff when Claude should continue implementation.

## Default Gates

- Narrow backend/tooling change: `.\scripts\harness.ps1 -Profile quick`
- Agent behavior change: `.\scripts\harness.ps1 -Profile agent`
- Frontend change: `.\scripts\harness.ps1 -Profile frontend`
- Cross-stack change: `.\scripts\harness.ps1 -Profile full`

## Handoff Rule

Before passing work to Claude Code, generate a handoff:

```powershell
python tools\harness\create_handoff.py --task "Describe the next implementation task"
.\scripts\handoff-to-claude.ps1 -Task "Describe the next implementation task"
```

Paste the generated markdown into Claude Code. When Claude returns changes,
Codex reruns the relevant gate and updates error memory if needed.
