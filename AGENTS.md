---
description: Dock Live agent harness and repository operating rules
globs: *
alwaysApply: true
---

# Dock Live Agent Harness

Dock Live is an Agent MVP for notice ingestion, grounded analysis, section-by-section drafting, user confirmation, and HWPX export. Treat this repository structure as part of the prompt: follow the existing boundaries before adding new ones.

## Product Priority

1. Reliable HWP/HWPX/PDF/URL/text ingestion
2. Strictly grounded announcement analysis
3. User input collection for missing facts
4. Section-level draft generation with confirmation gates
5. HTML/HWPX export validation
6. Persistence through InsForge when storage/auth work is in scope

Do not start community, feed, team recruiting, or social features unless the user explicitly asks for them.

## Collaboration Roles

- Codex is the implementation and verification driver: inspect the repo, make scoped changes, run harness gates, and record repeat errors.
- Claude Code is the broad implementation collaborator: when Claude changes code, Codex should verify with the same harness gates before accepting the result.
- Gemini-style QA prompts are treated as test-first harness input: convert them into tests, fixtures, or quality gates instead of production behavior.
- Humans make final product judgments; agents must expose uncertainty, failures, and verification results.

## Hermes-Inspired Operating Philosophy

- Context is an operating surface, not background prose. Before work starts, agents read the state spec, durable memory, role file, and active error registry.
- Memory is bounded and intentional. Use `harness/memory/` for durable product/development facts, `harness/errors/registry.json` for recurring failures, and `harness/runs/` for disposable raw logs.
- Tool access follows role boundaries. Codex owns verification and error-memory updates; Claude Code owns broad implementation only after receiving a handoff with scope, constraints, and gates.
- Delegation happens through explicit handoffs, not vague prompts. Use `tools/harness/create_handoff.py` when passing Codex work to Claude Code.
- Every agent output remains untrusted until the relevant harness gate passes or the failure is recorded with a clear next step.

## Context Layer

Before changing code:

1. Read the relevant files and the nearest README/docs.
2. Read `harness/state-spec.yaml` for product invariants.
3. Read the relevant role file in `harness/roles/`.
4. Check `harness/memory/PROJECT_MEMORY.md` and `harness/memory/USER_WORKFLOW.md` for durable context.
5. Check `harness/errors/registry.json` for active recurring failures.
6. Keep backend, frontend, docs, tools, and harness responsibilities separate.
7. If touching InsForge SDK or infrastructure code, first consult `docs/engineering/insforge.md`.

## Implementation Rules

- Never invent facts from source documents. Missing document facts must remain `unspecified`, `no_information`, `uncertain_fields`, or confirmation-required items.
- Keep API contract changes synchronized across `backend/models/schemas.py`, `frontend/lib/types.ts`, and client code.
- Preserve HWPX structure whenever working with official forms. Prefer clone/replace workflows for complex templates.
- Avoid moving app code unless a task explicitly calls for a refactor. New support tooling belongs in `tools/` or `harness/`.
- Do not commit runtime outputs, logs, local env files, or generated caches.

## Verification Layer

Use the harness runner from the repository root:

```powershell
.\scripts\harness.ps1 -Profile quick
```

Quality gates:

- `quick`: compile Python, run harness self-tests, run backend contract tests.
- `backend`: backend compile and backend contracts.
- `agent`: deterministic fixture E2E eval.
- `frontend`: Next.js production build.
- `full`: backend, agent, and frontend gates.
- `hwpx`: deterministic fixture E2E with HWPX validation.

If a command fails, the harness records a fingerprint in `harness/errors/registry.json` and stores the raw run log under ignored `harness/runs/`.

## HWPX Rules

- HWPX is a ZIP/XML package.
- HWP input must be converted or parsed before analysis.
- After HWPX generation, run namespace fix and validation when the toolchain is available.
- Verify extracted text for expected title/content before treating export as ready.
- Do not directly rewrite XML runs in ways that destroy table, image, or style structure.

## Commit-Ready Checklist

- [ ] Scope stays within Agent MVP or the user's explicit request.
- [ ] No new unsupported factual claims are introduced.
- [ ] API schemas and frontend types still match.
- [ ] User-visible errors are clear.
- [ ] Relevant harness profile was run.
- [ ] New recurring failures are recorded or resolved in the error registry.
- [ ] If another agent continues the work, a handoff was generated or updated.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **DockLive** (API base `https://trgf5yzm.ap-southeast.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->
