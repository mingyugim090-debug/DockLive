# Inline Agent Integrity Gate Design

## Goal

Add an automatic post-save integrity gate for the local Inline Agent so Excel and
HWPX results are checked before the user treats them as completed files.

## Scope

- Add local validation helpers for `.xlsx`, `.xlsm`, `.hwpx`, and `.hwp` output
  paths.
- Validate Excel results for loadability, sheet preservation when a source file
  exists, merged cell preservation, formula preservation outside authored cells,
  and leftover `{{placeholder}}` markers.
- Validate HWPX results for ZIP/mimetype correctness, XML well-formedness, and
  leftover `{{placeholder}}` markers.
- Expose validation through a new local agent tool named `validate_document`.
- Run validation automatically after `save_workbook`,
  `compose_hwpx_form`, and `export_hwpx_session`.
- Keep HWP/HWPX authoring on the existing backend compose/session pipeline.

## Non-Goals

- Do not add HwpCtrl COM production tooling.
- Do not add native HWPX chart objects.
- Do not infer or invent document values during validation.
- Do not rewrite completed HWPX XML during validation.

## Data Flow

1. The Agent writes or exports a completed file.
2. The save/export tool calls the local integrity validator with the original
   source path when available.
3. The tool response includes `validation_summary` with pass/fail checks and
   warnings.
4. The frontend can surface the summary from existing streamed tool events.

## Risk Controls

- Validation is read-only.
- Unsupported files return a warning result instead of generated content.
- If validation itself fails unexpectedly, the completed file remains saved and
  the warning is included in the tool response.
