---
name: livedock-announce-analyze
description: Use when a user provides a public announcement as PDF, HWPX, HWP, URL, or pasted text and wants it analyzed into a LiveDock AnalysisResult.
---

# LiveDock Announce Analyze

공고문을 구조화된 `AnalysisResult`로 바꾸는 첫 단계입니다.

## Supported Inputs

- PDF 공고문
- HWPX 공고문
- HWP 공고문: backend가 HWPX 변환을 먼저 시도
- 공고 URL
- 붙여넣은 공고 텍스트

## API Routing

| Input type | Endpoint | Method |
|---|---|---|
| PDF/HWPX/HWP file | `/api/analyze` | POST multipart/form-data |
| URL | `/api/analyze/url` | POST JSON |
| Pasted text | `/api/analyze/text` | POST JSON |

## Required Output Fields

The backend must return:

- title and source
- hosting/managing organization
- doc_type
- timeline and deadlines
- eligibility
- required/optional documents
- file format requirements
- submission method
- evaluation criteria
- benefits/prize/grant/support details
- application form sections
- cautions or disqualification rules
- uncertain_fields
- source_evidence

## Presentation Rules

Always surface these to the user first:

1. `uncertain_fields`
2. `timeline`
3. required `checklist`
4. `eligibility`
5. `source_evidence` for critical facts

## Guardrails

- Do not invent deadlines, eligibility, amounts, organization names, required files, or submission methods.
- If a field is ambiguous, mark it in `uncertain_fields`.
- If OCR is required, explain that the current parser could not extract text and ask for text/OCR output.
- Save the returned analysis id as `workflow_session_id` for drafting.

## Next Step

After analysis, call `livedock-input-collect` with the returned `workflow_session_id`.
