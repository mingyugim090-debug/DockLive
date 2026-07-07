# Live Excel And HWPX Agent Design

Date: 2026-07-07

## Purpose

Build DockLive's core Inline-AI-style document agent experience: a user uploads
their working files, writes a natural-language request, chooses an output
folder, and watches the agent create or fill an Excel workbook or HWPX document
with grounded content, tables, charts, and graphs.

The feature must feel like a document worker, not a download generator. Excel
work should open in the user's local Excel window and update live. HWPX work
should show an in-app live HWPX page/session as fields are filled, then save and
open a validated HWPX result locally when available. The system must preserve
DockLive's grounding rule: source data can be reorganized, summarized, and
visualized, but missing facts are never invented.

## Current State

The repository already has most of the raw pieces:

- `frontend/components/projects/ProjectWorkspace.tsx` provides a multi-file
  document workspace with upload, analysis, blueprint, document generation,
  inline block transforms, export, and Excel artifact actions.
- `frontend/components/projects/LocalAgentPanel.tsx` connects the web UI to a
  local WebSocket agent at `ws://127.0.0.1:8765/ws`.
- `docklive-inline-agent/src/agent/loop.py` runs an OpenAI tool-calling loop.
- `docklive-inline-agent/src/tools/excel_tools.py` can open Excel visibly,
  read/write ranges, apply formulas, format cells, insert rows, create charts,
  save, and close workbooks.
- `docklive-inline-agent/src/tools/hwpx_tools.py` can call the DockLive backend
  HWPX compose pipeline and save a validated completed HWPX file locally.
- `backend/routers/hwpx.py` exposes HWPX form sessions, draft-all, component
  addition, export, compose, HWP conversion, and PDF conversion routes.
- `backend/services/blueprint_service.py`, `block_transforms.py`, and
  `workspace_export.py` already create document blocks, tables, chart previews,
  and safe table fallbacks.
- `backend/services/excel_artifacts.py` can generate deterministic XLSX
  dashboards with source references and charts, then open/sync them through the
  desktop helper.

The missing product layer is not another file parser. The missing layer is a
single user-facing run model that routes one request to the right live executor,
keeps state visible without exposing tool noise, and makes HWPX feel as direct
as Excel while still using the validated HWPX pipeline.

## Product Principles

- Ask the user for only three things in the primary flow: source files, request,
  and output folder.
- Prefer automatic target selection. Manual Excel/HWPX choice is available only
  as an advanced override.
- Keep the user's files local when using the desktop agent. Upload only files
  the backend must parse or compose.
- Ground every table, chart, graph, and generated value in uploaded files or
  confirmed user input.
- Show a calm current state, not raw tool-call chatter. Raw logs stay behind a
  details disclosure.
- Preserve HWPX package validity. HWPX output must run namespace fix and
  validation before it is treated as ready.
- Preserve user work. Excel files get backups before editing; HWPX exports are
  saved as new completed files instead of overwriting source forms.

## Recommended Approach

Use a unified agent run workflow that orchestrates the existing local Excel
agent and backend HWPX session/export pipeline.

The primary UI becomes:

1. Add source files.
2. Write one request.
3. Choose output folder.
4. Run agent.
5. Review live progress and confirmation items.
6. Open or export the completed result.

The workflow should infer the target:

- `.xlsx`, `.xlsm`, `.xls`, or a request mentioning workbook, sheet, formula,
  pivot, dashboard, chart, or Excel routes to Excel.
- `.hwp`, `.hwpx`, or a request mentioning HWPX, official form, application
  form, Korean word processor, or HWP routes to HWPX.
- Mixed file sets route by requested output. If no output is clear, default to
  HWPX report generation when a document source is primary and Excel dashboard
  generation when a spreadsheet source is primary.

This design keeps the system realistic for Windows desktop users today. Direct
Hancom COM control remains a separate future product decision and is not needed
for the first complete version of this workflow.

## Alternatives Considered

### Direct Hancom COM Editing

Directly open HWP/HWPX in the installed Hancom application and manipulate it via
COM, similar to the Excel automation path.

Pros:

- Best visual match to the phrase "real-time HWPX editing."
- Users can see the official editor window update.

Cons:

- Requires Hancom installation and local COM stability.
- Hard to test in CI.
- Can break HWPX structure if used as the primary composition path.
- Conflicts with the current project memory decision that local HWPX authoring
  should use DockLive's backend compose/validate pipeline unless the product
  explicitly changes direction.

Decision: not the primary v1 path. If the product chooses direct Hancom
control, it should be added as another executor behind the same
`UnifiedAgentRun` interface.

### Server-Only Export

Generate Excel and HWPX files on the backend and let users download them.

Pros:

- Easiest to deploy.
- Strongest CI testability.

Cons:

- Does not satisfy the live local-document-agent experience.
- Makes Excel and HWPX feel like static artifacts rather than a working agent.

Decision: insufficient for this goal.

### Unified Local Agent With Validated HWPX Sessions

Let the local agent own run orchestration. Excel opens and updates through COM.
HWPX opens as an in-app live session, fills fields through backend session APIs,
exports with validation, saves locally, and opens the resulting file when the
desktop environment can do so.

Pros:

- Matches the user workflow with minimal inputs.
- Reuses existing tested boundaries.
- Gives HWPX a live authoring surface without fragile direct XML editing.
- Keeps official form safety and validation intact.

Cons:

- HWPX live editing is in DockLive's page/session view, not direct Hancom window
  editing in v1.
- Native HWPX chart objects remain out of scope until table/image fallback is
  stable.

Decision: recommended.

## User Workflow

### Empty State

The user sees one compact work surface:

- Upload area: "Drop PDF, CSV, XLSX, HWPX, HWP, DOCX, or TXT files."
- Request box: a natural-language instruction.
- Output folder box: a local path such as `C:\Users\...\Documents\DockLive`.
- Run button: "Run Agent".

No separate step labels are required for normal users. Step progress can appear
as quiet state chips after execution starts.

### During Execution

The center of the screen shows the active artifact:

- Excel: workbook name, active sheet, recently written ranges, chart names, and
  an "Opened in Excel" state.
- HWPX: rendered page/session preview, detected fields or regions, generated
  field status, validation state, and completed file path when exported.

The right side shows only:

- current action
- confirmation-required items
- warnings
- completed file path
- details disclosure for raw tool events

### Completion

The final state shows:

- completed result file path
- validation summary
- open result action
- sync state for Excel
- warnings that affect final submission

If a run fails, the original file remains intact and the UI shows a recovery
action such as "retry from backup" for Excel or "retry HWPX export" for HWPX.

## Data Model

Add a run-level model shared by frontend, backend contracts where needed, and
local agent payloads.

```text
UnifiedAgentRun
  id
  mode: auto | excel | hwpx
  status: idle | preparing | running | needs_input | completed | failed
  request_text
  output_dir
  source_files[]
  target_file
  result_file
  active_executor: excel | hwpx_session | hwpx_compose
  current_action
  events[]
  confirmation_required[]
  warnings[]
  validation_summary
```

For v1, this model lives in frontend state and local agent payloads without a
new persisted database table. Backend persistence is a separate requirement only
when run history must sync across devices.

## Local Agent Contract

Extend the WebSocket payload accepted by
`docklive-inline-agent/src/server.py`:

```json
{
  "mode": "auto",
  "request": "Create a budget dashboard and fill the application form.",
  "file": "C:\\work\\template.xlsx",
  "source_files": ["C:\\work\\notice.pdf", "C:\\work\\budget.csv"],
  "output_dir": "C:\\work\\completed",
  "open_result": true
}
```

The server builds an agent request with:

- explicit mode decision rules
- primary target file
- source context excerpts
- output folder instruction
- safety rules for source-grounded values

The WebSocket streams normalized events:

```text
run_started
mode_selected
artifact_opened
tool_call
tool_result
artifact_updated
validation_started
validation_finished
result_saved
needs_input
done
error
```

The frontend maps these events to user-friendly Korean copy. It does not show
full tool arguments by default.

## Excel Execution

Excel remains the most literal live-editing path.

The agent should:

1. Open or create the workbook visibly.
2. Inspect sheets and relevant source ranges.
3. Create missing sheets when the request calls for a new dashboard or summary.
4. Write grounded values from uploaded CSV/XLSX/PDF/HWPX extracted tables.
5. Apply formulas for derived values instead of hardcoding calculations.
6. Format tables with simple professional styling.
7. Create Excel-native charts when numeric source data exists.
8. Save to `output_dir` using a completed filename.
9. Keep the workbook open when `open_result=true`.

The existing tool set covers most of this. The likely extensions are:

- create workbook when no target workbook is provided
- create worksheet
- apply table borders and column autofit
- create chart types beyond the current basic bar/column/line/pie mapping only
  when Excel COM supports them safely
- save result under an explicit output directory

## HWPX Execution

HWPX v1 should be live in the DockLive UI and verified on disk.

The agent should:

1. Create or restore an HWPX form session from the source HWP/HWPX file.
2. Show the rendered pages or extracted region list in the app.
3. Use uploaded source text and tables as `base_input`.
4. Call draft-all or per-region draft APIs.
5. Stream region completion events to the UI.
6. Add table components when the request asks for tables and the source data is
   available.
7. Add graph/chart representations as verified rendered chart images where the
   target template supports safe image insertion, and always include the source
   table fallback. Do not use native HWPX chart XML in v1.
8. Export the session to HWPX.
9. Save the completed HWPX to `output_dir`.
10. Open the completed file locally when the platform can do so.

This avoids direct local HWPX XML writes and keeps the backend validation path
authoritative.

## Tables, Charts, And Graphs

### Source Rules

Tables can be generated from:

- parsed CSV/XLSX sheets
- parsed tables from PDF/HWPX/HWP/DOCX where available
- user-confirmed values typed into the request

Charts and graphs can be generated only when the source table has at least one
label column and one numeric column. If the data is not sufficient, the system
creates a confirmation item instead of inventing values.

### Excel Output

Excel output uses native Excel charts through COM or `openpyxl` generated chart
objects, depending on the path:

- local live run: COM chart creation
- backend artifact generation: `openpyxl` chart creation

### HWPX Output

HWPX v1 uses:

- editable tables for source data
- chart/graph preview in the DockLive UI
- HWPX export fallback table for every chart
- verified rendered chart image insertion for template classes where the HWPX
  image package remains valid, with source table fallback for every chart

Native HWPX chart XML is explicitly forbidden in the v1 contract because the
current `harness/state-spec.yaml` forbids native HWPX chart objects for v1.

## UI Design

The UI should feel like a focused workbench:

- one primary action
- no raw schema terms
- no mandatory multi-step wizard for normal use
- confirmation items separated from logs
- advanced mode for target override and raw event details

Primary labels:

- "Source files"
- "Request"
- "Save to folder"
- "Run Agent"
- "Needs review"
- "Completed file"

The existing `ProjectWorkspace` can be evolved rather than replaced. It should
keep document preview, artifact cards, and upload handling, but move the user
journey toward a single run card.

## Error Handling

- Missing source file: fail before starting and show the exact missing path.
- Unsupported file: keep it in the file list with a warning; do not use it as
  content.
- Excel unavailable: explain that local Excel automation requires Windows and
  Microsoft Excel; offer backend XLSX generation if possible.
- HWPX validation failed: do not mark the file ready; keep the last valid
  snapshot or offer HTML/table fallback.
- Insufficient chart data: create a table and a confirmation item instead of a
  chart.
- Agent loop max iterations: stop, keep partial file, and show the last
  completed action.
- Save failure: preserve generated bytes or workbook state and ask for a
  writable folder.

## Testing Strategy

### Local Agent Tests

- `server._build_request` routes `mode=auto` to Excel for workbook targets.
- `server._build_request` routes `mode=auto` to HWPX for HWP/HWPX targets.
- WebSocket events include `mode_selected`, `result_saved`, and terminal events.
- HWPX tool saves completed output under an explicit output directory.
- Excel tool saves completed output under an explicit output directory.

### Backend Contract Tests

- Workspace file ingestion keeps unsupported files as warnings.
- Blueprint chart plans are created only from numeric source data.
- HWPX session draft-all followed by export returns validation summary.
- Export still falls back from charts to source tables.

### Frontend Tests

- The user can start a run with uploaded files, request text, and output folder.
- Advanced mode can override target to Excel or HWPX.
- The UI shows only compact state by default and raw logs in details.
- Confirmation-required items render separately from errors.
- Completed Excel and HWPX results show saved paths and open actions.

### Harness Gates

- Narrow backend/local-agent changes: `.\scripts\harness.ps1 -Profile quick`
- Frontend changes: `.\scripts\harness.ps1 -Profile frontend`
- Cross-stack integrated changes: `.\scripts\harness.ps1 -Profile full`
- HWPX-specific export changes: `.\scripts\harness.ps1 -Profile hwpx`

## Rollout Plan

### Phase 1: Unified Run Surface

Refactor the project workspace UI so the primary path is upload, request, output
folder, and run. Keep existing analysis, blueprint, export, and artifact panels
available as supporting panels.

### Phase 2: Local Agent Auto Mode

Extend the local agent payload, mode routing, normalized events, output folder
handling, and frontend event display.

### Phase 3: Excel Completion

Add missing Excel tools for creating workbooks/sheets and saving to output
folder. Ensure native charts are created when grounded numeric data exists.

### Phase 4: HWPX Live Session Completion

Use HWPX session APIs from the local agent flow: create session, draft regions,
export, save locally, and open the verified result. Add event streaming that
lets the frontend show live field completion.

### Phase 5: Visuals For HWPX

Use table fallback as the invariant safety layer. Add rendered chart image
insertion after a deterministic fixture proves the HWPX image package remains
valid and extracted text/table content still verifies. A chart request is
complete only when the UI preview, HWPX fallback table, and any inserted chart
image all trace to the same source table.

## Acceptance Criteria

- A user can run the primary workflow with only files, request text, and output
  folder.
- Excel target runs open Excel visibly, write requested structures, create
  tables/charts from source data, and save a completed workbook.
- HWPX target runs show live HWPX session progress, fill regions from source
  data/request text, export a validated HWPX, save it locally, and expose the
  completed path.
- HWPX visual requests produce a live chart/graph preview and export either a
  verified rendered chart image with fallback table or, when image insertion is
  unsafe for the template, an explicit warning plus the fallback table.
- Charts and graphs are never created from invented values.
- Missing facts become confirmation-required items.
- Unsupported files produce warnings, not fabricated content.
- HWPX export failures do not produce a ready-looking broken file.
- Existing API schema changes stay synchronized between backend models,
  frontend types, and callers.
- Relevant harness profiles pass before the feature is considered complete.

## Non-Goals

- Community, feed, recruiting, or social features.
- IRIS login automation or background crawling.
- Native HWPX chart XML in v1.
- Direct Hancom COM editing as the default HWPX path.
- OCR for images unless a separate product decision adds it.
