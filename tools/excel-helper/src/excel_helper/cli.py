"""Small CLI wrapper for manual local Excel helper checks."""

from __future__ import annotations

import argparse
import json

from .core import ExcelDesktopHelper, snapshot_workbook


def main() -> int:
    parser = argparse.ArgumentParser(description="LiveDock local Excel helper")
    subcommands = parser.add_subparsers(dest="command", required=True)

    open_command = subcommands.add_parser("open", help="Open an XLSX file in Microsoft Excel")
    open_command.add_argument("path")

    snapshot_command = subcommands.add_parser("snapshot", help="Read a compact workbook snapshot")
    snapshot_command.add_argument("path")

    args = parser.parse_args()
    if args.command == "open":
        state = ExcelDesktopHelper().open_workbook(args.path)
        print(json.dumps(state.__dict__, ensure_ascii=False))
        return 0
    if args.command == "snapshot":
        print(json.dumps(snapshot_workbook(args.path), ensure_ascii=False))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
