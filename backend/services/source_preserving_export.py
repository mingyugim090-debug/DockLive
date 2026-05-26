import base64

from core.errors import AnalysisError
from models.schemas import WorkflowSession
from services.document_ingestion import convert_hwp_to_hwpx
from services.hwpx_compose_service import compose_hwpx


def is_hwpx_like_source(source: dict | None) -> bool:
    if not source:
        return False
    filename = str(source.get("filename") or "").lower()
    return filename.endswith(".hwpx") or (filename.endswith(".hwp") and not filename.endswith(".hwpx"))


def build_source_preserving_hwpx(workflow: WorkflowSession, source: dict | None) -> tuple[str, bytes, dict]:
    """Build a final HWPX by cloning the uploaded HWP/HWPX source form.

    This intentionally refuses to fall back to markdown generation. For uploaded
    HWP/HWPX forms, a line-only HWPX is worse than an explicit failure because it
    silently loses tables, field positions, and official formatting.
    """
    if not source:
        raise AnalysisError("원본 HWP/HWPX 파일을 찾지 못해 양식 보존 HWPX를 생성할 수 없습니다.")
    filename = str(source.get("filename") or workflow.analysis.source_name or "source.hwpx")
    content = source.get("content")
    if not isinstance(content, (bytes, bytearray)):
        raise AnalysisError("저장된 원본 파일 내용을 불러오지 못했습니다.")

    warnings: list[str] = []
    hwpx_content = bytes(content)
    lower_name = filename.lower()
    if lower_name.endswith(".hwp") and not lower_name.endswith(".hwpx"):
        try:
            hwpx_content, warnings = convert_hwp_to_hwpx(hwpx_content, filename)
        except AnalysisError as exc:
            raise AnalysisError(
                "원본 HWP의 표/서식 보존 변환에 실패했습니다. "
                "줄글 HWPX fallback은 원본 양식을 훼손하므로 차단했습니다. "
                "backend/requirements.txt 의 olefile, pyhwp/pyhwp2, lxml 설치 상태를 확인해 주세요. "
                f"상세: {exc}"
            ) from exc
    elif not lower_name.endswith(".hwpx"):
        raise AnalysisError("원본 양식 보존 export는 HWP 또는 HWPX 업로드에만 사용할 수 있습니다.")

    try:
        composed = compose_hwpx(
            hwpx_content,
            request_text=_source_workflow_request_text(workflow),
            applicant_context=_source_applicant_context(workflow),
            title=workflow.final_document.title if workflow.final_document else workflow.analysis.title,
        )
    except AnalysisError as exc:
        raise AnalysisError(
            "원본 양식 기반 HWPX 자동 작성에 실패했습니다. "
            "표/서식 없는 줄글 HWPX fallback은 사용하지 않습니다. "
            f"상세: {exc}"
        ) from exc

    result_content = base64.b64decode(composed["content"])
    summary = dict(composed.get("validation_summary") or {})
    summary["generation_method"] = "source-preserving-compose"
    summary["source_filename"] = filename
    summary["warnings"] = list(dict.fromkeys(warnings + composed.get("warnings", []) + summary.get("warnings", [])))
    return composed["filename"], result_content, summary


def _source_workflow_request_text(workflow: WorkflowSession) -> str:
    assert workflow.final_document is not None
    input_lines = [
        f"{field.label}: {field.value}"
        for field in workflow.user_inputs
        if str(field.value or "").strip()
    ]
    draft_lines = [
        f"## {draft.title}\n{draft.content_markdown}"
        for draft in workflow.draft_sections
        if str(draft.content_markdown or "").strip()
    ]
    parts = [
        f"# {workflow.final_document.title}",
        "아래 내용은 업로드 원본 HWP/HWPX 양식의 기존 입력칸에만 삽입한다.",
        "원본에 없는 개인정보, 날짜, 금액, 기관명은 새로 만들지 않는다.",
        workflow.analysis.summary,
        "\n".join(input_lines),
        "\n\n".join(draft_lines),
        workflow.final_document.content_markdown,
    ]
    return "\n\n".join(part for part in parts if str(part or "").strip())


def _source_applicant_context(workflow: WorkflowSession) -> str:
    return "\n".join(
        f"{field.label}: {field.value}"
        for field in workflow.user_inputs
        if str(field.value or "").strip()
    )
