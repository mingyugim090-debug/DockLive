---
name: livedock-input-collect
description: Use after livedock-announce-analyze to collect only the missing user-specific information needed for accurate section-level drafting.
---

# LiveDock Input Collect

분석 결과와 사용자 프로필을 비교해 초안 작성에 꼭 필요한 정보만 묻는 단계입니다.

## Inputs

- `workflow_session_id`
- `AnalysisResult.document_template`
- `AnalysisResult.uncertain_fields`
- optional `MatchReport.missing_inputs`
- optional `CompanyProfile`

## Minimum Question Rule

Ask only for information that:

- cannot be derived from the announcement, and
- is not already present in the user profile, and
- is needed by at least one draft section.

Do not ask the user for deadlines, eligibility, evaluation criteria, benefits, required documents, or submission methods already found in the announcement.

## Common Fields

| Need | Backend field |
|---|---|
| applicant/team/company name | `applicant_name` |
| applicant/team/company profile | `applicant_profile` |
| project or idea summary | `project_summary` |
| proof, metrics, awards, portfolio | `evidence` |
| section-specific details | `section_input_<section_id>` |

## API

```http
POST /api/workflow/{workflow_session_id}/inputs
Content-Type: application/json
```

```json
{
  "inputs": [
    {"field_id": "applicant_name", "value": "LiveDock"},
    {"field_id": "project_summary", "value": "공고 분석과 제출 문서 자동화 서비스"}
  ]
}
```

## User-Facing Prompt Style

Keep questions grouped and contextual:

```text
초안 작성을 위해 아래 정보만 추가로 필요합니다.

1. 신청자/팀/회사명
2. 프로젝트 핵심 요약
3. 초안에 근거로 넣을 성과나 자료
```

## Next Step

When required inputs are present, call `livedock-section-draft`.
