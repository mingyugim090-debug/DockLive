# LiveDock Agent Guide

## Product Direction

LiveDock is a document automation AI service for public notices such as competitions, government announcements, grants, scholarships, research programs, and startup support programs.

The current priority is the **Agent MVP**, not the community product. Community features are a long-term expansion and must not distract from the document automation workflow unless explicitly requested.

The highest-priority workflow is:

1. Collect or receive an announcement document from PDF, URL, pasted text, or demo fixture.
2. Analyze the announcement and extract key requirements with source evidence.
3. Identify required user-provided materials.
4. Ask only for missing information needed to draft accurately.
5. Generate section-level drafts.
6. Ask the user to confirm or revise important claims.
7. Complete the final application/submission document.
8. Export to editable formats, with HWPX as the target Korean document format.

The long-term direction is a student-focused community for discovering and participating in competitions and public opportunities. Defer feed, team recruiting, profile, recommendation, and community features until the Agent MVP is reliable.

## Project Structure

- `frontend`: Next.js 14, React, Tailwind, TypeScript.
- `backend`: FastAPI, parsing, OpenAI analysis/drafting, workflow APIs, export APIs.
- `docs`: product plans, architecture, Agent harness, evals, development docs, and project assets.
- Root deployment/config files include `render.yaml`.

Avoid touching generated or dependency directories:

- `frontend/node_modules`
- `frontend/.next`
- `backend/venv`
- `__pycache__`

## Development Rules

- Read the existing implementation before changing code.
- Prefer existing project patterns over new abstractions.
- Keep changes scoped to the requested feature or bug.
- Do not edit `.env` or `.env.local` unless explicitly requested.
- When adding environment variables, update `.env.example`.
- Preserve user work and do not revert unrelated changes.
- Use structured schemas and parsers for document data whenever practical.
- Treat Korean copy, prompts, and labels carefully.
- If a file contains mojibake or broken Korean text, repair the touched area instead of spreading it.

## Agent MVP Principles

Announcement analysis should extract, when available:

- Title and source
- Hosting or managing organization
- Program/category type
- Application period and deadlines
- Eligibility requirements
- Required and optional documents
- File format requirements
- Submission method
- Evaluation criteria
- Benefits, prize, grant amount, or support details
- Required application form sections
- Important cautions or disqualification rules
- Uncertain fields requiring confirmation
- Source evidence for important extracted facts

Do not silently invent critical facts such as deadlines, eligibility, budget amounts, organization names, required files, or submission methods. If the source document is ambiguous, mark the field as uncertain and ask for confirmation.

Draft generation must be staged:

1. Use the announcement analysis as constraints.
2. Use only user-provided information and extracted facts as source material.
3. Generate drafts by section, not as one opaque final blob.
4. Preserve `confirmation_required` for claims that need user review.
5. Require user confirmation before finalizing submission-ready content.

## HWPX Export Principles

HWPX is the target final Korean document format. Follow the installed `hwpx` skill and the `jkf87/hwpx-skill` workflow:

- HWPX is a ZIP package with XML parts.
- Run namespace fixing after every generated HWPX.
- Validate the generated HWPX before treating it as ready.
- If a user provides a `.hwp`, convert it to `.hwpx` before further processing.
- If a user provides a complex `.hwpx` form, prefer form cloning/replacement over rebuilding XML from scratch.
- Preserve tables, images, styles, and run structure when filling official forms.

HTML export is a fallback for editable text. It is not a substitute for verified HWPX export.

## Frontend Guidelines

- Build the actual document workflow, not a marketing landing page.
- Prioritize upload, analysis results, checklists, input collection, drafts, confirmation, and export.
- Keep UI dense enough for repeated document work while friendly for students.
- Make mobile and desktop layouts usable.
- Use existing Tailwind and component conventions.
- Prioritize clarity, progress state, error recovery, and next actions.

## Backend Guidelines

- Keep API behavior explicit and typed with Pydantic schemas.
- Keep parsing, analysis, drafting, storage, and export concerns separated.
- Prefer deterministic post-processing for AI outputs.
- Validate AI JSON before returning it to the frontend.
- Store enough metadata for users to resume analysis and drafting.
- Handle large files, unsupported formats, parse failures, OpenAI failures, and HWPX export failures with clear errors.

## Verification

When frontend code changes, run from `frontend` when feasible:

```bash
npm run build
```

When backend code changes, run a relevant import/startup/schema validation check.

When API contracts change, update both backend schemas and frontend types.

When document parsing, AI analysis, prompt behavior, or HWPX export changes, test with representative public notice fixtures and summarize observed output.
