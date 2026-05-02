try:
    from fastapi import HTTPException
except ImportError:

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail


class PDFParseError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=422, detail=detail)


class FileTooLargeError(HTTPException):
    def __init__(self, max_mb: int):
        super().__init__(
            status_code=413,
            detail=f"파일 크기가 {max_mb}MB를 초과합니다.",
        )


class InvalidFileTypeError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=400,
            detail="현재는 PDF 파일만 업로드할 수 있습니다.",
        )


class AnalysisError(HTTPException):
    def __init__(self, detail: str = "AI 분석 중 오류가 발생했습니다. 다시 시도해 주세요."):
        super().__init__(status_code=500, detail=detail)


class WorkflowNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=404,
            detail="워크플로우를 찾을 수 없습니다. 링크가 만료되었거나 서버가 재시작되었을 수 있습니다.",
        )
