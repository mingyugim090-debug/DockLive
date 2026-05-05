---
name: livedock-hwpx-intake
description: Use when a user provides a .hwp or .hwpx file to LiveDock and wants it analyzed, filled, edited, cloned, or used as a template for a new HWPX document. Classifies the request and extracts template structure before generation.
---

# LiveDock HWPX Intake

This is the first step for uploaded HWP/HWPX forms.

## Inputs

- User request text.
- Uploaded `.hwpx`, or `.hwp` that must first be converted.
- Optional user data already collected by the frontend/workflow.

## Decision Tree

1. If input is `.hwp`, convert to `.hwpx` before further processing:

```powershell
python "$env:HWPX_SKILL_DIR\scripts\convert_hwp.py" input.hwp output.hwpx
```

2. If input is `.hwpx`, analyze structure:

```powershell
$env:PYTHONIOENCODING="utf-8"
python "$env:HWPX_SKILL_DIR\scripts\clone_form.py" --analyze input.hwpx
python "$env:HWPX_SKILL_DIR\scripts\clone_form.py" input.hwpx --auto-analyze template_context.json
```

3. Classify request:

| Request | request_type | workflow |
| --- | --- | --- |
| Fill this form / write into this template | `fill_form` | F |
| Edit wording in this document | `edit_document` | C or F |
| Create a new document with this structure | `create_new` | F if table/image exists, otherwise A |

Force Workflow F when the source has tables or images.

## Output Contract

Return context for the content step:

```json
{
  "request_type": "fill_form",
  "recommended_workflow": "F",
  "hwpx_path": "input.hwpx",
  "structure_summary": {
    "table_count": 0,
    "image_count": 0,
    "text_nodes": [],
    "empty_cells": [],
    "section_labels": []
  },
  "placeholders_found": []
}
```

## Rules

- Do not generate content during intake.
- Do not skip structure analysis.
- Do not rely only on `{{placeholder}}`; many Korean forms use blank table cells.
- If `text_extract.py` is unavailable because `python-hwpx` is missing, use ZIP/XML inspection or `clone_form.py --analyze`.
