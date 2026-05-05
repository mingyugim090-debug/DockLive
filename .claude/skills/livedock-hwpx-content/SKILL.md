---
name: livedock-hwpx-content
description: Use after LiveDock HWPX intake to generate structured JSON for form fields, table cells, replacements, keywords, section drafts, and confirmation_required items using the configured AI provider.
---

# LiveDock HWPX Content

Use this after `livedock-hwpx-intake`.

## Role

Generate content and mapping JSON only. Do not create files here.

Gemma/OpenAI should produce:

- `replacements`: exact source XML/text fragments mapped to replacement XML/text.
- `keywords`: safe fallback text replacements inside `<hp:t>` nodes.
- `section_content`: draft content by logical section.
- `confirmation_required`: claims or missing facts the user must verify.

## Prompt Rules

Tell the model:

- Use the uploaded template structure and user input.
- Keep the original form's tone and purpose.
- Do not invent deadlines, eligibility, amounts, organization names, or submission methods.
- Mark uncertain facts in `confirmation_required`.
- Return JSON only.

## Output Contract

```json
{
  "replacements": {
    "source text or exact XML fragment": "replacement text or XML fragment"
  },
  "keywords": {
    "2026 년     월     일": "2026년 5월 5일"
  },
  "section_content": {
    "활동계획서": "..."
  },
  "confirmation_required": []
}
```

## Blank Cell Rule

When a form has empty cells, prefer backend-assisted cell mapping:

1. Analyze table/cell positions.
2. Replace only the empty cell's existing run with `<hp:t>value</hp:t>`.
3. Preserve table, paragraph, run, and style counts whenever possible.

The soccer-club test follows this pattern through `backend/tests/manual_hwpx_soccer_application.py`.

## User Confirmation Gate

If `confirmation_required` is not empty, pause export until the user confirms or supplies missing information.
