"""COM 없이 돌 수 있는 계약 테스트: 스키마-레지스트리 동기화, 에러 계약."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from executor import dispatcher
from tools.schemas import TOOLS


def test_every_schema_tool_is_registered():
    schema_names = {t["name"] for t in TOOLS}
    registry_names = set(dispatcher.TOOL_REGISTRY)
    assert schema_names == registry_names, (
        f"스키마-레지스트리 불일치: {schema_names ^ registry_names}"
    )


def test_unknown_tool_returns_error_not_exception():
    out = dispatcher.execute("no_such_tool", {})
    assert out.ok is False
    assert "알 수 없는" in out.text


def test_excel_tools_fail_gracefully_without_com():
    out = dispatcher.execute("list_sheets", {})
    assert out.ok is False  # 워크북 미오픈 → 에러 dict, 예외 아님


def test_excel_chart_tool_fails_gracefully_without_open_workbook():
    out = dispatcher.execute(
        "create_chart",
        {"sheet": "견적서", "source_range": "A1:B5", "position": "H2", "chart_type": "bar"},
    )
    assert out.ok is False
    assert "열린 워크북" in out.text


def test_list_files_contract():
    out = dispatcher.execute("list_files", {"dir_path": "/definitely/not/here"})
    assert out.ok is False


def test_validate_document_contract_reports_missing_file():
    schema_names = {tool["name"] for tool in TOOLS}
    assert "validate_document" in schema_names

    out = dispatcher.execute("validate_document", {"path": "/definitely/not/here.xlsx"})

    assert out.ok is False
    assert "file does not exist" in out.text
