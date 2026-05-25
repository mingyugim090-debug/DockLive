#!/usr/bin/env python3
"""Clone an HWPX form and replace text in-place.

This script is intentionally conservative: it copies the source HWPX package,
keeps table/image/style XML intact, and changes only existing ``hp:t`` text
nodes. Use this for official forms where layout preservation matters.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any

from lxml import etree


SCRIPT_DIR = Path(__file__).resolve().parent
HWPX_SECTION_PATH = "Contents/section0.xml"
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")
TEXT_TAG_RE = re.compile(r"(<hp:t\b(?![^>]*/>)[^>]*>)(.*?)(</hp:t>)", re.DOTALL)

DEFAULT_SECTION_ALIASES = {
    "problem": [
        "problem",
        "problem 풀고자 하는 문제",
        "풀고자 하는 문제",
        "문제 정의",
        "해결하고자 하는 문제",
    ],
    "solution": [
        "solution",
        "solution 나의 솔루션",
        "나의 솔루션",
        "해결 방안",
    ],
    "ai_capability": [
        "ai 활용 역량",
        "ai활용역량",
        "ai 활용",
        "인공지능 활용 역량",
        "생성형 ai 활용 역량",
    ],
}


def extract_texts(hwpx_path: str) -> list[str]:
    """Extract unique hp:t text snippets in package order."""
    texts: list[str] = []
    seen: set[str] = set()

    with zipfile.ZipFile(hwpx_path, "r") as zf:
        for name in zf.namelist():
            if name.startswith("Contents/") and name.endswith(".xml"):
                data = zf.read(name).decode("utf-8", errors="replace")
                for match in re.finditer(r"<hp:t\b[^>]*>(.*?)</hp:t>", data, re.DOTALL):
                    raw = match.group(1)
                    clean = re.sub(r"<[^>]+>", "", raw).strip()
                    clean = html.unescape(clean)
                    if clean and clean not in seen:
                        seen.add(clean)
                        texts.append(clean)
    return texts


def analyze(hwpx_path: str) -> list[str]:
    """Print a human-readable structure summary."""
    print(f"=== HWPX form analysis: {hwpx_path} ===\n")

    with zipfile.ZipFile(hwpx_path, "r") as zf:
        names = zf.namelist()
        print(f"ZIP entries: {len(names)}")
        bindata = [name for name in names if name.startswith("BinData/")]
        print(f"BinData: {len(bindata)}")

        if HWPX_SECTION_PATH in names:
            section = zf.read(HWPX_SECTION_PATH).decode("utf-8", errors="replace")
            paragraph_count = len(re.findall(r"<hp:p\b", section))
            run_count = len(re.findall(r"<hp:run\b", section))
            table_count = len(re.findall(r"<hp:tbl\b", section))
            image_count = len(re.findall(r"<hp:pic\b", section))
            print(
                "section0.xml: "
                f"paragraphs={paragraph_count}, "
                f"runs={run_count}, "
                f"tables={table_count}, "
                f"images={image_count}, "
                f"bytes={len(section):,}"
            )

    texts = extract_texts(hwpx_path)
    print(f"\nUnique text snippets: {len(texts)}\n")
    for index, text in enumerate(texts, start=1):
        display = text[:80] + "..." if len(text) > 80 else text
        print(f"  [{index:3d}] {display}")
    return texts


def auto_analyze(hwpx_path: str, output_json: str | None = None) -> dict[str, Any]:
    """Analyze a form and generate an empty exact-text replacement map."""
    structure: dict[str, Any] = {}
    with zipfile.ZipFile(hwpx_path, "r") as zf:
        names = zf.namelist()
        structure["zip_entries"] = len(names)
        structure["bindata_count"] = len([name for name in names if name.startswith("BinData/")])

        if HWPX_SECTION_PATH in names:
            section = zf.read(HWPX_SECTION_PATH).decode("utf-8", errors="replace")
            structure["tables"] = len(re.findall(r"<hp:tbl\b", section))
            structure["images"] = len(re.findall(r"<hp:pic\b", section))
            structure["paragraphs"] = len(re.findall(r"<hp:p\b", section))
            structure["runs"] = len(re.findall(r"<hp:run\b", section))
            structure["section_size"] = len(section)

    texts = extract_texts(hwpx_path)
    result = {
        "source": hwpx_path,
        "structure": structure,
        "recommendation": "Workflow F: clone the source package and replace hp:t text in-place",
        "text_count": len(texts),
        "template_map": {text: "" for text in texts if len(text) > 1},
    }

    output = json.dumps(result, ensure_ascii=False, indent=2)
    if output_json:
        Path(output_json).write_text(output + "\n", encoding="utf-8")
        print(f"Wrote analysis: {output_json}")
    else:
        print(output)
    return result


def sanitize_hwpx_text(value: Any) -> str:
    """Return XML-safe text without schema-polluting control characters."""
    text = html.unescape(str(value or ""))
    text = CONTROL_CHAR_RE.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n+\s*", " ", text)
    return text.strip()


def _prepare_keywords(keywords: dict[str, str]) -> list[tuple[str, str]]:
    return sorted(keywords.items(), key=lambda item: len(item[0]), reverse=True)


def _apply_keywords_to_text(text: str, sorted_keywords: list[tuple[str, str]]) -> str:
    for old, new in sorted_keywords:
        if old in text:
            text = text.replace(old, sanitize_hwpx_text(new))
    return text


def _apply_keywords_in_xml(xml_text: str, sorted_keywords: list[tuple[str, str]]) -> str:
    """Apply replacements only inside hp:t nodes."""

    def replace_in_text_node(match: re.Match[str]) -> str:
        parts = re.split(r"(<[^>]+>)", match.group(2))
        rendered = []
        for part in parts:
            rendered.append(part if part.startswith("<") else _apply_keywords_to_text(part, sorted_keywords))
        return match.group(1) + "".join(rendered) + match.group(3)

    return TEXT_TAG_RE.sub(replace_in_text_node, xml_text)


def clone(
    src_path: str,
    dst_path: str,
    replacements: dict[str, str] | None = None,
    keywords: dict[str, str] | None = None,
    title: str | None = None,
    creator: str | None = None,
    fill_sections: dict[str, str] | None = None,
    strict_fill: bool = False,
    verify: bool = False,
) -> dict[str, Any]:
    """Clone a source form and replace only textual content."""
    replacements = replacements or {}
    fill_sections = fill_sections or {}
    sorted_keywords = _prepare_keywords(keywords or {}) if keywords else []
    tmp_path = str(dst_path) + ".tmp"
    report: dict[str, Any] = {"requested": list(fill_sections.keys()), "matched": [], "missing": []}

    with zipfile.ZipFile(src_path, "r") as zin:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)

                if item.filename.startswith("Contents/") and item.filename.endswith(".xml"):
                    if item.filename == HWPX_SECTION_PATH and fill_sections:
                        text = data.decode("utf-8", errors="replace")
                        for old, new in replacements.items():
                            text = text.replace(old, sanitize_hwpx_text(new))
                        if sorted_keywords:
                            text = _apply_keywords_in_xml(text, sorted_keywords)
                        data = text.encode("utf-8")
                        data, fill_report = fill_section_xml_bytes(data, fill_sections, strict=strict_fill)
                        report["matched"].extend(fill_report["matched"])
                        report["missing"].extend(fill_report["missing"])
                    else:
                        text = data.decode("utf-8", errors="replace")
                        for old, new in replacements.items():
                            text = text.replace(old, sanitize_hwpx_text(new))
                        if sorted_keywords:
                            text = _apply_keywords_in_xml(text, sorted_keywords)
                        if item.filename == "Contents/content.hpf":
                            text = _update_metadata_xml(text, title, creator)
                        data = text.encode("utf-8")

                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data)

    os.replace(tmp_path, dst_path)
    if verify:
        report["verify"] = verify_clone(src_path, dst_path)
    return report


def fill_section_xml_bytes(data: bytes, fill_sections: dict[str, str], strict: bool = False) -> tuple[bytes, dict[str, Any]]:
    """Replace hp:t content after matching section headings without changing layout nodes."""
    root = _xml_root(data)
    report = fill_section_root(root, fill_sections)
    if strict and report["missing"]:
        raise RuntimeError("Missing fill targets: " + ", ".join(report["missing"]))
    rendered = etree.tostring(root, encoding="utf-8", xml_declaration=True, standalone=True)
    return rendered, report


def fill_section_root(root: Any, fill_sections: dict[str, str]) -> dict[str, Any]:
    containers = _text_containers(root)
    all_aliases: list[str] = []
    field_aliases: dict[str, list[str]] = {}
    for field in fill_sections:
        aliases = _aliases_for_field(field)
        field_aliases[field] = aliases
        all_aliases.extend(aliases)

    report = {"matched": [], "missing": []}
    used_targets: set[int] = set()
    for field, raw_value in fill_sections.items():
        value = sanitize_hwpx_text(raw_value)
        if not value:
            report["missing"].append(field)
            continue

        target_index: int | None = None
        for index, container in enumerate(containers):
            heading = _node_text(container)
            if not _matches_any_alias(heading, field_aliases[field]):
                continue
            candidate = _find_fill_target(containers, index + 1, all_aliases, used_targets)
            if candidate is not None:
                target_index = candidate
                break

        if target_index is None:
            report["missing"].append(field)
            continue
        _set_text_preserving_runs(containers[target_index], value)
        used_targets.add(target_index)
        report["matched"].append(field)
    return report


def _xml_root(data: bytes) -> Any:
    return etree.fromstring(data, parser=etree.XMLParser(remove_blank_text=False, recover=False))


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _text_containers(root: Any) -> list[Any]:
    return [node for node in root.iter() if _local(node.tag) == "p"]


def _text_nodes(node: Any) -> list[Any]:
    return [child for child in node.iter() if _local(child.tag) == "t"]


def _node_text(node: Any) -> str:
    return re.sub(r"\s+", " ", "".join(child.text or "" for child in _text_nodes(node))).strip()


def _set_text_preserving_runs(node: Any, value: str) -> None:
    nodes = _text_nodes(node)
    if not nodes:
        return
    nodes[0].text = sanitize_hwpx_text(value)
    for extra in nodes[1:]:
        extra.text = ""


def _normalize_label(text: str) -> str:
    return re.sub(r"[^0-9a-zA-Z가-힣]+", "", str(text or "").lower())


def _aliases_for_field(field: str) -> list[str]:
    label = str(field or "").strip()
    normalized = _normalize_label(label)
    aliases = [label]
    for key, values in DEFAULT_SECTION_ALIASES.items():
        if key == normalized or any(
            _normalize_label(value) in normalized or normalized in _normalize_label(value)
            for value in values
        ):
            aliases.extend(values)
    return list(dict.fromkeys(alias for alias in aliases if str(alias).strip()))


def _matches_any_alias(text: str, aliases: list[str]) -> bool:
    normalized_text = _normalize_label(text)
    if not normalized_text:
        return False
    for alias in aliases:
        normalized_alias = _normalize_label(alias)
        if normalized_alias and (normalized_alias in normalized_text or normalized_text in normalized_alias):
            return True
    return False


def _looks_like_heading(text: str, all_aliases: list[str]) -> bool:
    value = text.strip()
    if not value:
        return False
    if _matches_any_alias(value, all_aliases):
        return True
    normalized = _normalize_label(value)
    return len(normalized) <= 28 and bool(re.match(r"^(\d+|[ivx]+|[a-z])", normalized, re.I))


def _is_placeholder_text(text: str) -> bool:
    value = text.strip()
    return (
        not value
        or len(value) <= 12
        or any(token in value for token in ("작성", "입력", "기재", "내용", "예시", "OO", "ㅇㅇ"))
    )


def _find_fill_target(
    containers: list[Any],
    start_index: int,
    all_aliases: list[str],
    used_targets: set[int],
) -> int | None:
    first_empty: int | None = None
    for index in range(start_index, len(containers)):
        if index in used_targets:
            continue
        text = _node_text(containers[index])
        if not text:
            if first_empty is None:
                first_empty = index
            continue
        if _looks_like_heading(text, all_aliases):
            return first_empty
        if _is_placeholder_text(text) or first_empty is None:
            return index
        return first_empty
    return first_empty


def _update_metadata_xml(text: str, title: str | None = None, creator: str | None = None) -> str:
    safe_title = sanitize_hwpx_text(title) if title else ""
    safe_creator = sanitize_hwpx_text(creator) if creator else ""
    if safe_title:
        text = re.sub(
            r"(<(?:dc|opf):title\b[^>]*>).*?(</(?:dc|opf):title>)",
            lambda match: f"{match.group(1)}{html.escape(safe_title)}{match.group(2)}",
            text,
            flags=re.DOTALL,
        )
    if safe_creator:
        text = re.sub(
            r"(<(?:dc|opf):creator\b[^>]*>).*?(</(?:dc|opf):creator>)",
            lambda match: f"{match.group(1)}{html.escape(safe_creator)}{match.group(2)}",
            text,
            flags=re.DOTALL,
        )
    return text


def verify_clone(src_path: str, dst_path: str) -> dict[str, Any]:
    verify_script = SCRIPT_DIR / "verify_hwpx.py"
    if not verify_script.exists():
        return {"status": "SKIPPED", "warnings": ["verify_hwpx.py not found"]}
    report_path = Path(str(dst_path) + ".verify.json")
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    completed = subprocess.run(
        [
            sys.executable or "python",
            str(verify_script),
            "--source",
            str(src_path),
            "--result",
            str(dst_path),
            "--json",
            str(report_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    if report_path.exists():
        try:
            return json.loads(report_path.read_text(encoding="utf-8"))
        finally:
            report_path.unlink(missing_ok=True)
    return {"status": "FAIL" if completed.returncode else "PASS", "stdout": completed.stdout, "stderr": completed.stderr}


def validate_result(
    src_path: str,
    dst_path: str,
    replacements: dict[str, str] | None = None,
    keywords: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Report whether exact replacement keys still remain in the result."""
    result_texts = extract_texts(dst_path)
    all_old_terms: set[str] = set()
    if replacements:
        all_old_terms.update(replacements.keys())
    if keywords:
        all_old_terms.update(keywords.keys())

    result_full = " ".join(result_texts)
    remaining = [term for term in sorted(all_old_terms, key=len, reverse=True) if term in result_full]
    replaced = len(all_old_terms) - len(remaining)
    coverage = (replaced / max(len(all_old_terms), 1)) * 100

    print("\n=== Replacement validation ===")
    print(f"Replacement terms: {len(all_old_terms)}")
    print(f"Replaced: {replaced}")
    print(f"Remaining: {len(remaining)}")
    print(f"Coverage: {coverage:.1f}%")
    for term in remaining[:20]:
        print(f"  - {term[:80]}")

    return {
        "total_originals": len(all_old_terms),
        "replaced": replaced,
        "remaining": len(remaining),
        "remaining_texts": remaining,
        "coverage_pct": coverage,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Clone an HWPX form and replace text in-place")
    parser.add_argument("source", help="Source HWPX file")
    parser.add_argument("output", nargs="?", help="Output HWPX file")
    parser.add_argument("--analyze", action="store_true", help="Print form analysis")
    parser.add_argument("--auto-analyze", metavar="JSON", help="Write an empty exact-text replacement map")
    parser.add_argument("--map", help="Exact whole-XML string replacement JSON")
    parser.add_argument("--keywords", help="hp:t-only keyword replacement JSON")
    parser.add_argument("--fill-sections", help="Heading-to-content JSON map for in-place form filling")
    parser.add_argument("--strict-fill", action="store_true", help="Fail when any --fill-sections key is not matched")
    parser.add_argument("--verify-structure", action="store_true", help="Run verify_hwpx.py after cloning")
    parser.add_argument("--replace", nargs="*", help="CLI replacement pairs: old=new")
    parser.add_argument("--title", help="Document title metadata")
    parser.add_argument("--creator", help="Document creator metadata")
    parser.add_argument("--validate", action="store_true", help="Validate exact replacement coverage")
    args = parser.parse_args()

    if not os.path.exists(args.source):
        print(f"ERROR: file not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    if args.analyze:
        analyze(args.source)
        return

    if args.auto_analyze:
        auto_analyze(args.source, args.auto_analyze)
        return

    if not args.output:
        print("ERROR: output file is required.", file=sys.stderr)
        sys.exit(1)

    replacements: dict[str, str] = {}
    if args.map:
        replacements = json.loads(Path(args.map).read_text(encoding="utf-8"))
        print(f"Exact replacements: {len(replacements)} ({args.map})")

    if args.replace:
        for pair in args.replace:
            if "=" not in pair:
                print(f"WARNING: invalid replacement ignored: {pair}")
                continue
            old, new = pair.split("=", 1)
            replacements[old] = new
        print(f"CLI replacements added: {len(args.replace)}")

    keywords = None
    if args.keywords:
        keywords = json.loads(Path(args.keywords).read_text(encoding="utf-8"))
        print(f"Keyword replacements: {len(keywords)} ({args.keywords})")

    fill_sections = None
    if args.fill_sections:
        fill_sections = json.loads(Path(args.fill_sections).read_text(encoding="utf-8"))
        print(f"In-place section fills: {len(fill_sections)} ({args.fill_sections})")

    report = clone(
        args.source,
        args.output,
        replacements=replacements,
        keywords=keywords,
        title=args.title,
        creator=args.creator,
        fill_sections=fill_sections,
        strict_fill=args.strict_fill,
        verify=args.verify_structure,
    )
    print(f"Clone complete: {args.output}")
    if fill_sections:
        print(json.dumps(report, ensure_ascii=False, indent=2))

    if args.validate:
        validate_result(args.source, args.output, replacements, keywords)


if __name__ == "__main__":
    main()
