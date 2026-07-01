# Dock Live Ver2 — Agency Notice-Authoring & Approval Workflow

This file is the entry point for Codex and Claude Code when working on the
Ver2 pivot. Read this before touching code for any Ver2 task. It extends,
and does not replace, `AGENTS.md`, `harness/state-spec.yaml`,
`harness/roles/codex.md`, and `harness/roles/claude-code.md`.

## 0. Why This File Exists

Ver1 (`livedock-agent-mvp`) drafts submission documents for applicants
(companies, universities, research teams) responding to a notice. Ver2 flips
the user: the primary actor becomes the **agency staff member who authors
and publishes** a government R&D / support-program notice, not the applicant
who responds to one.

This is a product pivot, not a feature add. Treat Ver1's applicant-facing
workflow as a separate, still-maintained track. Do not remove or degrade it
while building Ver2.

## 1. Pivot Summary

| | Ver1 (keep as-is) | Ver2 (new track) |
| --- | --- | --- |
| Primary user | Applicant (company/university/researcher) | Agency staff (담당자 → 팀장 → 기관장) |
| Core input | Existing notice + applicant facts | Program purpose, budget, period, eligibility rules + prior-year notices |
| Core output | Submission draft sections | Notice draft sections, ready to publish |
| Differentiator | Grounded drafting, confirmation gates | Internal approval workflow, version history, audit trail |
| Grounding rule | No invented deadlines/org/support facts from the notice | No invented legal basis, budget figures, or mandatory clauses not present in program guidelines |

Ver2 reuses, unchanged in spirit:

- Ingestion layer (PDF/URL/HWP/HWPX) — now used to load prior-year notices
  as reference instead of the notice-under-response.
- HWPX toolchain (clone/replace/validate) — notices are HWPX-templated
  documents too.
- `confirmation_required` / `uncertain_fields` pattern — reused for
  mandatory-clause and legal-basis checks instead of applicant-fact checks.

Ver2 adds, net new:

- Organization/role/approval-chain data model.
- A notice-authoring agent flow (structured input → notice sections),
  the mirror image of Ver1's analysis → draft flow.
- An approval state machine layered on top of the existing workflow state
  machine (draft → reviewed → revision-requested → approving → approved →
  published).

## 2. Constraints Carried Over From Ver1

- Do not invent facts. For Ver2 this means: no invented legal basis
  citations, budget ceilings, eligibility rules, or mandatory boilerplate
  clauses (개인정보 처리방침, 공정경쟁 문구, 이의신청 절차 등) unless they come
  from a source document or are explicitly confirmed by the agency user.
  Anything else goes into `confirmation_required`.
- Backend owns parsing, AI provider calls, workflow state, export.
  Frontend owns upload/review/input/export UI. Do not blur this boundary.
- HWPX rules from `harness/state-spec.yaml` (`hwpx_rules`) apply unchanged:
  clone-and-replace for official forms, namespace fix + validate + text
  extraction before returning a file.
- Community/feed/team-recruiting/social features stay out of scope. This
  file does not change that.

## 3. New Constraints For Ver2

- No live integration with 나라장터 / 기업마당 / IRIS publishing APIs in
  this phase. Target output is a clean, copy/paste-ready or downloadable
  notice document. Treat live publishing integration as a separate,
  future-dated initiative.
- No SSO/실명인증 or government-issued identity integration in this phase.
  Org/role modeling should be self-serve (an org admin invites members) so
  the workflow can be demoed and dogfooded before any procurement or
  identity-integration conversation happens.
- Assume the product stays a cloud SaaS for this phase. Do not build
  on-prem/폐쇄망 deployment tooling yet — but do not add anything that
  actively prevents it later (e.g. do not hardcode cross-tenant data access;
  keep org data isolated by `organization_id` from the first migration).
- Every new table added for Ver2 must carry `organization_id` and standard
  timestamps/audit columns. This is non-negotiable given the eventual
  security/compliance conversation for B2G.

## 4. Phase Plan

### Phase 1 — Organization & Approval Data Model
Status: planned

- Add InsForge/Postgres migrations for `organizations`, `organization_members`
  (role: `staff` / `lead` / `approver`), `notice_drafts`, `notice_versions`,
  `approval_steps`, `approval_comments`.
- Add role-aware auth (org-scoped session, not just individual login).
- Extend `harness/state-spec.yaml` with an `agency_pivot` contract block
  (see Section 5) before writing backend code against it.
- Gate: `backend` profile must pass; add contract tests for the new tables
  under `backend/tests/contracts`.

### Phase 2 — Notice-Authoring Agent
Status: planned

- New input contract: program purpose, budget, period, eligibility rules,
  evaluation criteria, plus optional prior-year notice upload for style/
  structure reference.
- New output contract: notice sections (사업개요, 지원내용, 신청자격,
  제출서류, 평가기준, 일정, 문의처) using the same section-draft +
  `confirmation_required` pattern as Ver1, but grounded against program
  guidelines/legal basis instead of an existing notice.
- Add a mandatory-clause checklist step: flag standard clauses that must
  appear (법적 근거, 개인정보 처리방침, 공정경쟁 문구, 이의신청 절차) and mark
  any clause not traceable to a source document as `confirmation_required`.
- Gate: `agent` profile, extended with new fixture(s) for notice-authoring
  (add under `docs/evaluation/fixtures`, do not commit real internal
  agency documents — synthesize a fixture the same way `iris-mvp-phases.md`
  fixtures were built).

### Phase 3 — Approval & Audit Workflow
Status: planned

- Layer approval state onto the existing workflow state machine: `draft` →
  `under_review` → `revision_requested` → `approving` → `approved` →
  `published`.
- Version diff between notice revisions, comment threads tied to a
  version, and an audit trail (who changed what, when, at which approval
  step).
- Frontend: single-screen view of current state, reviewer comments, and
  version history — this is the primary "wow" surface per the product
  decision to prioritize workflow automation over polish-only UX.
- Gate: `full` profile (backend + agent + frontend) plus new frontend
  tests for the approval-state UI.

### Phase 4 — Publish-Ready Output
Status: planned, lower priority than Phases 1-3

- Export formatting tuned for direct posting to common government
  publishing surfaces (formatting only, not live API integration — see
  Section 3).
- Re-evaluate live-integration feasibility only after Phases 1-3 are
  validated with at least one real or realistic agency workflow.

## 5. State-Spec Delta Checklist (apply during Phase 1)

Before backend work starts, `harness/state-spec.yaml` should gain:

- `product.priority`: add `agency_notice_authoring` and
  `approval_workflow_state` as tracked priorities without removing the
  existing applicant-facing priorities.
- A new `contracts.agency_notice` block mirroring `contracts.analysis_result`
  / `contracts.draft`, with its own `must_include` and `forbidden` lists
  (forbidden: invented legal basis, invented budget ceilings, invented
  mandatory clauses).
- A new `contracts.approval_workflow` block: `must` include preserving
  version history, blocking `published` state without `approved`, and
  keeping comments tied to a specific version.
- `non_goals`: keep the existing list; do not add agency features here,
  add them only if a decision is made to explicitly defer something (e.g.
  `live_publishing_platform_integration_for_v2`,
  `government_identity_provider_integration_for_v2`).

Do not implement backend logic against contracts that only exist in this
workflow file. Land them in `state-spec.yaml` first so Codex's context
loading and Claude Code's handoffs stay accurate.

## 6. Codex Role For This Initiative

In addition to `harness/roles/codex.md`:

- Before any Phase 1-4 task, confirm whether the relevant `state-spec.yaml`
  delta from Section 5 already landed. If not, that is the task — land the
  spec delta before implementation code.
- Keep Ver1 and Ver2 contracts clearly separated in `state-spec.yaml`
  (`analysis_result`/`draft` vs `agency_notice`/`approval_workflow`). Do not
  merge them into one shared contract to save space.
- New fixtures for notice-authoring must be synthesized, not copied from
  a real agency's internal documents, same rule as existing IRIS fixtures.
- Run `agent` and `backend` gates for Phase 1-2 work; add `frontend` for
  Phase 3 UI; use `full` once Phase 3 approval UI exists.

## 7. Claude Code Role For This Initiative

In addition to `harness/roles/claude-code.md`, when a handoff references
this file:

- Read this file in full before the handoff's other required context.
- Treat Section 3 (new constraints) as hard boundaries, not suggestions —
  do not add live publishing/identity integration even if it looks like a
  natural next step mid-task.
- If a task touches both Ver1 and Ver2 contracts, flag that explicitly in
  the return notes; that likely means the task is scoped too broadly and
  should be split.

## 8. Kickoff Sequence

1. Human/Codex reviews this file and confirms Phase 1 is next.
2. Codex lands the Section 5 state-spec delta as its own small change,
   gated by nothing but a spec review (no backend code yet).
3. Codex generates a Claude Code handoff for the Phase 1 migration +
   org-scoped auth work:
   ```powershell
   python tools\harness\create_handoff.py --task "Implement Ver2 Phase 1: organizations/members/approval schema and org-scoped auth, per ver2-agency-pivot-workflow.md"
   .\scripts\handoff-to-claude.ps1 -Task "Implement Ver2 Phase 1: organizations/members/approval schema and org-scoped auth, per ver2-agency-pivot-workflow.md"
   ```
4. Claude Code implements against the handoff, returns changed files,
   commands run, and open questions using the format in
   `harness/roles/claude-code.md`.
5. Codex runs the `backend` gate, records any repeat failures in
   `harness/errors/registry.json`, and only then opens Phase 2.
6. Repeat steps 3-5 per phase. Do not start Phase 3 UI work before Phase 1
   auth/schema is gated green — the approval UI has nothing real to show
   without it.

## 9. Out Of Scope For This Workflow File

- Live 나라장터/기업마당/IRIS publishing integration (Section 3).
- Government identity provider / SSO integration (Section 3).
- On-prem or 폐쇄망 deployment tooling.
- Any change to Ver1's applicant-facing contracts, fixtures, or UI beyond
  what is strictly required to add org-scoping without breaking them.
- Community/feed/team-recruiting/social features (unchanged from
  `AGENTS.md`).
