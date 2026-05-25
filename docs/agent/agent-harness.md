# Agent Harness

Dock Live의 하네스는 Agent에게 "잘해줘"라고 부탁하는 대신, 잘할 수밖에 없는 구조를 제공합니다.

## Operating Model

| 역할 | 책임 |
| --- | --- |
| Human | 제품 판단, 우선순위 결정, 최종 승인 |
| Codex | 구현, 검증 실행, 오류 registry 관리 |
| Claude Code | 큰 코드 변경 협업, Codex 검증을 통과할 산출물 제공 |
| QA Prompt/Gemini | 기능 명세를 테스트와 fixture로 바꾸는 test-first 역할 |

## Harness Layers

1. Context Layer: `AGENTS.md`와 `harness/state-spec.yaml`이 제품 목적, 금지 사항, API 경계를 고정합니다.
2. Tooling Layer: `tools/harness/run_harness.py`와 `scripts/harness.ps1`이 같은 품질 게이트를 로컬/CI에서 실행합니다.
3. Sandbox Execution Layer: 실행별 raw log는 `harness/runs/`에 저장하고 git에는 올리지 않습니다.
4. Eval Layer: backend contracts, deterministic fixture E2E, frontend build, optional HWPX eval을 profile로 묶습니다.
5. Error Memory Loop: 실패 fingerprint를 `harness/errors/registry.json`에 기록해 같은 오류가 반복될 때 이전 원인과 해결책을 보여줍니다.

## Quality Gates

```powershell
.\scripts\harness.ps1 -Profile quick
.\scripts\harness.ps1 -Profile backend
.\scripts\harness.ps1 -Profile agent
.\scripts\harness.ps1 -Profile frontend
.\scripts\harness.ps1 -Profile full
.\scripts\harness.ps1 -Profile hwpx
```

Profiles are documented in `harness/quality-gates.yaml`.

## Analysis Contract

The Analysis Agent must return grounded values for:

- `doc_type`
- `title`
- `organization`
- `summary`
- `timeline`
- `checklist`
- `document_sections`
- `eligibility`
- `submission_method`
- `evaluation_criteria`
- `benefits`
- `cautions`
- `uncertain_fields`
- `evidence_quotes`
- `source_evidence`

Failure conditions:

- Invented deadline
- Invented organization
- Required document not in source but marked required
- Missing uncertainty for ambiguous source text
- Evidence quote not present in the source
- Invalid JSON

## Draft Contract

The Draft Agent must:

- Use only analysis output and user inputs.
- Draft by section.
- Preserve `confirmation_required`.
- Avoid submission-ready finalization before user confirmation.

Failure conditions:

- Unsupported claims about eligibility, budget, award, deadline, or submission method
- Whole document generated without section review
- No confirmation warning despite uncertain fields

## HWPX Harness

HWPX export must follow:

1. Generate or clone HWPX.
2. Run namespace fix.
3. Run validation.
4. Extract text to confirm expected content when possible.

If using an uploaded official form:

- Analyze form first.
- Clone and replace text.
- Preserve tables/images/styles.

## Error Memory

List active failures:

```powershell
python tools\harness\error_memory.py list
```

Resolve a known failure after adding a guard:

```powershell
python tools\harness\error_memory.py resolve --id ERR-... --fix-summary "..." --guard-test "..."
```

Codex should check this registry before repeating a fix. Claude Code output should be considered unverified until the relevant harness profile passes.
