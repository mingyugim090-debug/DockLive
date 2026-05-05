---
name: livedock-agent-mvp
description: Use when developing LiveDock's Agent MVP document automation workflow, especially announcement analysis, missing-input collection, section drafting, confirmation gates, and export APIs. Keeps work focused on document automation rather than community features.
---

# LiveDock Agent MVP

Use this skill for LiveDock product/backend/frontend work that touches the document automation workflow.

## Product Priority

Build the Agent MVP first:

1. Receive an announcement from PDF, URL, pasted text, demo fixture, or uploaded form.
2. Extract requirements with source evidence.
3. Identify only the missing user-provided information needed for accurate drafting.
4. Generate section-level drafts.
5. Ask the user to confirm important or uncertain claims.
6. Finalize the submission document.
7. Export to editable formats, with HWPX as the Korean target format.

Do not prioritize community/feed/team/profile/recommendation features unless the user explicitly asks.

## Backend Contracts

- Keep schemas explicit in `backend/models/schemas.py`.
- Keep AI output validated before returning to the frontend.
- Do not let models invent deadlines, eligibility, amounts, organizations, required files, or submission methods.
- Preserve `confirmation_required` until the user confirms important claims.
- Keep parsing, AI, workflow state, storage, and export concerns separated.

## Provider Rule

Gemma/OpenAI are content and JSON generation providers. They do not directly create `.hwpx` files.

Runtime split:

```text
AI provider -> structured JSON / draft markdown
backend services -> validation, workflow state, export orchestration
hwpx scripts -> actual HWPX ZIP/XML creation, namespace fixing, validation
hwp-mcp -> optional local Windows-only rendering aid
```

## Verification

- Backend changes: run import/schema/contract checks.
- Frontend changes: run `npm run build` from `frontend` when feasible.
- HWPX changes: run namespace fix, `validate.py`, and source/result `verify_hwpx.py`.
