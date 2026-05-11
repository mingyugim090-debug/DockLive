---
name: livedock-hwpx-content
description: Use after LiveDock HWPX intake to generate structured JSON for form fields, replacements, keywords, section content, and confirmation_required items.
---

# LiveDock HWPX Content

HWPX 파일을 직접 생성하지 않습니다. 이 단계는 양식에 채울 내용과 매핑 JSON만 만듭니다.

## Output Contract

```json
{
  "replacements": {
    "source text or exact XML fragment": "replacement text or XML fragment"
  },
  "keywords": {
    "existing placeholder text": "replacement text"
  },
  "section_content": {
    "지원 동기": "reviewed section draft"
  },
  "confirmation_required": []
}
```

## When Section Drafts Already Exist

If `livedock-section-draft` already produced reviewed sections, pass them directly as `section_content`. Do not rewrite them from scratch. The model should only map content into the HWPX form.

## Rules

- Preserve the original form's table, paragraph, run, image, and style structure.
- Prefer backend-assisted cell mapping for blank table cells.
- Do not invent personal data, dates, amounts, eligibility, organization names, or signatures.
- Put missing or uncertain facts into `confirmation_required`.
- Return JSON only.

## Blank Cell Mapping

For empty cells:

1. identify the table cell position,
2. replace only that cell's text run,
3. keep surrounding XML structure intact,
4. validate with `livedock-hwpx-validate`.

## Confirmation Gate

If `confirmation_required` is not empty, pause export until the user confirms or supplies corrected information.
