"""Spreadsheet/image intake for document workspaces.

CSV is parsed for real with the stdlib (no new dependency). XLSX and images
are interface-level only in v1: they yield explicit warnings instead of
content, never fabricated data.
"""

import csv
import io

from models.schemas import SheetData, SheetTable

ZIP_MAGIC = b"PK"
XLSX_NOT_SUPPORTED_WARNING = "XLSX 파싱은 2차에서 지원 예정입니다. CSV로 변환해 업로드해 주세요."
IMAGE_NOT_SUPPORTED_WARNING = "이미지 인식(OCR)은 2차에서 지원 예정입니다."

_CSV_ENCODINGS = ("utf-8-sig", "utf-8", "cp949")


def _decode_csv(content: bytes) -> str | None:
    for encoding in _CSV_ENCODINGS:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return None


def parse_csv(content: bytes, filename: str) -> SheetData:
    text = _decode_csv(content)
    if text is None:
        return SheetData(warnings=[f"{filename}: 인코딩을 인식하지 못해 CSV를 읽지 못했습니다."])

    try:
        rows = [row for row in csv.reader(io.StringIO(text)) if any(cell.strip() for cell in row)]
    except csv.Error as e:
        return SheetData(warnings=[f"{filename}: CSV 구문을 해석하지 못했습니다: {e}"])

    if not rows:
        return SheetData(warnings=[f"{filename}: 비어 있는 CSV입니다."])

    headers = [cell.strip() for cell in rows[0]]
    width = len(headers)
    body = [[cell.strip() for cell in row[:width]] + [""] * max(0, width - len(row)) for row in rows[1:]]
    return SheetData(
        sheets=[
            SheetTable(
                name=filename,
                headers=headers,
                rows=body,
                source_ref={"filename": filename, "format": "csv"},
            )
        ]
    )


def parse_spreadsheet(content: bytes, filename: str) -> SheetData:
    """Parse an uploaded spreadsheet. Values come only from the file itself."""
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix == "csv":
        return parse_csv(content, filename)
    if suffix in {"xlsx", "xls"} or content[:2] == ZIP_MAGIC:
        return SheetData(warnings=[XLSX_NOT_SUPPORTED_WARNING])
    return SheetData(warnings=[f"{filename}: 지원하지 않는 스프레드시트 형식입니다."])


def parse_image_stub(filename: str) -> list[str]:
    return [f"{filename}: {IMAGE_NOT_SUPPORTED_WARNING}"]
