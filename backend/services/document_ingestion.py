import html
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path

from core.errors import AnalysisError, InvalidFileTypeError, PDFParseError
from services.drafting_service import _hwpx_subprocess_env, _require_hwpx_scripts
from services.pdf_parser import extract_text_from_pdf


@dataclass(frozen=True)
class IngestedDocument:
    text: str
    source_type: str
    source_name: str
    warnings: list[str]


def ingest_uploaded_document(content: bytes, filename: str) -> IngestedDocument:
    """Extract analyzable text from supported uploaded announcement files."""
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".pdf":
        return IngestedDocument(
            text=extract_text_from_pdf(content, filename),
            source_type="pdf",
            source_name=filename,
            warnings=[],
        )
    if suffix == ".hwpx":
        text, warnings = extract_text_from_hwpx(content)
        return IngestedDocument(text=text, source_type="hwpx", source_name=filename, warnings=warnings)
    if suffix == ".hwp":
        converted, warnings = convert_hwp_to_hwpx(content, filename)
        text, extract_warnings = extract_text_from_hwpx(converted)
        return IngestedDocument(
            text=text,
            source_type="hwp",
            source_name=filename,
            warnings=warnings + extract_warnings,
        )
    raise InvalidFileTypeError("지원하지 않는 파일 형식입니다. PDF, HWPX, HWP 파일을 업로드해 주세요.")


def extract_text_from_hwpx(content: bytes) -> tuple[str, list[str]]:
    """Extract text from HWPX with the skill script, falling back to direct ZIP XML parsing."""
    if not content.startswith(b"PK"):
        raise AnalysisError("업로드한 HWPX 파일이 ZIP 패키지 형식이 아닙니다.")

    warnings: list[str] = []
    tmpdir = _make_tmp_dir()
    try:
        path = tmpdir / "input.hwpx"
        path.write_bytes(content)

        try:
            scripts = _require_hwpx_scripts("text_extract.py")
            completed = subprocess.run(
                [sys.executable or "python", str(scripts["text_extract.py"]), str(path), "--include-tables"],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            text = completed.stdout.strip()
        except Exception as exc:
            warnings.append(f"text_extract.py 실패로 ZIP XML fallback을 사용했습니다: {exc}")
            text = _extract_text_from_hwpx_zip(path)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if len(text.strip()) < 20:
        raise PDFParseError("HWPX에서 분석할 만한 텍스트를 추출하지 못했습니다. 스캔 이미지 기반 문서라면 OCR 처리가 필요합니다.")
    return text, warnings


def convert_hwp_to_hwpx(content: bytes, filename: str) -> tuple[bytes, list[str]]:
    """Convert HWP bytes to HWPX through the configured HWPX toolchain."""
    warnings: list[str] = []
    scripts = _require_hwpx_scripts("convert_hwp.py", "fix_namespaces.py", "validate.py")

    tmpdir = _make_tmp_dir()
    try:
        input_path = tmpdir / (Path(filename or "input.hwp").name or "input.hwp")
        output_path = tmpdir / f"{input_path.stem}.hwpx"
        input_path.write_bytes(content)

        try:
            subprocess.run(
                [sys.executable or "python", str(scripts["convert_hwp.py"]), str(input_path), "-o", str(output_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            subprocess.run(
                [sys.executable or "python", str(scripts["fix_namespaces.py"]), str(output_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
            subprocess.run(
                [sys.executable or "python", str(scripts["validate.py"]), str(output_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=_hwpx_subprocess_env(),
            )
        except subprocess.CalledProcessError as exc:
            detail = "\n".join(part for part in [exc.stdout, exc.stderr] if part).strip()
            raise AnalysisError(
                "HWP를 HWPX로 변환하지 못했습니다. 변환 도구와 의존성이 설치되어 있는지 확인해 주세요."
                + (f" 상세: {detail[:1000]}" if detail else "")
            ) from exc

        if not output_path.exists():
            raise AnalysisError("HWP 변환은 완료되었지만 출력 HWPX 파일을 찾지 못했습니다.")
        warnings.append("HWP 원본은 HWPX로 변환한 뒤 텍스트를 추출했습니다.")
        return output_path.read_bytes(), warnings
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _extract_text_from_hwpx_zip(path: Path) -> str:
    texts: list[str] = []
    try:
        with zipfile.ZipFile(path, "r") as zf:
            for name in zf.namelist():
                if name.startswith("Contents/") and name.endswith(".xml"):
                    data = zf.read(name).decode("utf-8", errors="replace")
                    for match in re.finditer(r"<hp:t[^>]*>(.*?)</hp:t>", data, re.DOTALL):
                        clean = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                        if clean:
                            texts.append(html.unescape(clean))
    except zipfile.BadZipFile as exc:
        raise AnalysisError("올바른 HWPX ZIP 파일이 아닙니다.") from exc
    return "\n".join(texts)


def _workspace_tmp_root() -> Path:
    root = Path(__file__).resolve().parents[1] / ".tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _make_tmp_dir() -> Path:
    path = _workspace_tmp_root() / f"livedock_{uuid.uuid4().hex}"
    path.mkdir(parents=False, exist_ok=False)
    return path
