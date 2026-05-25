# Dock Live Harness

The harness turns Dock Live development from "ask the agent to do well" into a controlled loop:

1. Read the state spec.
2. Make a scoped change.
3. Run the right quality gate.
4. Record repeatable failures.
5. Use the registry before the next agent session.

## Layers

| Layer | Files | Purpose |
| --- | --- | --- |
| Context | `AGENTS.md`, `harness/state-spec.yaml` | Keep Codex, Claude Code, and human reviewers aligned on product invariants. |
| Tooling | `tools/harness/`, `scripts/harness.ps1` | Run the same checks locally and in CI. |
| Sandbox | `harness/runs/` | Store raw command output outside tracked source files. |
| Eval | `harness/quality-gates.yaml`, backend/frontend tests | Block regressions with deterministic checks. |
| Memory | `harness/memory/`, `harness/errors/registry.json` | Remember durable project facts and recurring failures. |
| Handoff | `harness/roles/`, `harness/handoffs/`, `tools/harness/create_handoff.py` | Pass bounded work between Codex and Claude Code. |

## Hermes-Inspired Operating Model

Dock Live borrows Hermes's useful operating principles without embedding Hermes
as a product runtime dependency:

- load explicit context before tools,
- keep durable memory small and searchable,
- isolate raw run logs from tracked source,
- delegate work through role-specific handoffs,
- treat every agent result as unverified until a gate passes.

## Local Usage

From the repository root:

```powershell
.\scripts\harness.ps1 -Profile quick
.\scripts\harness.ps1 -Profile agent
.\scripts\harness.ps1 -Profile frontend
.\scripts\harness.ps1 -Profile full
```

Direct Python usage:

```powershell
python tools\harness\run_harness.py --profile quick
python tools\harness\error_memory.py list
python tools\harness\error_memory.py search grounded
python tools\harness\error_memory.py match --log harness\runs\<run>\01-backend-contracts.log
python tools\harness\create_handoff.py --task "Continue the next Dock Live implementation step"
.\scripts\handoff-to-claude.ps1 -Task "Continue the next Dock Live implementation step"
```

## Codex + Claude Code Collaboration

- Claude Code can implement larger edits, but Codex should run the harness gates and record failures.
- Codex should check `harness/errors/registry.json` before repeating a fix.
- Codex should check `harness/memory/` before changing product behavior.
- Claude Code should receive a generated handoff instead of an open-ended prompt.
- Gemini-style QA instructions should become tests or fixtures first, not production shortcuts.
- A change is not ready until the relevant profile passes or the failure is recorded with a clear reason.

Generate a Claude Code handoff:

```powershell
python tools\harness\create_handoff.py --task "Implement the requested scoped change"
.\scripts\handoff-to-claude.ps1 -Task "Implement the requested scoped change"
```

## Error Registry

Tracked file:

- `harness/errors/registry.json`

Ignored runtime logs:

- `harness/runs/`

Each failure is fingerprinted from command, exit code, representative error line, and related file paths. When the same fingerprint appears again, the runner prints the previous symptom, root cause, fix summary, and guard test if they are known.
