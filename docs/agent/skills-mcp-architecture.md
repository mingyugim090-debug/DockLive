# Skills and MCP Architecture

## Purpose

LiveDock uses skills as development-time workflow instructions and backend services as the product runtime.

```text
Claude/Codex skills -> guide development and manual tests
Gemma/OpenAI -> generate structured JSON and section drafts
FastAPI backend -> own user workflow, validation, storage, export APIs
hwpx scripts -> create/fix/validate HWPX files
hwp-mcp -> optional local Windows/HWP rendering helper
```

## Skill Layout

Project-local Claude skills live under:

```text
.claude/skills/<skill-name>/SKILL.md
```

Current service skills:

- `livedock-agent-mvp`: product and workflow guardrails
- `livedock-hwpx-intake`: uploaded HWP/HWPX analysis and request classification
- `livedock-hwpx-content`: AI-generated content/replacement JSON
- `livedock-hwpx-export`: actual file creation through backend/HWPX toolchain
- `livedock-hwpx-validate`: namespace fix, validation, source/result verification
- `livedock-hwp-mcp-local`: local Windows HWP helper only

## Runtime Boundary

Skills are not the web-service runtime. They describe how agents should work on the repository.

The product runtime should expose this path:

```text
frontend upload/input
-> FastAPI workflow APIs
-> AI provider for JSON/drafts
-> clone_hwpx_template or export_markdown_to_hwpx
-> fix_namespaces.py
-> validate.py
-> verify_hwpx.py
-> download/storage response
```

## MCP Boundary

Do not make `hwp-mcp` a required backend dependency.

Use `hwp-mcp` only for:

- Local rendering checks
- `.hwp`-specific manual automation
- Developer-only inspection

Server-side exports must continue to work without HWP installed.
