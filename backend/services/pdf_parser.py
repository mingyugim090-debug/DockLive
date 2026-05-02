import fitz  # PyMuPDF
from core.errors import InvalidFileTypeError, PDFParseError


def extract_text_from_pdf(pdf_bytes: bytes, filename: str = "") -> str:
    """Extract text from a PDF byte stream."""
    if filename and not filename.lower().endswith(".pdf"):
        raise InvalidFileTypeError()

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = [doc[i].get_text() for i in range(len(doc))]
        doc.close()

        cleaned = "\n\n".join(pages).strip()
        if not cleaned:
            raise PDFParseError(
                "PDF에서 텍스트를 추출할 수 없습니다. 스캔 이미지 PDF인지 확인해 주세요. "
                "스캔 PDF는 OCR 처리가 필요합니다."
            )

        return cleaned

    except fitz.FileDataError:
        raise PDFParseError("손상된 PDF 파일입니다. 다른 파일로 다시 시도해 주세요.")
    except (PDFParseError, InvalidFileTypeError):
        raise
    except Exception as e:
        raise PDFParseError(f"PDF 처리 중 오류가 발생했습니다: {str(e)}")
