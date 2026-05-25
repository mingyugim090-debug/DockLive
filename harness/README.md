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
| Memory | `harness/errors/registry.json` | Remember recurring failures and their fixes. |

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
python tools\harness\error_memory.py match --log harness\runs\<run>\01-backend-contracts.log
```

## Codex + Claude Code Collaboration

- Claude Code can implement larger edits, but Codex should run the harness gates and record failures.
- Codex should check `harness/errors/registry.json` before repeating a fix.
- Gemini-style QA instructions should become tests or fixtures first, not production shortcuts.
- A change is not ready until the relevant profile passes or the failure is recorded with a clear reason.

## Error Registry

Tracked file:

- `harness/errors/registry.json`

Ignored runtime logs:

- `harness/runs/`

Each failure is fingerprinted from command, exit code, representative error line, and related file paths. When the same fingerprint appears again, the runner prints the previous symptom, root cause, fix summary, and guard test if they are known.
