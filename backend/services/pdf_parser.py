import fitz  # PyMuPDF
from core.errors import PDFParseError, InvalidFileTypeError


def extract_text_from_pdf(pdf_bytes: bytes, filename: str = "") -> str:
    """PDF 바이트에서 텍스트를 추출합니다."""
    # 파일 확장자 확인
    if filename and not filename.lower().endswith(".pdf"):
        raise InvalidFileTypeError()

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = [doc[i].get_text() for i in range(len(doc))]
        doc.close()

        cleaned = "\n\n".join(pages).strip()

        if not cleaned:
            raise PDFParseError(
                "PDF에서 텍스트를 추출할 수 없습니다. "
                "스캔된 이미지 PDF가 아닌지 확인하세요. "
                "(스캔 PDF의 경우 OCR 처리가 필요합니다)"
            )

        return cleaned

    except fitz.FileDataError:
        raise PDFParseError("손상된 PDF 파일입니다. 다른 파일로 시도해주세요.")
    except (PDFParseError, InvalidFileTypeError):
        raise
    except Exception as e:
        raise PDFParseError(f"PDF 처리 중 오류가 발생했습니다: {str(e)}")
