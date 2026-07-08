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


def test_list_files_contract():
    out = dispatcher.execute("list_files", {"dir_path": "/definitely/not/here"})
    assert out.ok is False


def test_hwp_tools_fail_gracefully_without_com():
    out = dispatcher.execute("hwp_list_fields", {})
    assert out.ok is False  # 문서 미오픈 → 에러 dict, 예외 아님
    out = dispatcher.execute("hwp_open", {"path": "/tmp/x.hwpx"})
    assert out.ok is False  # 비Windows → 명확한 에러


def test_render_chart_image_contract():
    out = dispatcher.execute("render_chart_image", {
        "chart_type": "bar", "title": "테스트",
        "labels": ["1월", "2월"],
        "series": [{"name": "매출", "values": [10, 20]}],
    })
    import json
    data = json.loads(out.text)
    if out.ok:
        assert "image_path" in data and data["image_path"].endswith(".png")
    else:  # matplotlib 미설치 환경 허용 — 단 예외가 아닌 에러 dict여야 함
        assert isinstance(data, str)


def test_chart_size_mismatch_is_error_not_exception():
    out = dispatcher.execute("render_chart_image", {
        "chart_type": "line", "title": "t",
        "labels": ["a", "b", "c"],
        "series": [{"name": "s", "values": [1, 2]}],
    })
    assert out.ok is False
    assert "불일치" in out.text
