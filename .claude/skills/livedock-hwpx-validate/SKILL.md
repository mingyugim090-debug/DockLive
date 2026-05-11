---
name: livedock-hwpx-validate
description: Use after any LiveDock HWPX generation, conversion, clone, or edit. Runs namespace fixing, structural validation, source/result verification, and content checks before returning a file.
---

# LiveDock HWPX Validate

Every generated or edited HWPX must pass this quality gate.

## Required Sequence

For generated HWPX:

```powershell
python "$env:HWPX_SKILL_DIR\scripts\fix_namespaces.py" output.hwpx
python "$env:HWPX_SKILL_DIR\scripts\validate.py" output.hwpx
```

For cloned templates:

```powershell
python "$env:HWPX_SKILL_DIR\scripts\verify_hwpx.py" `
  --source source.hwpx `
  --result output.hwpx `
  --json verify_report.json
```

For HWP conversion:

```powershell
python "$env:HWPX_SKILL_DIR\scripts\convert_hwp.py" input.hwp -o output.hwpx
python "$env:HWPX_SKILL_DIR\scripts\fix_namespaces.py" output.hwpx
python "$env:HWPX_SKILL_DIR\scripts\validate.py" output.hwpx
```

## PASS Criteria

- `validate.py` exits successfully.
- Required ZIP entries exist.
- XML is well-formed.
- `mimetype` is first and uncompressed.
- For cloned templates, table/image counts do not decrease.
- Expected inserted text is present.

## Fallback Text Check

If `text_extract.py` fails because `python-hwpx` is unavailable, inspect the HWPX ZIP directly:

```python
import zipfile
with zipfile.ZipFile("output.hwpx") as z:
    section = z.read("Contents/section0.xml").decode("utf-8")
    assert "expected text" in section
```

## Failure Policy

- Do not return HWPX files before validation passes.
- If validation fails twice, stop and report the failing stage.
- Offer HTML export as an editable fallback when HWPX cannot be validated.
