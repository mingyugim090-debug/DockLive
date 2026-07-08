"""로컬 실행기: tool_use 명령을 실제 함수로 라우팅. 예외는 절대 밖으로 던지지 않는다."""
from __future__ import annotations

import json
from dataclasses import dataclass

from tools import excel_tools, file_tools, hwpx_tools


@dataclass
class ToolOutput:
    ok: bool
    text: str  # tool_result content로 그대로 전달되는 문자열


TOOL_REGISTRY = {
    "open_workbook": excel_tools.open_workbook,
    "create_workbook": excel_tools.create_workbook,
    "list_sheets": excel_tools.list_sheets,
    "add_sheet": excel_tools.add_sheet,
    "read_range": excel_tools.read_range,
    "sheet_overview": excel_tools.sheet_overview,
    "aggregate_column": excel_tools.aggregate_column,
    "write_range": excel_tools.write_range,
    "apply_formula": excel_tools.apply_formula,
    "insert_rows": excel_tools.insert_rows,
    "format_range": excel_tools.format_range,
    "create_chart": excel_tools.create_chart,
    "save_workbook": excel_tools.save_workbook,
    "close_workbook": excel_tools.close_workbook,
    "read_document": file_tools.read_document,
    "list_files": file_tools.list_files,
    "compose_hwpx_form": hwpx_tools.compose_hwpx_form,
    "create_hwpx_session": hwpx_tools.create_hwpx_session,
    "draft_hwpx_session": hwpx_tools.draft_hwpx_session,
    "export_hwpx_session": hwpx_tools.export_hwpx_session,
}


def execute(tool_name: str, tool_input: dict) -> ToolOutput:
    fn = TOOL_REGISTRY.get(tool_name)
    if fn is None:
        return ToolOutput(False, f"알 수 없는 도구: {tool_name}")
    try:
        result = fn(**tool_input)  # 각 도구는 {"ok":..., "data"|"error":...} dict 반환
    except TypeError as e:
        return ToolOutput(False, f"인자 오류: {e}")
    except Exception as e:  # 도구가 계약을 어기고 예외를 던진 경우의 최후 방어선
        return ToolOutput(False, f"{tool_name} 실행 중 예외: {type(e).__name__}: {e}")

    ok = bool(result.get("ok"))
    payload = result.get("data") if ok else result.get("error")
    return ToolOutput(ok, json.dumps(payload, ensure_ascii=False, default=str))
