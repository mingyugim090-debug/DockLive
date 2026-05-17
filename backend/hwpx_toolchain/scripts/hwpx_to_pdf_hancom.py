"""Convert a HWPX file to PDF with locally installed Hancom HWP.

This script intentionally lives outside the FastAPI process. Hancom's COM
automation is Windows-only and requires a desktop-capable Python environment
with pywin32 installed.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path


def _register_security_module(hwp, repo_root: Path) -> None:
    candidates = [
        repo_root / "tools" / "hwp-mcp" / "security_module" / "FilePathCheckerModuleExample.dll",
        repo_root / "backend" / "hwpx_toolchain" / "security_module" / "FilePathCheckerModuleExample.dll",
    ]
    for module_path in candidates:
        if module_path.exists():
            try:
                hwp.RegisterModule("FilePathCheckerModuleExample", str(module_path))
            except Exception:
                pass
            return


def _open_document(hwp, input_path: Path) -> bool:
    abs_input = str(input_path.resolve())
    try:
        return bool(hwp.Open(abs_input))
    except Exception:
        pass

    try:
        pset = hwp.HParameterSet.HFileOpenSave
        hwp.HAction.GetDefault("FileOpen", pset.HSet)
        pset.filename = abs_input
        pset.Format = "HWPX"
        return bool(hwp.HAction.Execute("FileOpen", pset.HSet))
    except Exception:
        return False


def _save_pdf(hwp, output_path: Path) -> bool:
    abs_output = str(output_path.resolve())
    try:
        hwp.SaveAs(abs_output, "PDF", "")
        return output_path.exists()
    except Exception:
        pass

    try:
        pset = hwp.HParameterSet.HFileOpenSave
        hwp.HAction.GetDefault("FileSaveAs_S", pset.HSet)
        pset.filename = abs_output
        pset.Format = "PDF"
        hwp.HAction.Execute("FileSaveAs_S", pset.HSet)
        return output_path.exists()
    except Exception:
        return False


def convert(input_path: Path, output_path: Path, visible: bool = False) -> None:
    if not input_path.exists():
        raise RuntimeError(f"Input file not found: {input_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import pythoncom
        import win32com.client
    except ImportError as exc:
        raise RuntimeError("pywin32 is required for Hancom PDF export") from exc

    pythoncom.CoInitialize()
    hwp = None
    try:
        hwp = win32com.client.DispatchEx("HWPFrame.HwpObject")
        try:
            hwp.XHwpWindows.Item(0).Visible = bool(visible)
        except Exception:
            pass
        try:
            hwp.SetMessageBoxMode(0x00010000)
        except Exception:
            pass

        repo_root = Path(__file__).resolve().parents[3]
        _register_security_module(hwp, repo_root)

        if not _open_document(hwp, input_path):
            raise RuntimeError("Hancom HWP could not open the HWPX file")
        if not _save_pdf(hwp, output_path):
            raise RuntimeError("Hancom HWP did not create a PDF file")

        # Some HWP versions return before the file handle is fully flushed.
        for _ in range(20):
            if output_path.exists() and output_path.stat().st_size > 100:
                break
            time.sleep(0.25)

        data = output_path.read_bytes()
        if not data.startswith(b"%PDF"):
            raise RuntimeError("Converted file is not a valid PDF")
    finally:
        if hwp is not None:
            try:
                hwp.HAction.Run("FileClose")
            except Exception:
                pass
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert HWPX to PDF with Hancom HWP COM automation")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--visible", action="store_true")
    args = parser.parse_args()

    try:
        convert(args.input, args.output, args.visible)
    except Exception as exc:
        print(f"HWPX to PDF conversion failed: {exc}", file=sys.stderr)
        return 1

    print(f"PDF created: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
