# LiveDock Agent Guide

## Product Direction

LiveDock is a document automation AI service for public notices such as competitions, government announcements, grants, scholarships, research programs, and startup support programs.

The highest-priority product workflow is:

1. Collect or receive an announcement document.
2. Analyze the document and extract key requirements.
3. Identify required user-provided materials.
4. Generate a structured draft.
5. Ask the user to confirm or revise important content.
6. Complete the final application or submission document.

The long-term direction is to grow into a student-focused community for discovering and participating in competitions and public opportunities. Do not let community features distract from the current core automation workflow unless explicitly requested.

## Project Structure

- `frontend`: Next.js 14, React, Tailwind, TypeScript.
- `backend`: FastAPI, document parsing, OpenAI analysis, storage, workflow APIs.
- `files`: sample files and document-related assets.
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
- When adding environment variables, update the relevant `.env.example`.
- Do not perform broad refactors unless they are needed for the requested task.
- Preserve user work and do not revert unrelated changes.
- Use structured schemas and parsers for document data whenever practical.
- Treat Korean product copy, prompts, and labels carefully.
- If a file already contains mojibake or broken Korean text, avoid spreading it. When touching that area, repair the affected text if the intended meaning is clear.

## Core Workflow Principles

Announcement analysis should extract, when available:

- Announcement title
- Hosting or managing organization
- Program/category type
- Application period and deadlines
- Eligibility requirements
- Required documents
- Optional documents
- File format requirements
- Submission method
- Evaluation criteria
- Benefits, prize, grant amount, or support details
- Required application form sections
- Important cautions or disqualification rules

Draft generation should be staged:

1. Analyze the announcement.
2. Build a checklist of required inputs from the user.
3. Ask only for missing information that is needed to draft accurately.
4. Generate section-level drafts.
5. Request user confirmation before producing final application content.
6. Keep final output traceable to the announcement requirements.

Do not silently invent critical facts such as deadlines, eligibility, budget amounts, organization names, required files, or submission methods. If the source document is ambiguous, mark the field as uncertain and ask for confirmation.

## Frontend Guidelines

- Build the actual user workflow, not a marketing landing page, unless requested.
- Prioritize a clear operational interface for upload, analysis results, checklists, drafts, confirmation, and final documents.
- Keep UI dense enough for repeated document work while still friendly for students.
- Make mobile and desktop layouts usable.
- Use existing Tailwind and component conventions.
- Avoid decorative UI that hides the document workflow.
- For document automation screens, prioritize clarity, progress state, error recovery, and next actions.

## Backend Guidelines

- Keep API behavior explicit and typed with Pydantic schemas.
- Keep parsing, analysis, drafting, and storage concerns separated.
- Add new routers/services only when there is a clear boundary.
- Prefer deterministic post-processing for AI outputs.
- Validate AI JSON before returning it to the frontend.
- Store enough metadata for users to resume analysis and drafting.
- Handle large files, unsupported formats, parse failures, and OpenAI/API failures with clear errors.

## AI Prompting Guidelines

Prompts should produce structured outputs that can be validated. Prefer JSON contracts for analysis and workflow state.

Prompts for announcement analysis should distinguish between:

- Facts explicitly found in the document
- Reasonable classifications inferred from the document
- Missing or uncertain information that requires user confirmation

Prompts for drafting should:

- Use the announcement requirements as constraints.
- Use user-provided information as source material.
- Avoid unsupported claims.
- Produce editable drafts by section.
- Ask for confirmation before finalizing important claims or submission-ready documents.

## Verification

When frontend code changes, run from `frontend` when feasible:

```bash
npm run build
```

When backend code changes, run a relevant import, startup, or API validation check when feasible.

When API contracts change, update both backend schemas and frontend API/types together.

When document parsing, AI analysis, or prompt behavior changes, test with a representative public notice PDF or mock fixture and summarize the observed output.

## Current Priorities

Near-term work should focus on:

1. Reliable PDF announcement analysis.
2. HWP/HWPX support or conversion strategy.
3. Announcement URL ingestion and crawling.
4. Required document checklist generation.
5. User input collection workflow.
6. Draft generation by application section.
7. User confirmation and revision loop.
8. Final document generation/export.

Defer large community features until the core document automation workflow is reliable.
