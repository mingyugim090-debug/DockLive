"""Windows Excel automation and workbook sync helpers.

The COM adapter is optional and loaded lazily so non-Windows test and CI
environments can still validate the file-watch/snapshot behavior.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class ExcelAdapter(Protocol):
    def open_workbook(self, path: str) -> None:
        ...


class ComExcelAdapter:
    """Open workbooks through Microsoft Excel COM on Windows."""

    def open_workbook(self, path: str) -> None:
        try:
            import win32com.client
        except ImportError as exc:  # pragma: no cover - depends on Windows desktop
            raise RuntimeError("pywin32 is required for Excel COM automation on Windows.") from exc

        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = True
        excel.Workbooks.Open(path)


@dataclass
class HelperState:
    path: str = ""
    status: str = "idle"
    last_opened_at: str = ""
    last_synced_at: str = ""
    last_mtime: float = 0.0
    snapshot: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def snapshot_workbook(path: str | Path, max_rows: int = 30, max_cols: int = 12) -> dict:
    import openpyxl

    workbook = openpyxl.load_workbook(path, data_only=True)
    try:
        sheets = {}
        for worksheet in workbook.worksheets:
            rows = []
            for row in worksheet.iter_rows(max_row=max_rows, max_col=max_cols, values_only=True):
                values = ["" if value is None else str(value) for value in row]
                if any(values):
                    rows.append(values)
            sheets[worksheet.title] = rows
        return {"source": "user_edit", "sheets": sheets}
    finally:
        workbook.close()


def watch_once(path: str | Path, previous_mtime: float = 0.0) -> HelperState:
    resolved = str(Path(path).resolve())
    current_mtime = Path(resolved).stat().st_mtime
    if previous_mtime and current_mtime <= previous_mtime:
        return HelperState(
            path=resolved,
            status="unchanged",
            last_mtime=current_mtime,
        )
    return HelperState(
        path=resolved,
        status="synced",
        last_synced_at=_utc_now(),
        last_mtime=current_mtime,
        snapshot=snapshot_workbook(resolved),
    )


class ExcelDesktopHelper:
    def __init__(self, adapter: ExcelAdapter | None = None):
        self.adapter = adapter or ComExcelAdapter()
        self.state = HelperState()

    def open_workbook(self, path: str | Path) -> HelperState:
        resolved = str(Path(path).resolve())
        self.adapter.open_workbook(resolved)
        self.state = HelperState(
            path=resolved,
            status="opened",
            last_opened_at=_utc_now(),
            last_mtime=Path(resolved).stat().st_mtime,
        )
        return self.state

    def sync_if_changed(self, path: str | Path | None = None) -> HelperState:
        resolved = str(Path(path or self.state.path).resolve())
        current_mtime = Path(resolved).stat().st_mtime
        if self.state.path == resolved and current_mtime == self.state.last_mtime:
            return self.state
        self.state.path = resolved
        self.state.status = "synced"
        self.state.last_synced_at = _utc_now()
        self.state.last_mtime = current_mtime
        self.state.snapshot = snapshot_workbook(resolved)
        return self.state
