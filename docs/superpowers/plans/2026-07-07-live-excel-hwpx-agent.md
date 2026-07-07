# Live Excel And HWPX Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified local Agent workflow that lets a user provide source files, a natural language request, and an output folder, then have Dock Live operate Excel workbooks or HWPX sessions in real time, create tables and charts from grounded source data, save the completed result, and show only compact progress by default.

**Architecture:** Frontend collects the minimal run inputs and streams local Agent events. The desktop shell supplies native folder selection. The inline Agent normalizes run payloads, auto-routes Excel vs HWPX, opens or creates live work surfaces, invokes grounded tools, and saves results into the selected output folder. Excel work is performed through the existing xlwings COM helper. HWPX work is performed through Dock Live backend HWPX compose/session/export APIs and validated package output. HWPX v1 visual requests produce live UI chart previews and export either verified rendered visual artifacts with a source table or a clear fallback table/warning when native HWPX charts are unsafe.

**Tech Stack:** Python inline Agent, xlwings Excel tools, FastAPI/WebSocket local server, Dock Live backend HWPX APIs, Next.js/React frontend, Electron desktop IPC, Vitest/Jest frontend tests, Node desktop tests, repository harness profiles.

---

## File Structure

```
docklive-inline-agent/
  src/
    server.py
    executor/dispatcher.py
    tools/excel_tools.py
    tools/hwpx_tools.py
    tools/schemas.py
  tests/
    test_contracts.py
    test_excel_tools.py
    test_hwpx_tools.py
    test_server.py

frontend/
  components/projects/LocalAgentPanel.tsx
  components/projects/ProjectWorkspace.tsx
  components/projects/WorkspacePanels.tsx
  lib/types.ts
  __tests__/local-agent-panel.test.tsx
  __tests__/project-workspace.test.tsx

desktop/
  src/main.cjs
  src/preload.cjs
  tests/desktop-config.test.mjs

backend/
  services/workspace_export.py
  tests/contracts/test_document_workspace_contracts.py

docs/superpowers/specs/2026-07-07-live-excel-hwpx-agent-design.md
harness/state-spec.yaml
harness/errors/registry.json
```

## Implementation Tasks

### Task 1: Normalize Local Agent Run Contract And Auto Routing

- [ ] Add failing inline Agent server tests.

Modify `docklive-inline-agent/tests/test_server.py`:

```python
def test_build_request_auto_routes_excel_and_carries_output_dir():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Create a sales summary chart",
            "file": r"C:\work\sales.csv",
            "source_files": [r"C:\work\sales.csv", r"C:\work\brief.pdf"],
            "output_dir": r"C:\work\done",
            "open_result": True,
        }
    )

    assert built.mode == "excel"
    assert built.request.startswith("[Mode: excel]")
    assert "C:\\work\\done" in built.request
    assert "C:\\work\\sales.csv" in built.context
    assert built.output_dir == r"C:\work\done"
    assert built.open_result is True


def test_build_request_auto_routes_hwpx_from_target_extension():
    built = server._build_request(
        {
            "mode": "auto",
            "request": "Fill the form from the uploaded notice",
            "file": r"C:\work\form.hwpx",
            "source_files": [r"C:\work\notice.pdf"],
            "output_dir": r"C:\work\done",
        }
    )

    assert built.mode == "hwpx"
    assert "Use create_hwpx_session" in built.request
    assert "Use draft_hwpx_session" in built.request
    assert "Use export_hwpx_session" in built.request


def test_build_request_rejects_missing_output_dir():
    with pytest.raises(ValueError, match="output_dir"):
        server._build_request({"mode": "auto", "request": "make report", "file": "x.xlsx"})


def test_websocket_emits_normalized_start_events(monkeypatch, client):
    events = []

    async def fake_run_agent(request, context):
        events.append((request, context))
        yield {"type": "tool_result", "tool": "save_workbook", "result": {"saved_path": "out.xlsx"}}

    monkeypatch.setattr(server, "run_agent", fake_run_agent)

    with client.websocket_connect("/ws/agent") as websocket:
        websocket.send_json(
            {
                "mode": "auto",
                "request": "make workbook",
                "file": r"C:\work\sales.csv",
                "output_dir": r"C:\work\done",
            }
        )
        first = websocket.receive_json()
        second = websocket.receive_json()
        third = websocket.receive_json()

    assert first["type"] == "run_started"
    assert second == {"type": "mode_selected", "mode": "excel"}
    assert third["type"] == "tool_result"
```

Run the failing tests:

```powershell
python -m pytest docklive-inline-agent/tests/test_server.py -q
```

- [ ] Implement the normalized request object and routing.

Modify `docklive-inline-agent/src/server.py`:

```python
from dataclasses import dataclass, field
from pathlib import Path

_EXCEL_SUFFIXES = {".csv", ".tsv", ".xlsx", ".xls", ".xlsm"}
_HWPX_SUFFIXES = {".hwp", ".hwpx"}


@dataclass(frozen=True)
class BuiltAgentRequest:
    mode: str
    request: str
    context: str
    output_dir: str
    target_file: str
    source_files: list[str] = field(default_factory=list)
    open_result: bool = True


def _suffix(path: str) -> str:
    return Path(str(path)).suffix.lower()


def _select_mode(payload: dict) -> str:
    requested = str(payload.get("mode") or "auto").lower()
    if requested in {"excel", "hwpx"}:
        return requested
    if requested != "auto":
        raise ValueError("mode must be auto, excel, or hwpx")

    target = str(payload.get("file") or payload.get("target_file") or "")
    suffixes = [_suffix(target)]
    suffixes.extend(_suffix(path) for path in payload.get("source_files") or [])

    if any(suffix in _HWPX_SUFFIXES for suffix in suffixes):
        return "hwpx"
    return "excel"
```

Replace `_build_request` with a function that returns `BuiltAgentRequest`. Required behavior:

- accept backward-compatible `file` while also supporting `target_file`;
- accept `source_files` as a list of paths;
- require `output_dir` for real runs so completed files do not silently save beside source files;
- include a compact source file list in `context`;
- include the selected mode, target file, output folder, and open-result preference in the agent prompt;
- for Excel mode, instruct the agent to use `open_workbook` when target exists and `create_workbook` when a new workbook is needed, then use `write_range`, `format_range`, `create_chart`, and `save_workbook`;
- for HWPX mode, instruct the agent to use `create_hwpx_session`, `draft_hwpx_session`, and `export_hwpx_session`, and to surface `confirmation_required` without inventing values.

Update the WebSocket handler:

```python
built = _build_request(payload)
await websocket.send_json({"type": "run_started"})
await websocket.send_json({"type": "mode_selected", "mode": built.mode})
async for event in run_agent(built.request, built.context):
    await websocket.send_json(event)
await websocket.send_json({"type": "done"})
```

Convert `ValueError` into a user-visible `{"type": "error", "message": str(exc)}` event.

- [ ] Verify Task 1.

```powershell
python -m pytest docklive-inline-agent/tests/test_server.py -q
```

- [ ] Commit only Task 1 files.

```powershell
git status --short
git add docklive-inline-agent/src/server.py docklive-inline-agent/tests/test_server.py
git commit -m "feat(agent): normalize live document run contract"
```

### Task 2: Add Excel Live Creation, Sheet Management, And Output Save Tools

- [ ] Add failing Excel tool tests.

Modify `docklive-inline-agent/tests/test_excel_tools.py`:

```python
def test_create_workbook_opens_visible_blank_book(monkeypatch):
    fake_app = FakeApp()
    monkeypatch.setattr(excel_tools.xw, "App", lambda visible=True: fake_app)

    result = excel_tools.create_workbook(visible=True)

    assert result["ok"] is True
    assert result["workbook"] == fake_app.books.active.name
    assert fake_app.visible is True


def test_add_sheet_creates_named_sheet(monkeypatch):
    book = open_fake_book(monkeypatch)

    result = excel_tools.add_sheet("Summary")

    assert result == {"ok": True, "sheet": "Summary"}
    assert "Summary" in [sheet.name for sheet in book.sheets]


def test_save_workbook_uses_output_dir_and_safe_filename(tmp_path, monkeypatch):
    open_fake_book(monkeypatch)
    output_dir = tmp_path / "done"

    result = excel_tools.save_workbook(output_dir=str(output_dir), filename="sales:summary.xlsx")

    assert result["ok"] is True
    assert result["saved_path"].endswith("sales_summary.xlsx")
    assert str(output_dir) in result["saved_path"]
```

Extend the fake workbook helpers in the same test file so `books.add()`, `sheets.add(name=...)`, and `book.save(path)` are observable.

Run the failing tests:

```powershell
python -m pytest docklive-inline-agent/tests/test_excel_tools.py -q
```

- [ ] Implement Excel tools.

Modify `docklive-inline-agent/src/tools/excel_tools.py`:

```python
def _safe_filename(name: str, default_name: str) -> str:
    candidate = (name or default_name).strip()
    cleaned = "".join("_" if char in '<>:"/\\|?*' else char for char in candidate)
    return cleaned or default_name


def _resolve_save_path(path: str | None, output_dir: str, filename: str, default_name: str) -> str:
    if path:
        return str(Path(path).expanduser())
    if not output_dir:
        raise ValueError("output_dir is required when path is not provided")
    output = Path(output_dir).expanduser()
    output.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_filename(filename, default_name)
    if Path(safe_name).suffix.lower() not in {".xlsx", ".xlsm", ".xls"}:
        safe_name = f"{Path(safe_name).stem}.xlsx"
    return str(output / safe_name)
```

Add:

```python
def create_workbook(path: str = "", visible: bool = True) -> dict:
    app = xw.App(visible=visible)
    book = app.books.add()
    _set_active_book(book)
    if path:
        book.save(path)
    return {"ok": True, "workbook": book.name, "path": path or ""}


def add_sheet(name: str) -> dict:
    book = _active_book()
    sheet = book.sheets.add(name=name)
    return {"ok": True, "sheet": sheet.name}
```

Update `save_workbook` signature to:

```python
def save_workbook(path: str | None = None, output_dir: str = "", filename: str = "") -> dict:
```

Use `_resolve_save_path` when `output_dir` is provided. Return:

```python
{"ok": True, "saved_path": resolved_path}
```

Keep the current `path` behavior so existing callers continue to work.

- [ ] Register schemas and dispatcher entries.

Modify `docklive-inline-agent/src/tools/schemas.py` to add `create_workbook` and `add_sheet`, and extend `save_workbook` with optional `output_dir` and `filename`.

Modify `docklive-inline-agent/src/executor/dispatcher.py`:

```python
"create_workbook": excel_tools.create_workbook,
"add_sheet": excel_tools.add_sheet,
```

- [ ] Verify Task 2.

```powershell
python -m pytest docklive-inline-agent/tests/test_excel_tools.py docklive-inline-agent/tests/test_contracts.py -q
```

- [ ] Commit only Task 2 files.

```powershell
git status --short
git add docklive-inline-agent/src/tools/excel_tools.py docklive-inline-agent/src/tools/schemas.py docklive-inline-agent/src/executor/dispatcher.py docklive-inline-agent/tests/test_excel_tools.py docklive-inline-agent/tests/test_contracts.py
git commit -m "feat(agent): add live excel creation tools"
```

### Task 3: Add HWPX Session Tools, Output Folder Save, And Open Result

- [ ] Add failing HWPX tool tests.

Modify `docklive-inline-agent/tests/test_hwpx_tools.py`:

```python
def test_compose_hwpx_form_saves_into_output_dir(tmp_path, monkeypatch):
    source = tmp_path / "form.hwpx"
    source.write_bytes(b"source")
    output_dir = tmp_path / "done"
    monkeypatch.setattr(hwpx_tools, "_post_compose_request", fake_compose_response)

    result = hwpx_tools.compose_hwpx_form(
        path=str(source),
        request="Fill the form",
        output_dir=str(output_dir),
        filename="completed.hwpx",
    )

    assert result["ok"] is True
    assert result["saved_path"] == str(output_dir / "completed.hwpx")


def test_compose_hwpx_form_open_result_uses_launcher(tmp_path, monkeypatch):
    source = tmp_path / "form.hwpx"
    source.write_bytes(b"source")
    opened = []
    monkeypatch.setattr(hwpx_tools, "_post_compose_request", fake_compose_response)
    monkeypatch.setattr(hwpx_tools, "_open_path", lambda path: opened.append(path))

    result = hwpx_tools.compose_hwpx_form(
        path=str(source),
        request="Fill",
        output_dir=str(tmp_path),
        open_result=True,
    )

    assert opened == [result["saved_path"]]


def test_hwpx_session_flow_posts_expected_endpoints(tmp_path, monkeypatch):
    source = tmp_path / "form.hwpx"
    source.write_bytes(b"source")
    calls = []

    monkeypatch.setattr(hwpx_tools, "_post_session_request", lambda *args, **kwargs: calls.append("session") or {"session_id": "s1", "title": "Form"})
    monkeypatch.setattr(hwpx_tools, "_post_draft_all_request", lambda *args, **kwargs: calls.append("draft") or {"session_id": "s1", "blocks": [], "confirmation_required": []})
    monkeypatch.setattr(hwpx_tools, "_post_export_session_request", lambda *args, **kwargs: calls.append("export") or fake_export_response())

    session = hwpx_tools.create_hwpx_session(path=str(source))
    draft = hwpx_tools.draft_hwpx_session(session_id=session["session_id"], global_prompt="Use source only")
    export = hwpx_tools.export_hwpx_session(session_id="s1", output_dir=str(tmp_path))

    assert calls == ["session", "draft", "export"]
    assert draft["ok"] is True
    assert export["saved_path"].endswith(".hwpx")
```

Run the failing tests:

```powershell
python -m pytest docklive-inline-agent/tests/test_hwpx_tools.py -q
```

- [ ] Implement HWPX save and launcher helpers.

Modify `docklive-inline-agent/src/tools/hwpx_tools.py`:

```python
def _safe_hwpx_filename(name: str, default_name: str) -> str:
    candidate = (name or default_name).strip()
    cleaned = "".join("_" if char in '<>:"/\\|?*' else char for char in candidate)
    if Path(cleaned).suffix.lower() != ".hwpx":
        cleaned = f"{Path(cleaned).stem or 'completed'}.hwpx"
    return cleaned


def _safe_output_path(source: Path, output_path: str = "", output_dir: str = "", filename: str = "") -> Path:
    if output_path:
        target = Path(output_path).expanduser()
    else:
        directory = Path(output_dir).expanduser() if output_dir else source.parent
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / _safe_hwpx_filename(filename, f"{source.stem}_completed.hwpx")
    if target.suffix.lower() != ".hwpx":
        target = target.with_suffix(".hwpx")
    return target


def _open_path(path: str) -> None:
    os.startfile(path)  # type: ignore[attr-defined]
```

Update `compose_hwpx_form` signature:

```python
def compose_hwpx_form(
    path: str,
    request: str,
    applicant_context: str = "",
    output_path: str = "",
    output_dir: str = "",
    filename: str = "",
    api_url: str = "",
    title: str = "",
    open_result: bool = False,
) -> dict:
```

Save to `_safe_output_path(source_path, output_path, output_dir, filename)` and call `_open_path` only after the file is written and `open_result` is true. Return `ok`, `saved_path`, `warnings`, `verification`, `generated_fields`, and `confirmation_required`.

- [ ] Implement HWPX session API wrappers.

Add helpers to `docklive-inline-agent/src/tools/hwpx_tools.py`:

```python
def _post_session_request(api_url: str, path: Path) -> dict:
    body, content_type = _multipart_body({}, "file", path)
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/sessions",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def _post_draft_all_request(api_url: str, session_id: str, base_input: str, global_prompt: str, overwrite_existing: bool) -> dict:
    data = json.dumps(
        {
            "base_input": base_input,
            "global_prompt": global_prompt,
            "overwrite_existing": overwrite_existing,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/sessions/{urllib.parse.quote(session_id)}/draft-all",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def _post_export_session_request(api_url: str, session_id: str) -> dict:
    request = urllib.request.Request(
        f"{api_url}/api/hwpx/sessions/{urllib.parse.quote(session_id)}/export",
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))
```

Add public tool functions:

```python
def create_hwpx_session(path: str, api_url: str = "") -> dict:
    source = _require_hwpx_source(path)
    payload = _post_session_request(_api_url(api_url), source)
    data = payload.get("data", payload)
    return {"ok": True, "session_id": data.get("id", ""), "session": data}


def draft_hwpx_session(
    session_id: str,
    base_input: str = "",
    global_prompt: str = "",
    overwrite_existing: bool = False,
    api_url: str = "",
) -> dict:
    payload = _post_draft_all_request(_api_url(api_url), session_id, base_input, global_prompt, overwrite_existing)
    data = payload.get("data", payload)
    return {"ok": True, "session_id": data.get("id", session_id), "session": data}


def export_hwpx_session(
    session_id: str,
    output_path: str = "",
    output_dir: str = "",
    filename: str = "",
    api_url: str = "",
    open_result: bool = False,
) -> dict:
    data = _post_export_session_request(_api_url(api_url), session_id)
    encoded = data.get("content") or ""
    if not encoded:
        raise RuntimeError("HWPX export did not include file content")
    exported_filename = filename or data.get("filename") or f"{session_id}.hwpx"
    target = _safe_output_path(Path(exported_filename), output_path, output_dir, exported_filename)
    target.write_bytes(base64.b64decode(encoded))
    if open_result:
        _open_path(str(target))
    return {
        "ok": True,
        "saved_path": str(target),
        "warnings": data.get("warnings", []),
        "verification": data.get("validation_summary", {}),
        "confirmation_required": data.get("confirmation_required", []),
    }
```

- [ ] Register schemas and dispatcher entries.

Modify `docklive-inline-agent/src/tools/schemas.py`:

- extend `compose_hwpx_form` schema with `output_dir`, `filename`, and `open_result`;
- add `create_hwpx_session`;
- add `draft_hwpx_session`;
- add `export_hwpx_session`.

Modify `docklive-inline-agent/src/executor/dispatcher.py`:

```python
"create_hwpx_session": hwpx_tools.create_hwpx_session,
"draft_hwpx_session": hwpx_tools.draft_hwpx_session,
"export_hwpx_session": hwpx_tools.export_hwpx_session,
```

- [ ] Verify Task 3.

```powershell
python -m pytest docklive-inline-agent/tests/test_hwpx_tools.py docklive-inline-agent/tests/test_contracts.py -q
```

- [ ] Commit only Task 3 files.

```powershell
git status --short
git add docklive-inline-agent/src/tools/hwpx_tools.py docklive-inline-agent/src/tools/schemas.py docklive-inline-agent/src/executor/dispatcher.py docklive-inline-agent/tests/test_hwpx_tools.py docklive-inline-agent/tests/test_contracts.py
git commit -m "feat(agent): add live hwpx session tools"
```

### Task 4: Build The Minimal Unified Agent UI

- [ ] Add failing frontend tests for the new run workflow.

Modify `frontend/__tests__/local-agent-panel.test.tsx`:

```tsx
it("sends auto mode, source files, output folder, and open result preference", async () => {
  const sent: unknown[] = []
  mockWebSocket(send => {
    sent.push(JSON.parse(send as string))
  })

  render(
    <LocalAgentPanel
      sourceFiles={[{ name: "sales.csv", path: "C:\\work\\sales.csv" }]}
      defaultTargetFile="C:\\work\\sales.csv"
    />,
  )

  await userEvent.type(screen.getByLabelText("요청사항"), "매출 요약 차트를 만들어줘")
  await userEvent.type(screen.getByLabelText("저장 폴더"), "C:\\work\\done")
  await userEvent.click(screen.getByRole("button", { name: "Agent 실행" }))

  expect(sent[0]).toMatchObject({
    mode: "auto",
    request: "매출 요약 차트를 만들어줘",
    file: "C:\\work\\sales.csv",
    source_files: ["C:\\work\\sales.csv"],
    output_dir: "C:\\work\\done",
    open_result: true,
  })
})


it("renders compact progress and saved path from streamed events", async () => {
  const socket = mockWebSocket()
  render(<LocalAgentPanel />)

  act(() => socket.emit({ type: "run_started" }))
  act(() => socket.emit({ type: "mode_selected", mode: "hwpx" }))
  act(() => socket.emit({ type: "tool_result", tool: "export_hwpx_session", result: { saved_path: "C:\\done\\report.hwpx" } }))
  act(() => socket.emit({ type: "done" }))

  expect(screen.getByText("HWPX 문서 작성 중")).toBeInTheDocument()
  expect(screen.getByText("C:\\done\\report.hwpx")).toBeInTheDocument()
})
```

Run the failing test:

```powershell
npm test -- frontend/__tests__/local-agent-panel.test.tsx
```

- [ ] Implement `LocalAgentPanel` unified inputs.

Modify `frontend/components/projects/LocalAgentPanel.tsx`:

- default `mode` to `"auto"`;
- replace the mode-first tab flow with a compact mode segmented control where `"auto"` is selected by default;
- show inputs for target file, output folder, request, and optional source files;
- accept props:

```ts
type LocalSourceFile = {
  name: string
  path?: string
  id?: string
}

type LocalAgentPanelProps = {
  sourceFiles?: LocalSourceFile[]
  defaultTargetFile?: string
}
```

- build WebSocket payload:

```ts
const payload = {
  mode,
  request: request.trim(),
  file: targetFile.trim(),
  source_files: sourcePaths,
  output_dir: outputDir.trim(),
  open_result: true,
}
```

- block run only when request, target file, or output folder is empty;
- render default progress as compact Korean labels:
  - `run_started`: `Agent 준비 중`
  - `mode_selected/excel`: `Excel 문서 작성 중`
  - `mode_selected/hwpx`: `HWPX 문서 작성 중`
  - `tool_result` with saved path: `완성본 저장됨`
  - `error`: `확인 필요`
- keep raw event JSON inside a collapsed `<details>` region so advanced logs remain available without crowding the workflow.

- [ ] Add type support.

Modify `frontend/lib/types.ts`:

```ts
export type LocalAgentMode = "auto" | "excel" | "hwpx"

export type LocalAgentRunEvent =
  | { type: "run_started" }
  | { type: "mode_selected"; mode: "excel" | "hwpx" }
  | { type: "tool_result"; tool?: string; result?: Record<string, unknown> }
  | { type: "error"; message: string }
  | { type: "done" }
```

Use this type in `LocalAgentPanel`.

- [ ] Verify Task 4.

```powershell
npm test -- frontend/__tests__/local-agent-panel.test.tsx
```

- [ ] Commit only Task 4 files.

```powershell
git status --short
git add frontend/components/projects/LocalAgentPanel.tsx frontend/lib/types.ts frontend/__tests__/local-agent-panel.test.tsx
git commit -m "feat(frontend): unify live document agent panel"
```

### Task 5: Add Desktop Output Folder Picker

- [ ] Add failing desktop tests.

Modify `desktop/tests/desktop-config.test.mjs`:

```js
test("main process registers output folder picker ipc", () => {
  const mainSource = readFileSync(new URL("../src/main.cjs", import.meta.url), "utf8")
  assert.match(mainSource, /ipcMain\.handle\(["']livedock:select-output-folder["']/)
  assert.match(mainSource, /dialog\.showOpenDialog/)
  assert.match(mainSource, /openDirectory/)
})


test("preload exposes selectOutputFolder", () => {
  const preloadSource = readFileSync(new URL("../src/preload.cjs", import.meta.url), "utf8")
  assert.match(preloadSource, /selectOutputFolder/)
  assert.match(preloadSource, /ipcRenderer\.invoke\(["']livedock:select-output-folder["']\)/)
})
```

Run the failing test:

```powershell
node --test desktop/tests/desktop-config.test.mjs
```

- [ ] Implement IPC in desktop main and preload.

Modify `desktop/src/main.cjs`:

```js
const { app, BrowserWindow, dialog, ipcMain } = require("electron")

ipcMain.handle("livedock:select-output-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})
```

Modify `desktop/src/preload.cjs`:

```js
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("livedockDesktop", {
  isDesktop: true,
  platform: process.platform,
  selectOutputFolder: () => ipcRenderer.invoke("livedock:select-output-folder"),
})
```

Modify `frontend/components/projects/LocalAgentPanel.tsx` to show a folder icon button beside the output folder input when `window.livedockDesktop?.selectOutputFolder` exists. Use the selected folder string to fill the input.

Add a local global declaration near the component:

```ts
declare global {
  interface Window {
    livedockDesktop?: {
      isDesktop: boolean
      platform: string
      selectOutputFolder?: () => Promise<string | null>
    }
  }
}
```

- [ ] Verify Task 5.

```powershell
node --test desktop/tests/desktop-config.test.mjs
npm test -- frontend/__tests__/local-agent-panel.test.tsx
```

- [ ] Commit only Task 5 files.

```powershell
git status --short
git add desktop/src/main.cjs desktop/src/preload.cjs desktop/tests/desktop-config.test.mjs frontend/components/projects/LocalAgentPanel.tsx frontend/__tests__/local-agent-panel.test.tsx
git commit -m "feat(desktop): add output folder picker for live agent"
```

### Task 6: Make The Unified Agent The Primary Workspace Flow

- [ ] Add failing Project Workspace tests.

Modify `frontend/__tests__/project-workspace.test.tsx`:

```tsx
it("passes uploaded workspace files into the local agent panel", async () => {
  mockWorkspaceApi({
    files: [{ id: "file-1", name: "notice.pdf", path: "C:\\work\\notice.pdf" }],
  })

  render(<ProjectWorkspace projectId="project-1" />)

  expect(await screen.findByText("notice.pdf")).toBeInTheDocument()
  expect(screen.getByLabelText("요청사항")).toBeInTheDocument()
  expect(screen.getByLabelText("저장 폴더")).toBeInTheDocument()
})
```

Run the failing test:

```powershell
npm test -- frontend/__tests__/project-workspace.test.tsx
```

- [ ] Wire workspace files into the Local Agent panel.

Modify `frontend/components/projects/WorkspacePanels.tsx`:

- accept a `localAgentFiles` prop on `WorkspaceContextPanel`;
- pass file names and local paths when available;
- keep analysis, blueprint, and export panels as secondary workspace context.

Modify `frontend/components/projects/ProjectWorkspace.tsx`:

```tsx
const localAgentFiles = workspace.files.map(file => ({
  id: file.id,
  name: file.originalName ?? file.name,
  path: file.localPath ?? file.path,
}))
```

Pass `localAgentFiles` into `WorkspaceContextPanel`.

The visible workflow order should be:

1. upload/source files,
2. request and output folder,
3. run live Agent,
4. compact progress/result,
5. optional analysis/export details.

- [ ] Verify Task 6.

```powershell
npm test -- frontend/__tests__/project-workspace.test.tsx frontend/__tests__/local-agent-panel.test.tsx
```

- [ ] Commit only Task 6 files.

```powershell
git status --short
git add frontend/components/projects/ProjectWorkspace.tsx frontend/components/projects/WorkspacePanels.tsx frontend/__tests__/project-workspace.test.tsx
git commit -m "feat(frontend): prioritize live agent workspace flow"
```

### Task 7: Enforce Grounded Visual Output For HWPX Exports

- [ ] Add failing backend contract tests for HWPX visual fallback.

Modify `backend/tests/contracts/test_document_workspace_contracts.py`:

```python
def test_hwpx_export_summary_marks_chart_fallback(self):
    workspace = _demo_workspace()
    build_blueprint(workspace)
    generate_document(workspace_service.get_workspace(workspace.id))
    reloaded = workspace_service.get_workspace(workspace.id)

    chart_blocks = [block for block in reloaded.document.blocks if block.kind == "chart"]
    self.assertTrue(chart_blocks)

    filename, content, summary = export_hwpx(reloaded.document)

    self.assertTrue(filename.endswith(".hwpx"))
    self.assertTrue(content.startswith(b"PK"))
    warnings = " ".join(summary.get("warnings", []))
    self.assertIn("chart", warnings.lower())
    self.assertIn("source table", warnings.lower())
    self.assertTrue(summary.get("chart_fallback_used"))
```

Run the failing contract:

```powershell
python -m pytest backend/tests/contracts/test_document_workspace_contracts.py -q
```

- [ ] Implement explicit visual fallback metadata in `backend/services/workspace_export.py`.

Modify `backend/services/workspace_export.py`:

- detect chart/graph requests from drafted workspace blocks;
- require source table values before rendering visual output;
- when native HWPX chart insertion is unavailable, include:
  - the source table in the export body;
  - a warning such as `Chart requests are exported with the source table because native HWPX chart objects are not enabled in this version.`;
  - validation metadata showing extracted text contains expected table labels;
- never synthesize chart series values from prose.

If the existing workspace model already has `ChartBlock` preview support, reuse that data for UI preview and export fallback rather than inventing a new representation.

Implementation shape:

```python
def _chart_fallback_warning(document: GeneratedDocument) -> list[str]:
    if not any(block.kind == "chart" and block.chart for block in document.blocks):
        return []
    return [
        "Chart requests are exported with the source table because native HWPX chart objects are not enabled in this version."
    ]


def export_hwpx(document: GeneratedDocument) -> tuple[str, bytes, dict[str, Any]]:
    from services.drafting_service import export_markdown_to_hwpx_with_validation

    filename, content, summary = export_markdown_to_hwpx_with_validation(render_markdown(document), document.title or "문서")
    chart_warnings = _chart_fallback_warning(document)
    if chart_warnings:
        summary["warnings"] = list(dict.fromkeys([*summary.get("warnings", []), *chart_warnings]))
        summary["chart_fallback_used"] = True
    else:
        summary.setdefault("chart_fallback_used", False)
    return filename, content, summary
```

- [ ] Verify Task 7.

```powershell
python -m pytest backend/tests/contracts/test_document_workspace_contracts.py -q
```

- [ ] Commit only Task 7 files.

```powershell
git status --short
git add backend/services/workspace_export.py backend/tests/contracts/test_document_workspace_contracts.py
git commit -m "feat(hwpx): enforce grounded visual export fallback"
```

### Task 8: Full Contract Sync And Harness Verification

- [ ] Run inline Agent contract tests.

```powershell
python -m pytest docklive-inline-agent/tests -q
```

- [ ] Run frontend focused tests.

```powershell
npm test -- frontend/__tests__/local-agent-panel.test.tsx frontend/__tests__/project-workspace.test.tsx
```

- [ ] Run desktop focused tests.

```powershell
node --test desktop/tests/desktop-config.test.mjs
```

- [ ] Run repository harness quick gate.

```powershell
.\scripts\harness.ps1 -Profile quick
```

- [ ] Run HWPX gate because this feature changes HWPX export behavior.

```powershell
.\scripts\harness.ps1 -Profile hwpx
```

- [ ] Run frontend production build gate because the primary workflow UI changed.

```powershell
.\scripts\harness.ps1 -Profile frontend
```

- [ ] Inspect error registry after every failed harness run.

```powershell
Get-Content harness/errors/registry.json
```

Resolve recurring failures in scope. If a failure is outside this feature, record the exact fingerprint and reason in the final implementation report without changing unrelated files.

- [ ] Commit final integration fixes.

```powershell
git status --short
git add docklive-inline-agent/src/server.py docklive-inline-agent/src/tools/excel_tools.py docklive-inline-agent/src/tools/hwpx_tools.py docklive-inline-agent/src/tools/schemas.py docklive-inline-agent/src/executor/dispatcher.py docklive-inline-agent/tests/test_server.py docklive-inline-agent/tests/test_excel_tools.py docklive-inline-agent/tests/test_hwpx_tools.py docklive-inline-agent/tests/test_contracts.py frontend/components/projects/LocalAgentPanel.tsx frontend/components/projects/ProjectWorkspace.tsx frontend/components/projects/WorkspacePanels.tsx frontend/lib/types.ts frontend/__tests__/local-agent-panel.test.tsx frontend/__tests__/project-workspace.test.tsx desktop/src/main.cjs desktop/src/preload.cjs desktop/tests/desktop-config.test.mjs backend/services/workspace_export.py backend/tests/contracts/test_document_workspace_contracts.py
git commit -m "test: verify live document agent workflow"
```

## Final Acceptance Checklist

- [ ] A user can start the workflow with only source files, a request, and an output folder.
- [ ] Auto mode chooses Excel for spreadsheet/CSV targets and HWPX for HWP/HWPX targets.
- [ ] Excel can open or create a live workbook, write values, format tables, create charts, save to the selected output folder, and report the saved path.
- [ ] HWPX can create a live document session, draft source-grounded sections, request confirmation for missing facts, export a validated HWPX package, save to the selected output folder, and report the saved path.
- [ ] Chart/table/graph values come only from uploaded source data or user-confirmed input.
- [ ] HWPX native chart objects are not generated in v1; visual requests produce preview plus verified export fallback/warning.
- [ ] Frontend, backend, and inline Agent contracts remain synchronized.
- [ ] Relevant focused tests and harness gates pass, or failures are recorded with exact fingerprints and next steps.

## Rollback Plan

- Revert the commits from the most recent task backward until the failing surface is removed.
- Keep the design spec commit intact because it documents the approved product direction.
- If Excel COM behavior fails only on machines without Excel, keep pure unit tests passing and mark the runtime limitation in the final report.
- If HWPX backend session routes differ from the assumed route names, adapt the inline Agent wrappers to the existing backend routes and keep the tool names stable for the Agent prompt.
