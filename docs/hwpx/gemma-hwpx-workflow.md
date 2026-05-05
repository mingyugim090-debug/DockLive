# Gemma 4 and HWPX Workflow

## Responsibility Split

LiveDock does not ask the model to directly write `.hwpx` ZIP/XML files.

- Gemma 4 analyzes announcements, drafts section content, and returns structured JSON.
- The FastAPI backend validates model JSON with Pydantic contracts.
- The HWPX exporter creates, fixes, validates, and returns the actual `.hwpx` file.
- `hwp-mcp` is an internal Windows development aid, not the production export path.

## Runtime Flow

1. A user uploads a PDF, URL, pasted text, or demo fixture.
2. The configured AI provider extracts requirements and evidence.
3. The backend creates a workflow session with required input fields.
4. The configured AI provider generates section-level drafts from extracted facts and user inputs.
5. The user confirms important claims.
6. The backend finalizes Markdown content.
7. The HWPX toolchain converts or clones a `.hwpx` package.
8. The backend runs namespace fixing and validation before returning the file.

## Model Providers

Use `AI_PROVIDER` to choose the hosted model provider:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
OPENAI_DRAFT_MODEL=gpt-4o-mini
```

```env
AI_PROVIDER=gemma
GEMINI_API_KEY=...
GEMMA_ANALYSIS_MODEL=gemma-4-26b-a4b-it
GEMMA_DRAFT_MODEL=gemma-4-31b-it
```

The public workflow API should not change when switching providers.

## HWPX Export Rules

- Keep `HWPX_EXPORT_ENABLED=false` unless the hwpx skill/toolchain is installed.
- Set `HWPX_SKILL_DIR` to the installed skill directory before enabling export.
- Use Markdown-to-HWPX for ordinary generated documents.
- Use template clone/replacement for uploaded official `.hwpx` forms.
- Always run `fix_namespaces.py` and `validate.py` before treating an export as ready.

## hwp-mcp Rule

`hwp-mcp` depends on Windows and a locally installed Hangul Word Processor application.
Use it only for internal local verification or `.hwp`-specific automation. The production
service should continue to generate verified HWPX packages through the XML/ZIP toolchain.
