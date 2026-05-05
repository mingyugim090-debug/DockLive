# LiveDock MCP Notes

MCP is optional for LiveDock v1.

Production document generation must use backend HWPX export services and the HWPX ZIP/XML toolchain.
`hwp-mcp` is a local Windows helper only.

## Local HWP MCP

Example config:

```text
.claude/mcp/hwp-mcp.local.example.json
```

Use it only when the local machine has:

- Windows
- Hancom HWP installed
- `tools/hwp-mcp/.venv` installed
- User approval for local app automation

Do not wire this MCP server into FastAPI production code.
