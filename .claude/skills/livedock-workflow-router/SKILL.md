---
name: livedock-workflow-router
description: Use at the start of any LiveDock document automation task. Classifies whether the user provided an announcement, HWP/HWPX form, both, or draft text, then routes to the correct LiveDock skill chain.
---

# LiveDock Workflow Router

LiveDock의 시작점 디스패처입니다. 어떤 입력을 받았는지 먼저 판단하고, 중간 단계를 건너뛰지 않도록 올바른 skill chain을 선택합니다.

## Input Types

| Provided | Type |
|---|---|
| PDF, URL, pasted text with 공고/모집/지원사업 content | `announcement` |
| `.hwpx` or `.hwp` form file | `hwpx_form` |
| Announcement plus official form file | `both` |
| Already-written draft text only | `draft_only` |

## Routes

### A. Announcement Only

```text
livedock-announce-analyze
  -> livedock-input-collect
    -> livedock-section-draft
      -> livedock-export-html
```

### B. Announcement + HWPX/HWP Template

```text
livedock-announce-analyze
  -> livedock-input-collect
    -> livedock-section-draft
      -> livedock-hwpx-intake
        -> livedock-hwpx-content
          -> livedock-hwpx-export
            -> livedock-hwpx-validate
```

If the form is `.hwp`, convert it to `.hwpx` first through the backend HWP conversion path.

### C. HWPX/HWP Form Only

```text
livedock-hwpx-intake
  -> livedock-hwpx-content
    -> livedock-hwpx-export
      -> livedock-hwpx-validate
```

### D. Draft Text Only

```text
livedock-section-draft
  -> livedock-export-html
```

Use the HWPX route if the user also provides an official form.

## Clarifying Question

If the input is ambiguous, ask one concise question:

```text
어떤 작업을 원하시나요?

1. 공고문을 분석하고 지원서 초안을 작성
2. 업로드한 HWPX/HWP 양식을 채우기
3. 공고문 분석 후 공식 양식에 자동 입력
```

## Rules

- Do not skip analysis before drafting unless the user already provided a reviewed analysis.
- Do not export before section-level draft review and confirmation.
- Do not use `livedock-hwp-mcp-local` in server, CI, or cloud deployment contexts.
- HWPX is the target Korean editable export. HTML is fallback only.
