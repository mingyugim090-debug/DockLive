# Skills and Technical Patterns

## Core Stack

| Area | Stack |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11+ |
| AI | OpenAI API via environment-selected models |
| PDF | PyMuPDF |
| Persistence Target | InsForge |
| Temporary Cache | Redis/in-memory fallback |
| Export | HTML fallback, HWPX target |

## OpenAI Usage

Analysis prompts must return structured JSON and distinguish:

- Facts explicitly found in the source
- Reasonable classification inferred from the source
- Missing or uncertain information requiring confirmation

Draft prompts must:

- Use analysis requirements as constraints
- Use user input as source material
- Avoid unsupported claims
- Produce editable section-level drafts
- Return confirmation items before finalization

## HWPX Skill

The `hwpx` skill from `jkf87/hwpx-skill` is the target workflow for Korean document export. It belongs in the global Codex skills folder or the backend deployment image, not inside the LiveDock source tree.

Important workflows:

- Workflow A: Markdown/text/URL to HWPX
- Workflow B: template placeholder replacement
- Workflow F: clone existing HWPX form and replace text while preserving tables/images/styles
- Workflow G: official document writing rules
- Workflow H: HWP to HWPX conversion

LiveDock export rules:

1. HTML export remains a fallback.
2. HWPX export is enabled only when `HWPX_EXPORT_ENABLED=true`.
3. `HWPX_SKILL_DIR` must point to the local skill directory.
4. Every generated HWPX must run namespace fix and validation.
5. Complex uploaded HWPX forms should use clone workflow, not reconstruction.

Recommended local skill path on this machine:

```env
HWPX_SKILL_DIR=C:\Users\alseh\.codex\skills\hwpx
```

Codex may need to be restarted after installing new skills so the skill appears in the active skill list automatically.

## InsForge Pattern

InsForge is the production target for:

- Users and auth
- Uploaded source documents
- Analysis results
- Workflow sessions
- Final documents and generated exports

Do not hard-code InsForge keys. Use `.env.example` as the contract.

## Frontend Pattern

- API calls live in `frontend/lib/api.ts`.
- Shared contracts live in `frontend/lib/types.ts`.
- Components should show loading, error, empty, and retry states.
- Avoid decorative pages that hide the document workflow.

## Backend Pattern

- Pydantic contracts live in `backend/models/schemas.py`.
- Routers own HTTP behavior only.
- Services own parsing, analysis, drafting, storage, and export logic.
- AI output should be validated before returning to frontend.
