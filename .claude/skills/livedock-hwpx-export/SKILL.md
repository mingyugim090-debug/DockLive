---
name: livedock-hwpx-export
description: Use when LiveDock needs to create or edit an actual HWPX file from finalized workflow content, uploaded templates, replacements, or keywords. Routes file generation through backend export services and hwpx scripts.
---

# LiveDock HWPX Export

This step creates the actual `.hwpx` file.

## Preferred Product Path

Use backend services instead of ad hoc shell scripts when working inside LiveDock:

- Markdown/new document export: `backend/services/drafting_service.py::export_markdown_to_hwpx`
- Uploaded template clone/fill: `backend/services/drafting_service.py::clone_hwpx_template`
- Default replacement map: `backend/services/drafting_service.py::build_template_replacements`

## Workflow F: Template Clone

Use this for uploaded forms with tables/images or official structure:

```powershell
$env:PYTHONIOENCODING="utf-8"
python "$env:HWPX_SKILL_DIR\scripts\clone_form.py" source.hwpx output.hwpx `
  --map replacements.json `
  --keywords keywords.json `
  --title "문서 제목" `
  --creator "LiveDock Agent" `
  --validate
```

Then run `livedock-hwpx-validate`.

## Workflow A: Markdown/New HWPX

Use only when no source form must be preserved.

Preferred backend call:

```python
export_markdown_to_hwpx(final_markdown, title)
```

For fragile official forms, do not rebuild `section0.xml` from scratch.

## Rules

- Do not make the AI provider write ZIP/XML directly.
- Preserve source form structure for user-uploaded templates.
- Use `clone_form.py` or the backend wrapper for table-heavy forms.
- Set subprocess output encoding to UTF-8 on Windows.
