#!/usr/bin/env python3
"""Convert binary HWP files to HWPX.

This wrapper uses jkf87/hwp2hwpx-python-refactor when available. It also checks
the common local development paths used by LiveDock and can clone the converter
repository when git/network access is available.

Usage:
    python convert_hwp.py input.hwp -o output.hwpx
    python convert_hwp.py input.hwp --info --json
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


REPO_URL = "https://github.com/jkf87/hwp2hwpx-python-refactor.git"


def _import_or_none(module_name: str):
    try:
        return __import__(module_name)
    except ImportError:
        return None


def _ensure_dependencies() -> None:
    missing: list[str] = []
    if _import_or_none("olefile") is None:
        missing.append("olefile")
    if _import_or_none("hwp5") is None:
        missing.append("pyhwp")
    if _import_or_none("lxml") is None:
        missing.append("lxml")

    if missing:
        raise RuntimeError(
            "HWP 변환에 필요한 Python 패키지가 설치되어 있지 않습니다: "
            + ", ".join(missing)
            + ". requirements.txt 또는 배포 이미지에 olefile, pyhwp, lxml을 설치해 주세요."
        )


def _candidate_roots() -> list[Path]:
    script_dir = Path(__file__).resolve().parent
    return [
        Path.home() / "hwp2hwpx-python-refactor",
        Path.home() / "문자연구원-claudecode" / "hwp2hwpx-python-refactor",
        script_dir.parent / ".hwp2hwpx-repo",
        script_dir.parents[2] / "tools" / "hwp2hwpx-python-refactor",
    ]


def _ensure_hwp2hwpx() -> None:
    if _import_or_none("hwp2hwpx") is not None:
        return

    for root in _candidate_roots():
        if (root / "hwp2hwpx").is_dir():
            sys.path.insert(0, str(root))
            if _import_or_none("hwp2hwpx") is not None:
                return

    clone_dir = Path(__file__).resolve().parent.parent / ".hwp2hwpx-repo"
    if not (clone_dir / "hwp2hwpx").is_dir():
        try:
            subprocess.check_call(
                ["git", "clone", "--depth", "1", REPO_URL, str(clone_dir)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as exc:
            raise RuntimeError(
                "hwp2hwpx 변환기를 찾거나 내려받지 못했습니다. "
                f"{REPO_URL} 저장소를 설치하거나 HWP 파일을 HWPX로 변환해 업로드해 주세요."
            ) from exc

    sys.path.insert(0, str(clone_dir))
    if _import_or_none("hwp2hwpx") is None:
        raise RuntimeError("hwp2hwpx 변환기를 import하지 못했습니다.")


def convert(input_path: str, output_path: str | None = None) -> str:
    _ensure_dependencies()
    _ensure_hwp2hwpx()
    from hwp2hwpx import convert_file

    output = convert_file(input_path, output_path)
    return str(output)


def info(input_path: str) -> dict:
    _ensure_dependencies()
    _ensure_hwp2hwpx()
    from hwp2hwpx.reader import HWPReader

    with HWPReader(input_path) as reader:
        summary = reader.get_summary_info()
        file_header = reader.get_file_header()
        section_count = reader.get_section_count()
        bin_data_list = reader.get_bin_data_list()

    result = {
        "title": summary.get("title", ""),
        "author": summary.get("author", ""),
        "subject": summary.get("subject", ""),
        "keywords": summary.get("keywords", ""),
        "version": f"{file_header['major']}.{file_header['minor']}.{file_header['micro']}.{file_header['build']}",
        "section_count": section_count,
        "embedded_bindata_count": len(bin_data_list),
    }
    if summary.get("create_time"):
        result["create_time"] = str(summary["create_time"])
    if summary.get("last_saved_time"):
        result["last_saved_time"] = str(summary["last_saved_time"])
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert HWP(binary) to HWPX(XML package)")
    parser.add_argument("input", help="Input .hwp file path")
    parser.add_argument("-o", "--output", help="Output .hwpx file path")
    parser.add_argument("--info", action="store_true", help="Print document metadata without conversion")
    parser.add_argument("--json", action="store_true", help="Print JSON output")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: file not found: {input_path}", file=sys.stderr)
        return 1
    if input_path.suffix.lower() != ".hwp":
        print(f"WARNING: input extension is not .hwp: {input_path}", file=sys.stderr)

    try:
        if args.info:
            result = info(str(input_path))
        else:
            output = convert(str(input_path), args.output)
            result = {"input": str(input_path), "output": output, "size": os.path.getsize(output)}
        print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else result)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
