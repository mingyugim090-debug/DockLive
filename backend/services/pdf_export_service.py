from __future__ import annotations

import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

from core.config import settings
from core.errors import AnalysisError

PDF_MEDIA_TYPE = "application/pdf"


def get_pdf_export_status() -> dict[str, Any]:
    """Return HWPX->PDF converter readiness without opening Hancom HWP."""
    warnings: list[str] = []
    script = _converter_script_path()
    python_bin = _converter_python_path()

    if not settings.HWPX_PDF_EXPORT_ENABLED:
        warnings.append("HWPX_PDF_EXPORT_ENABLED=false 상태입니다.")
    if os.name != "nt":
        warnings.append("HWPX→PDF 변환은 Windows Hancom COM 환경에서만 사용할 수 있습니다.")
    if not script.exists():
        warnings.append(f"HWPX→PDF 변환 스크립트를 찾을 수 없습니다: {script}")
    if not python_bin:
        warnings.append("pywin32가 설치된 PDF 변환 Python을 찾을 수 없습니다.")
    elif not _python_has_pywin32(python_bin):
        warnings.append(f"PDF 변환 Python에 pywin32가 없습니다: {python_bin}")
    elif not _python_has_hancom_com(python_bin):
        warnings.append("Hancom HWP COM ProgID(HWPFrame.HwpObject)가 등록되어 있지 않습니다.")

    available = (
        bool(settings.HWPX_PDF_EXPORT_ENABLED)
        and os.name == "nt"
        and script.exists()
        and bool(python_bin)
        and _python_has_pywin32(python_bin)
        and _python_has_hancom_com(python_bin)
    )
    if available:
        warnings.append("Hancom 프로그램 연결은 실제 PDF export 시점에 최종 확인됩니다.")

    return {
        "pdf_export_available": available,
        "pdf_converter": str(python_bin) if python_bin else None,
        "pdf_warnings": list(dict.fromkeys(warnings)),
    }


def convert_hwpx_bytes_to_pdf(
    hwpx_content: bytes,
    title: str,
    source_filename: str | None = None,
) -> tuple[str, bytes, dict[str, Any]]:
    status = get_pdf_export_status()
    if not status["pdf_export_available"]:
        raise AnalysisError("PDF export를 사용할 수 없습니다: " + "; ".join(status["pdf_warnings"]))
    if not hwpx_content.startswith(b"PK"):
        raise AnalysisError("PDF로 변환할 HWPX 파일이 유효한 ZIP 패키지가 아닙니다.")

    safe_title = _safe_title(title or Path(source_filename or "livedock_export").stem)
    tmpdir = _tmp_root() / f"pdf_{uuid.uuid4().hex}"
    tmpdir.mkdir(parents=True, exist_ok=False)
    try:
        input_path = tmpdir / f"{safe_title}.hwpx"
        output_path = tmpdir / f"{safe_title}.pdf"
        input_path.write_bytes(hwpx_content)

        command = [
            str(status["pdf_converter"]),
            str(_converter_script_path()),
            "--input",
            str(input_path),
            "--output",
            str(output_path),
        ]
        done = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=int(settings.HWPX_PDF_TIMEOUT_SECONDS),
            env=_subprocess_env(),
        )
        output = ((done.stdout or "") + (done.stderr or "")).strip()
        if done.returncode != 0:
            raise AnalysisError(f"HWPX→PDF 변환 실패: {output or 'converter returned non-zero exit code'}")
        if not output_path.exists():
            raise AnalysisError("HWPX→PDF 변환은 완료되었지만 PDF 파일이 생성되지 않았습니다.")

        pdf_content = output_path.read_bytes()
        if len(pdf_content) < 100 or not pdf_content.startswith(b"%PDF"):
            raise AnalysisError("생성된 PDF가 올바른 PDF 파일이 아닙니다.")

        summary = {
            "conversion_method": "hancom-com",
            "source_filename": source_filename,
            "pdf_size_bytes": len(pdf_content),
            "converter_output": output[:1000],
            **status,
        }
        return f"{safe_title}.pdf", pdf_content, summary
    except subprocess.TimeoutExpired as exc:
        raise AnalysisError(f"HWPX→PDF 변환 시간이 초과되었습니다: {exc}") from exc
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _converter_script_path() -> Path:
    return Path(__file__).resolve().parents[1] / "hwpx_toolchain" / "scripts" / "hwpx_to_pdf_hancom.py"


def _converter_python_path() -> Path | None:
    configured = settings.HWPX_PDF_PYTHON_PATH.strip()
    candidates: list[Path] = []
    if configured:
        candidates.append(Path(configured))

    repo_root = Path(__file__).resolve().parents[2]
    if os.name == "nt":
        candidates.extend(
            [
                repo_root / "tools" / "hwp-mcp" / ".venv" / "Scripts" / "python.exe",
                Path(sys.executable),
            ]
        )
    else:
        candidates.append(Path(sys.executable))

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _python_has_pywin32(python_bin: Path) -> bool:
    try:
        done = subprocess.run(
            [str(python_bin), "-c", "import win32com.client"],
            capture_output=True,
            text=True,
            timeout=10,
            env=_subprocess_env(),
        )
        return done.returncode == 0
    except Exception:
        return False


def _python_has_hancom_com(python_bin: Path) -> bool:
    try:
        done = subprocess.run(
            [
                str(python_bin),
                "-c",
                "import pythoncom; pythoncom.CLSIDFromProgID('HWPFrame.HwpObject')",
            ],
            capture_output=True,
            text=True,
            timeout=10,
            env=_subprocess_env(),
        )
        return done.returncode == 0
    except Exception:
        return False


def _subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def _safe_title(title: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in title).strip("_") or "livedock_export"


def _tmp_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "outputs" / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root
