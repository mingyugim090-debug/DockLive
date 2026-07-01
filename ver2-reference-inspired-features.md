# Dock Live Ver2 — Reference-Pattern Feature Build Guide

This file translates functional patterns observed in named external services
into original Dock Live specs that Codex and Claude Code can implement. It
extends `ver2-agency-pivot-workflow.md`; read that file first for
phase sequencing, data model, and role rules. This file only adds
feature-level detail sourced from competitive research.

## 0. Read This First — IP And Scraping Guardrail

This file authorizes building Dock Live features that achieve a **similar
outcome** to the referenced services. It does **not** authorize:

- Scraping, crawling, automated fetching, or any programmatic access to the
  referenced services' websites, apps, or APIs.
- Copying source code, markup, CSS, component structure, or file layout
  from a referenced service.
- Copying UI screenshots, layouts, icon sets, or visual "look and feel"
  from a referenced service.
- Copying microcopy, marketing copy, help text, or legal clause wording
  verbatim from a referenced service.
- Using a referenced service's name, logo, or brand identity anywhere in
  Dock Live's product, docs, or marketing.

Only the **behavior** described in the "Observed Pattern" column below may
be reused — what the feature does for the user, not how it looks or how it
is built. Every implementation must be original Dock Live code, copy, and
design, built against the state-spec contracts, not against a reference
product's interface.

If Codex or Claude Code is ever unsure whether something crosses this line,
stop and describe the concern instead of proceeding.

## 1. Reference Pattern Map

| Reference | Observed Pattern | Dock Live Ver2 Equivalent (original spec) | Target Phase |
| --- | --- | --- | --- |
| 조달청 지능형 예정가격 작성지원시스템 | AI extracts key facts from past notice documents and surfaces recent similar programs so staff don't manually search prior files. | **Prior-Notice Recall**: given new notice inputs, retrieve and summarize the org's own past notices with similar program type/budget range as reference material. | Phase 2 |
| 행안부·과기정통부 범정부 AI 공통기반 | Internal-network-safe AI infrastructure where agencies can use an approved AI model without exposing data to the open internet. | **Provider abstraction layer**: keep the AI provider configurable per organization instead of hardcoded, so an org's "approved model only" constraint can be honored later without a rewrite. This is an infra note, not a user-facing feature — do not build actual closed-network deployment tooling yet (see `ver2-agency-pivot-workflow.md` Section 3). | Cross-cutting (Phase 1 infra decision) |
| Iternal.ai-style RFI/RFP automation | Structured Q&A input → AI assembles a draft from a modular clause library → automated compliance check before the document is considered publish-ready. | **Notice-Authoring Agent with clause library**: structured input (purpose/budget/period/eligibility) → section draft assembly pulling from an org-defined clause library → mandatory-clause compliance checklist gate before a notice can move to `under_review`. | Phase 2 |
| GovDash/Civio-style requirement traceability and review cycle | Every generated clause is clickable back to the input/requirement that produced it; multi-stage review cycle before submission. | **Section-level source trace + staged review**: every generated notice section links to the input field(s) or prior-notice reference that grounded it; approval flow (담당자 → 팀장 → 기관장) shows inline source trace plus a comment thread per version. | Phase 3 |

## 2. Implementation Rule For Codex

- Treat the "Dock Live Ver2 Equivalent" column as the actual spec. Do not
  attempt to fetch, screenshot, or emulate the referenced product's real
  interface at any point during implementation.
- Build test fixtures the same way existing harness fixtures are built:
  synthesized data, not data pulled from any referenced service or real
  agency document. See `docs/product/iris-mvp-phases.md` for the existing
  precedent (compact synthesized fixtures, no raw source documents
  committed).
- If a task needs "typical wording" for a mandatory clause (e.g. 공정경쟁
  문구, 개인정보 처리방침 문구), draft original wording that serves the same
  *function* as the clause, and mark it `confirmation_required` until an
  agency user supplies or approves the actual legal text. Never present
  drafted legal/administrative language as final without confirmation —
  this follows the existing `contracts.agency_notice.forbidden` rule in
  `harness/state-spec.yaml` once that delta lands.

## 3. Feature Specs

### 3.1 Prior-Notice Recall

- Input: the organization's own previously published notices (uploaded or
  already stored through the existing ingestion layer) — never notices
  scraped from another agency's site or a third-party tool.
- Output: a ranked list of the org's past notices with a short summary of
  program type, budget band, and period, surfaced while a new notice is
  being drafted.
- Backend: extend the existing PDF/HWPX ingestion layer; add an
  embedding-based similarity search scoped to `organization_id`.
- Gate: `agent` profile plus a new fixture pair (two synthesized notices
  from the same fictional org, one clearly similar and one clearly not).

### 3.2 Notice-Authoring Agent — Clause Library

- New data model: `clause_library` entries with `clause_type`,
  `required_for_program_types`, `template_text` (placeholder wording,
  editable per org), and `source` (`org_default` or `agency_supplied`).
- Compliance gate: before a `notice_draft` can move from `draft` to
  `under_review`, validate that every `clause_type` required for its
  program type is either present or explicitly `confirmation_required`.
- This extends, not replaces, the Phase 2 section-draft flow already
  described in `ver2-agency-pivot-workflow.md`.
- Gate: `backend` profile plus a contract test asserting the gate blocks a
  notice missing a required clause type.

### 3.3 Section-Level Source Trace

- Data model: link each generated `draft_section`/clause to the specific
  `input_field(s)` or prior-notice reference that grounded it.
- Frontend: clicking or hovering a generated section reveals its source
  (which input, or which prior notice, produced it).
- Gate: `frontend` profile plus a component test for the trace interaction.

### 3.4 Staged Review With Inline Trace

- Builds on the approval state machine already specified in
  `ver2-agency-pivot-workflow.md` Phase 3. This entry only adds the
  requirement that the reviewer UI show source trace (3.3) alongside
  reviewer comments, so a 팀장/기관장 can see both "what changed" and "why"
  in one view.
- Gate: `full` profile once both 3.3 and the approval state machine exist.

## 4. Kickoff

Generate a Codex-to-Claude Code handoff scoped to one feature spec at a
time — do not hand off multiple rows from Section 1 in a single task.

```powershell
python tools\harness\create_handoff.py --task "Implement Ver2 Prior-Notice Recall per ver2-reference-inspired-features.md section 3.1"
.\scripts\handoff-to-claude.ps1 -Task "Implement Ver2 Prior-Notice Recall per ver2-reference-inspired-features.md section 3.1"
```

Swap the task string for 3.2, 3.3, or 3.4 as each prior spec lands and is
gated green.

## 5. Out Of Scope

- Any scraping, crawling, or automated access to a referenced third-party
  product (Section 0).
- Any verbatim reuse of a referenced product's code, UI, or copy
  (Section 0).
- Use of a referenced product's name or branding in Dock Live (Section 0).
- Presenting AI-drafted legal/administrative clause text as final without
  `confirmation_required` (Section 2).
- Building real closed-network/internal-agency-network deployment tooling
  from the "범정부 AI 공통기반" row — that row is an infra abstraction note
  only, not a Ver2 deliverable (see `ver2-agency-pivot-workflow.md`
  Section 3 for the standing non-goal).
