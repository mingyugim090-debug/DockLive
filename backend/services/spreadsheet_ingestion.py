"""Spreadsheet/image intake for document workspaces.

CSV is parsed with the stdlib and XLSX with openpyxl. Values come only from
the uploaded file; unreadable inputs yield explicit warnings instead of
content, never fabricated data. Images stay interface-level (OCR later).
"""

import csv
import io

from models.schemas import SheetData, SheetTable

ZIP_MAGIC = b"PK"
XLSX_UNAVAILABLE_WARNING = "XLSX 파서(openpyxl)가 설치되지 않아 읽지 못했습니다. CSV로 변환해 업로드해 주세요."
IMAGE_NOT_SUPPORTED_WARNING = "이미지 인식(OCR)은 아직 지원하지 않습니다."
_MAX_SHEET_ROWS = 500
_MAX_SHEET_COLS = 50

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


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def parse_xlsx(content: bytes, filename: str) -> SheetData:
    try:
        import openpyxl
    except ImportError:
        return SheetData(warnings=[f"{filename}: {XLSX_UNAVAILABLE_WARNING}"])

    try:
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as e:
        return SheetData(warnings=[f"{filename}: XLSX 파일을 읽지 못했습니다: {e}"])

    sheets: list[SheetTable] = []
    warnings: list[str] = []
    try:
        for worksheet in workbook.worksheets:
            rows: list[list[str]] = []
            truncated = False
            for row in worksheet.iter_rows(values_only=True):
                if len(rows) > _MAX_SHEET_ROWS:
                    truncated = True
                    break
                cells = [_cell_text(value) for value in row[:_MAX_SHEET_COLS]]
                if any(cells):
                    rows.append(cells)
            if not rows:
                continue
            headers = rows[0]
            width = len(headers)
            body = [row[:width] + [""] * max(0, width - len(row)) for row in rows[1:]]
            if truncated:
                warnings.append(
                    f"{filename}/{worksheet.title}: 행이 많아 처음 {_MAX_SHEET_ROWS}행까지만 읽었습니다."
                )
            sheets.append(
                SheetTable(
                    name=f"{filename} — {worksheet.title}" if len(workbook.worksheets) > 1 else filename,
                    headers=headers,
                    rows=body,
                    source_ref={"filename": filename, "sheet": worksheet.title, "format": "xlsx"},
                )
            )
    finally:
        workbook.close()

    if not sheets:
        warnings.append(f"{filename}: 비어 있는 XLSX입니다.")
    return SheetData(sheets=sheets, warnings=warnings)


def parse_spreadsheet(content: bytes, filename: str) -> SheetData:
    """Parse an uploaded spreadsheet. Values come only from the file itself."""
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix == "csv":
        return parse_csv(content, filename)
    if suffix in {"xlsx", "xls"} or content[:2] == ZIP_MAGIC:
        return parse_xlsx(content, filename)
    return SheetData(warnings=[f"{filename}: 지원하지 않는 스프레드시트 형식입니다."])


def parse_image_stub(filename: str) -> list[str]:
    return [f"{filename}: {IMAGE_NOT_SUPPORTED_WARNING}"]
