---
name: livedock-hwpx-validate
description: Use after any LiveDock HWPX generation or edit. Runs namespace fixing, structural validation, source/result verification, and content checks before the file can be returned to a user.
---

# LiveDock HWPX Validate

Run after every HWPX generation/edit. No exceptions.

## Required Sequence

```powershell
$env:PYTHONIOENCODING="utf-8"
python "$env:HWPX_SKILL_DIR\scripts\fix_namespaces.py" output.hwpx
python "$env:HWPX_SKILL_DIR\scripts\validate.py" output.hwpx
```

For cloned or edited templates:

```powershell
python "$env:HWPX_SKILL_DIR\scripts\verify_hwpx.py" `
  --source source.hwpx `
  --result output.hwpx `
  --json verify_report.json
```

## PASS Criteria

- `validate.py` exits successfully.
- XML errors are zero.
- For cloned templates, table/image/run counts must not decrease.
- `section0.xml` size must not collapse below safe thresholds.
- Expected inserted text is present in `Contents/section0.xml`.

## Fallback Text Check

If `text_extract.py` fails because `python-hwpx` is unavailable, inspect the HWPX ZIP directly:

```python
import zipfile
with zipfile.ZipFile("output.hwpx") as z:
    section = z.read("Contents/section0.xml").decode("utf-8")
    assert "expected text" in section
```

## Rules

- Do not return files to users before validation passes.
- Save `verify_report.json` for debugging and audit.
- If validation fails twice, stop and report the failing stage.
