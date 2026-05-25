#!/usr/bin/env python3
"""Convert binary HWP files to HWPX.

This wrapper uses jkf87/hwp2hwpx-python-refactor when available. Text-only
fallback is disabled by default because it destroys official form layout.

Usage:
    python convert_hwp.py input.hwp -o output.hwpx
    python convert_hwp.py input.hwp --info --json
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


REPO_URL = "https://github.com/jkf87/hwp2hwpx-python-refactor.git"
SCRIPT_DIR = Path(__file__).resolve().parent


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
        missing.append("pyhwp/pyhwp2 (module hwp5)")
    if _import_or_none("lxml") is None:
        missing.append("lxml")

    if missing:
        raise RuntimeError(
            "HWP 변환에 필요한 Python 패키지가 설치되어 있지 않습니다: "
            + ", ".join(missing)
            + ". requirements.txt 또는 배포 이미지에 olefile, pyhwp, lxml을 설치해 주세요."
        )


def _ensure_preview_text_dependencies() -> None:
    if _import_or_none("olefile") is None:
        raise RuntimeError(
            "HWP 텍스트 fallback에 필요한 Python 패키지가 설치되어 있지 않습니다: olefile. "
            "requirements.txt 또는 배포 이미지에 olefile을 설치해 주세요."
        )


def _text_fallback_allowed() -> bool:
    return os.getenv("HWP2HWPX_ALLOW_TEXT_FALLBACK", "").strip().lower() in {"1", "true", "yes"}


def _candidate_roots() -> list[Path]:
    script_dir = SCRIPT_DIR
    repo_root = script_dir.parents[2]
    env_dir = os.getenv("HWP2HWPX_DIR", "").strip()
    candidates = [
        Path.home() / "hwp2hwpx-python-refactor",
        Path.home() / "문자연구원-claudecode" / "hwp2hwpx-python-refactor",
        script_dir.parent / ".hwp2hwpx-repo",
        repo_root / "tools" / "hwp2hwpx-python-refactor",
        repo_root / "vendor" / "hwp2hwpx-python-refactor",
    ]
    if env_dir:
        candidates.insert(0, Path(env_dir))
    return [
        candidate
        for candidate in candidates
        if candidate
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
        raise RuntimeError(
            "hwp2hwpx 변환기를 import하지 못했습니다. "
            "변환기 저장소가 손상되었거나 pyhwp/olefile/lxml 의존성이 맞지 않습니다."
        )


def convert_with_result(input_path: str, output_path: str | None = None) -> dict:
    output = output_path or str(Path(input_path).with_suffix(".hwpx"))
    try:
        converted = _convert_with_hwp2hwpx(input_path, output)
        audit = _conversion_audit(input_path, converted, "hwp2hwpx-python-refactor")
        return {
            "input": input_path,
            "output": converted,
            "size": os.path.getsize(converted),
            "conversion_method": "hwp2hwpx-python-refactor",
            "warnings": audit.pop("warnings"),
            "audit": audit,
        }
    except Exception as primary_exc:
        if not _text_fallback_allowed():
            raise RuntimeError(
                "HWP structure-preserving conversion failed. Text fallback is disabled because it loses "
                "tables, layout, and styles. Install/fix hwp2hwpx, pyhwp/pyhwp2, olefile, and lxml, or set "
                "HWP2HWPX_ALLOW_TEXT_FALLBACK=true only for explicit debugging."
            ) from primary_exc

        fallback = _convert_with_preview_text_fallback(input_path, output, primary_exc)
        audit = _conversion_audit(input_path, fallback, "preview-text-to-hwpx-fallback")
        return {
            "input": input_path,
            "output": fallback,
            "size": os.path.getsize(fallback),
            "conversion_method": "preview-text-to-hwpx-fallback",
            "warnings": [
                "원본 HWP 서식 보존 변환기가 실패해 HWP 미리보기 텍스트 기반 HWPX로 변환했습니다.",
                f"원인: {primary_exc}",
                *audit.pop("warnings"),
            ],
            "audit": audit,
        }


def convert(input_path: str, output_path: str | None = None) -> str:
    return str(convert_with_result(input_path, output_path)["output"])


def _conversion_audit(input_path: str, output_path: str, method: str) -> dict:
    warnings: list[str] = []
    preview_text = ""
    output_text = ""

    try:
        preview_text = _extract_hwp_preview_text(input_path)
    except Exception as exc:
        warnings.append(f"HWP 원본 preview 텍스트 감사에 실패했습니다: {exc}")

    try:
        output_text = _extract_hwpx_package_text(output_path)
    except Exception as exc:
        warnings.append(f"변환된 HWPX 텍스트 감사에 실패했습니다: {exc}")

    preview_chars = len(_clean_hwp_text(preview_text))
    output_chars = len(_clean_hwp_text(output_text))
    if output_chars < 5:
        warnings.append("변환된 HWPX에서 분석 가능한 텍스트를 거의 찾지 못했습니다.")
    if preview_chars and output_chars and output_chars < max(10, int(preview_chars * 0.6)):
        warnings.append(
            f"변환 후 텍스트 길이가 원본 preview 대비 크게 줄었습니다. preview={preview_chars}, hwpx={output_chars}"
        )
    if method == "preview-text-to-hwpx-fallback":
        warnings.append("텍스트 fallback 변환 결과는 표 구조와 서식이 일부 누락될 수 있습니다.")

    return {
        "input_preview_text_chars": preview_chars,
        "output_hwpx_text_chars": output_chars,
        "output_text_preview": _clean_hwp_text(output_text)[:1000],
        "data_loss_risk": bool(output_chars < 5 or (preview_chars and output_chars < max(10, int(preview_chars * 0.6)))),
        "warnings": warnings,
    }


def _extract_hwpx_package_text(output_path: str) -> str:
    chunks: list[str] = []
    with zipfile.ZipFile(output_path) as package:
        for name in sorted(package.namelist()):
            lower = name.lower()
            if not lower.endswith(".xml"):
                continue
            if "/bindata/" in lower or lower.startswith("bindata/"):
                continue
            xml = package.read(name).decode("utf-8", errors="replace")
            text_nodes = re.findall(r"<(?:\w+:)?t\b[^>]*>(.*?)</(?:\w+:)?t>", xml, flags=re.DOTALL)
            for node in text_nodes:
                text = re.sub(r"<[^>]+>", "", node)
                text = html.unescape(text).strip()
                if text:
                    chunks.append(text)
    return _clean_hwp_text("\n".join(chunks))


def _convert_with_hwp2hwpx(input_path: str, output_path: str | None = None) -> str:
    _ensure_dependencies()
    _ensure_hwp2hwpx()
    from hwp2hwpx import convert_file

    output = convert_file(input_path, output_path)
    return str(output)


def _convert_with_preview_text_fallback(input_path: str, output_path: str, reason: Exception) -> str:
    text = _extract_hwp_preview_text(input_path)
    if len(text.strip()) < 5:
        raise RuntimeError(
            "hwp2hwpx 변환기가 실패했고 HWP 미리보기 텍스트도 추출하지 못했습니다. "
            "암호화되었거나 미리보기 텍스트가 없는 HWP일 수 있습니다."
        ) from reason

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    markdown = _markdown_from_hwp_text(text, Path(input_path).stem)
    md2hwpx = SCRIPT_DIR / "md2hwpx.py"
    if not md2hwpx.is_file():
        raise RuntimeError(f"텍스트 fallback에 필요한 md2hwpx.py를 찾지 못했습니다: {md2hwpx}") from reason

    with tempfile.TemporaryDirectory(prefix="livedock_hwp_fallback_") as tmp:
        markdown_path = Path(tmp) / "input.md"
        markdown_path.write_text(markdown, encoding="utf-8")
        completed = subprocess.run(
            [
                sys.executable or "python",
                str(md2hwpx),
                str(markdown_path),
                "-o",
                str(output),
                "--title",
                Path(input_path).stem,
                "--template",
                "report",
            ],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if not output.exists():
            detail = "\n".join(part for part in [completed.stdout, completed.stderr] if part).strip()
            raise RuntimeError(f"HWP 텍스트 fallback 변환 후 출력 파일을 찾지 못했습니다. {detail[:500]}") from reason
    return str(output)


def _extract_hwp_preview_text(input_path: str) -> str:
    _ensure_preview_text_dependencies()
    import olefile

    path = Path(input_path)
    try:
        with olefile.OleFileIO(str(path)) as ole:
            for stream_name in ("PrvText", "PrvText/Section0"):
                if not ole.exists(stream_name):
                    continue
                data = ole.openstream(stream_name).read()
                text = _decode_hwp_text(data)
                if text.strip():
                    return _clean_hwp_text(text)
    except Exception:
        pass
    return _scan_utf16le_text(path.read_bytes())


def _decode_hwp_text(data: bytes) -> str:
    for encoding in ("utf-16-le", "utf-8", "cp949"):
        try:
            return data.decode(encoding, errors="replace")
        except Exception:
            continue
    return ""


def _clean_hwp_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _scan_utf16le_text(data: bytes) -> str:
    runs: list[str] = []
    i = 0
    while i < len(data) - 1 and len(runs) < 800:
        code = data[i] | (data[i + 1] << 8)
        if _looks_like_text_codepoint(code):
            run = []
            while i < len(data) - 1:
                current = data[i] | (data[i + 1] << 8)
                if not _looks_like_text_codepoint(current):
                    break
                run.append(chr(current))
                i += 2
            candidate = "".join(run).strip()
            if len(candidate) >= 2:
                runs.append(candidate)
        else:
            i += 2
    return _clean_hwp_text("\n".join(runs))


def _looks_like_text_codepoint(code: int) -> bool:
    return (
        code in {0x0009, 0x000A, 0x000D, 0x0020}
        or 0x0021 <= code <= 0x007E
        or 0x3131 <= code <= 0x318F
        or 0xAC00 <= code <= 0xD7A3
        or 0x4E00 <= code <= 0x9FFF
    )


def _markdown_from_hwp_text(text: str, title: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    if not lines:
        lines = [title]

    body: list[str] = [f"# {title}", ""]
    for line in lines:
        if line == title:
            continue
        if _looks_like_heading(line):
            body.extend([f"## {line}", ""])
        else:
            body.extend([line, ""])
    return "\n".join(body).strip() + "\n"


def _looks_like_heading(line: str) -> bool:
    if len(line) > 80:
        return False
    return bool(re.match(r"^(\d+[\.)]|[가-하][\.)]|[IVX]+[\.)])\s+", line)) or line.endswith(("개요", "안내", "방법", "서류", "일정"))


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
    parser.add_argument(
        "--allow-text-fallback",
        action="store_true",
        help="Allow lossy preview-text fallback. Disabled by default to preserve HWP form layout.",
    )
    args = parser.parse_args()

    if args.allow_text_fallback:
        os.environ["HWP2HWPX_ALLOW_TEXT_FALLBACK"] = "true"

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
            result = convert_with_result(str(input_path), args.output)
        print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else result)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
