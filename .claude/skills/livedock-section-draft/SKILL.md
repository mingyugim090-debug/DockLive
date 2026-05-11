---
name: livedock-section-draft
description: Use after required inputs are collected to generate section-level application drafts with confirmation_required markers.
---

# LiveDock Section Draft

지원서 전체를 한 번에 만들지 않고, 공고의 작성 항목별로 초안을 생성하는 단계입니다.

## Preconditions

- `workflow_session_id` exists.
- Analysis is stored in the workflow.
- Required user inputs are filled.

## API

Batch:

```http
POST /api/workflow/{workflow_session_id}/draft
```

Streaming:

```http
GET /api/workflow/{workflow_session_id}/draft/stream
```

Streaming events:

| event | meaning |
|---|---|
| `section_start` | section generation started |
| `delta` | incremental token chunk from OpenAI streaming |
| `section_done` | section completed |
| `workflow_done` | all sections completed |
| `error` | generation failed |

## Draft Rules

- Use only `AnalysisResult`, `user_inputs`, and reviewed `draft_sections`.
- Preserve `confirmation_required`.
- Never invent eligibility, deadlines, grant amounts, organization names, or submission methods.
- If a claim needs evidence, add it to `confirmation_required`.
- Do not export until the user reviews important claims.

## Confirmation Gate

Before export:

1. collect all section-level `confirmation_required` items,
2. show them to the user,
3. ask for confirmation or corrected information,
4. only then call finalize/export.

## Next Step

- No official form: `livedock-export-html`
- HWPX/HWP official form: `livedock-hwpx-intake` -> `livedock-hwpx-content` -> `livedock-hwpx-export` -> `livedock-hwpx-validate`
