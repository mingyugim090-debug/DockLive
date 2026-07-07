"""Deterministic inline block transforms (v1 mock commands).

No LLM here: a paragraph becomes a table only when its structure is
recognizable, and chart values come only from the existing table cells.
Unrecognizable input raises a clear error instead of inventing content.
"""

import re

from core.errors import AnalysisError
from models.schemas import (
    ChartSeries,
    ChartSpec,
    InlineTransformRequest,
    ParsedTableCell,
    VisualBlock,
)
from services import workspace_service

_PAIR_PATTERN = re.compile(r"^\s*(?:[-*•]\s*)?([^:：]{1,40})\s*[:：]\s*(.+?)\s*$")
_NUMBER_STRIP_PATTERN = re.compile(r"[,\s%원₩$]")


def _cell(text: str, row: int, col: int) -> ParsedTableCell:
    return ParsedTableCell(text=text, row_index=row, col_index=col)


def parse_number(text: str) -> float | None:
    cleaned = _NUMBER_STRIP_PATTERN.sub("", text.strip())
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def paragraph_to_table(markdown: str) -> list[list[ParsedTableCell]]:
    pairs: list[tuple[str, str]] = []
    for line in markdown.splitlines():
        if not line.strip():
            continue
        match = _PAIR_PATTERN.match(line)
        if match:
            pairs.append((match.group(1).strip(), match.group(2).strip()))

    if not pairs:
        raise AnalysisError("표로 변환할 항목 구조를 찾지 못했습니다. '항목: 내용' 형식의 줄이 필요합니다.")

    rows = [[_cell("항목", 0, 0), _cell("내용", 0, 1)]]
    for index, (label, value) in enumerate(pairs, start=1):
        rows.append([_cell(label, index, 0), _cell(value, index, 1)])
    return rows


def _chart_type_from_instruction(instruction: str) -> str:
    lowered = instruction.lower()
    if "line" in lowered or "꺾은선" in instruction or "추이" in instruction:
        return "line"
    if "pie" in lowered or "원형" in instruction or "비율" in instruction:
        return "pie"
    return "bar"


def table_to_chart(rows: list[list[ParsedTableCell]], title: str = "", instruction: str = "") -> ChartSpec:
    if len(rows) < 2 or len(rows[0]) < 2:
        raise AnalysisError("그래프로 변환하려면 머리글과 데이터 행이 있는 표가 필요합니다.")

    header = [cell.text.strip() for cell in rows[0]]
    body = rows[1:]
    labels = [row[0].text.strip() if row else "" for row in body]

    series: list[ChartSeries] = []
    for col in range(1, len(header)):
        values: list[float] = []
        for row in body:
            text = row[col].text if col < len(row) else ""
            number = parse_number(text)
            if number is None:
                values = []
                break
            values.append(number)
        if values:
            series.append(ChartSeries(name=header[col] or f"열 {col + 1}", values=values))

    if not series:
        raise AnalysisError("그래프로 변환할 숫자 열을 찾지 못했습니다. 숫자로만 구성된 열이 필요합니다.")

    return ChartSpec(
        chart_type=_chart_type_from_instruction(instruction),
        title=title,
        labels=labels,
        series=series,
    )


def rewrite_block(markdown: str) -> str:
    # v1 mock: whitespace normalization only — no content is created or removed.
    lines = [re.sub(r"[ \t]+", " ", line.strip()) for line in markdown.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def apply_transform(workspace_id: str, block_id: str, request: InlineTransformRequest) -> VisualBlock:
    workspace = workspace_service.get_workspace(workspace_id)
    if workspace.document is None:
        raise AnalysisError("아직 생성된 문서가 없습니다.")

    block = next((item for item in workspace.document.blocks if item.id == block_id), None)
    if block is None:
        raise AnalysisError("해당 블록을 찾을 수 없습니다.")

    if request.command == "to_table":
        if block.kind != "paragraph":
            raise AnalysisError("문단 블록만 표로 변환할 수 있습니다.")
        block.rows = paragraph_to_table(block.markdown)
        block.kind = "table"
        block.markdown = ""
    elif request.command == "to_chart":
        if block.kind != "table":
            raise AnalysisError("표 블록만 그래프로 변환할 수 있습니다.")
        block.chart = table_to_chart(block.rows, title="", instruction=request.instruction)
        block.kind = "chart"
        # rows are kept so exports can fall back to the source table.
    elif request.command == "rewrite":
        if block.kind != "paragraph":
            raise AnalysisError("문단 블록만 다듬을 수 있습니다.")
        block.markdown = rewrite_block(block.markdown)
    else:
        raise AnalysisError("지원하지 않는 변환 명령입니다.")

    block.status = "revised"
    workspace_service.save_workspace(workspace)
    return block
