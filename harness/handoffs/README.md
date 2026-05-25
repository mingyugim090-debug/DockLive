# Codex to Claude Code Handoffs

Use handoffs when Claude Code should continue work started by Codex. The goal is
to make delegation explicit, bounded, and verifiable.

## Generate A Handoff

From the repository root:

```powershell
python tools\harness\create_handoff.py --task "Implement the next scoped task for Dock Live"
.\scripts\handoff-to-claude.ps1 -Task "Implement the next scoped task for Dock Live"
```

The command writes a markdown file under ignored `harness/runs/` and prints the
path. Paste that markdown into Claude Code.

For a terminal-only copy:

```powershell
python tools\harness\create_handoff.py --task "..." --stdout
```

## What The Handoff Contains

- Task objective
- Required context files
- Current git status and changed files
- Active recurring errors
- Recent harness runs
- Claude Code working rules
- Expected return format

## After Claude Code Responds

1. Inspect Claude's changed files.
2. Run the relevant harness profile.
3. Record any repeated failure with `tools/harness/error_memory.py`.
4. Resolve an error only after a guard test exists.
