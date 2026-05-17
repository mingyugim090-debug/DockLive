---
name: livedock-hwp-mcp-local
description: Use only for optional local Windows HWP automation or rendering checks with hwp-mcp. Never use this as LiveDock's production export path, server dependency, or CI dependency.
---

# LiveDock HWP MCP Local

This is an optional local helper for Windows machines with Hancom HWP installed.

## When To Use

Use only after user confirmation when:

- The source is `.hwp` only and cannot be handled by the HWPX ZIP/XML path.
- A validated `.hwpx` needs visual rendering confirmation in the local HWP app.
- A developer needs to inspect a local form manually.

## Do Not Use For

- Production FastAPI export.
- Render/Vercel/InsForge deployment paths.
- CI checks.
- User-facing backend dependencies.

## Local MCP Server

Repository path:

```text
tools/hwp-mcp/hwp_mcp_stdio_server.py
```

Expected local command:

```powershell
tools\hwp-mcp\.venv\Scripts\python.exe tools\hwp-mcp\hwp_mcp_stdio_server.py
```

## Tool Pattern

Use batch operations for multiple edits:

```text
hwp_open(file_path)
hwp_batch_operations([
  {"find": "찾을 텍스트", "replace": "바꿀 텍스트"}
])
hwp_save(output_path)
```

## Rules

- Verify Windows and HWP installation before use.
- Avoid overwriting source files.
- Prefer HWPX clone/export plus validation for LiveDock product behavior.
