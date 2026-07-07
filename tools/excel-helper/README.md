# Excel Helper

Local Windows helper for LiveDock Desktop Excel artifacts.

The web backend can generate XLSX files with `openpyxl`. This helper adds the
desktop-only layer: open the generated workbook in Microsoft Excel through COM
and read compact workbook snapshots after the user saves edits.

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Commands

```powershell
python -m excel_helper.cli open C:\path\to\dashboard.xlsx
python -m excel_helper.cli snapshot C:\path\to\dashboard.xlsx
```

COM automation requires Windows, Microsoft Excel, and `pywin32`. Snapshot tests
run without Excel installed.
