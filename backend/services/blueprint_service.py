"""Deterministic document blueprint + generation for workspaces (v1).

Every planned visual and every generated value traces back to an uploaded
file (parsed table or spreadsheet). Sections without grounded material get a
confirmation item, never invented content. LLM synthesis is a later phase.
"""

from uuid import uuid4

from core.errors import AnalysisError
from models.schemas import (
    BlueprintSection,
    DocumentBlueprint,
    DocumentWorkspace,
    GeneratedDocument,
    ParsedTableCell,
    ProjectFile,
    SheetTable,
    VisualBlock,
    VisualPlan,
)
from services import workspace_service
from services.block_transforms import parse_number, table_to_chart

_DEFAULT_SECTIONS = ["사업 개요", "추진 배경 및 필요성", "사업 내용", "예산 계획", "추진 일정"]

_SECTION_KEYWORD_HINTS: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
    # (section title keywords, data keywords)
    (("예산", "비용", "자금", "재정"), ("예산", "금액", "비용", "단가", "원", "천원", "백만원")),
    (("일정", "계획", "추진"), ("일정", "월", "분기", "기간", "단계")),
    (("성과", "지표", "kpi", "목표"), ("kpi", "지표", "목표", "성과", "건수", "%")),
]


class _DataAsset:
    """A grounded table-like asset discovered in uploaded files."""

    def __init__(self, ref: str, title: str, rows: list[list[ParsedTableCell]], file_id: str):
        self.ref = ref
        self.title = title
        self.rows = rows
        self.file_id = file_id

    @property
    def has_numeric_column(self) -> bool:
        if len(self.rows) < 2:
            return False
        body = self.rows[1:]
        for col in range(1, max(len(row) for row in self.rows)):
            values = [parse_number(row[col].text) for row in body if col < len(row)]
            if values and all(value is not None for value in values):
                return True
        return False

    @property
    def search_text(self) -> str:
        header = " ".join(cell.text for cell in self.rows[0]) if self.rows else ""
        return f"{self.title} {header}".lower()


def _cell(text: str, row: int, col: int) -> ParsedTableCell:
    return ParsedTableCell(text=str(text), row_index=row, col_index=col)


def _sheet_to_rows(sheet: SheetTable) -> list[list[ParsedTableCell]]:
    rows = [[_cell(header, 0, col) for col, header in enumerate(sheet.headers)]]
    for row_index, row in enumerate(sheet.rows, start=1):
        rows.append([_cell(value, row_index, col) for col, value in enumerate(row)])
    return rows


def _collect_assets(files: list[ProjectFile]) -> list[_DataAsset]:
    assets: list[_DataAsset] = []
    for project_file in files:
        if project_file.parsed:
            for table in project_file.parsed.tables:
                if table.rows:
                    assets.append(
                        _DataAsset(
                            ref=f"{project_file.id}:{table.id}",
                            title=f"{project_file.filename} 표",
                            rows=table.rows,
                            file_id=project_file.id,
                        )
                    )
        if project_file.sheet_data:
            for index, sheet in enumerate(project_file.sheet_data.sheets):
                if sheet.headers:
                    assets.append(
                        _DataAsset(
                            ref=f"{project_file.id}:sheet-{index}",
                            title=sheet.name or project_file.filename,
                            rows=_sheet_to_rows(sheet),
                            file_id=project_file.id,
                        )
                    )
    return assets


def _match_section(asset: _DataAsset, sections: list[BlueprintSection]) -> BlueprintSection | None:
    for title_keywords, data_keywords in _SECTION_KEYWORD_HINTS:
        if any(keyword in asset.search_text for keyword in data_keywords):
            for section in sections:
                lowered = section.title.lower()
                if any(keyword in lowered for keyword in title_keywords):
                    return section
    return None


def build_blueprint(workspace: DocumentWorkspace) -> DocumentBlueprint:
    if not workspace.files:
        raise AnalysisError("파일을 먼저 추가해 주세요.")

    if workspace.analysis and workspace.analysis.document_template:
        template = sorted(workspace.analysis.document_template, key=lambda item: item.order)
        sections = [
            BlueprintSection(id=f"bs-{index}", title=item.title, intent=item.hint)
            for index, item in enumerate(template, start=1)
        ]
        rationale = "공고 분석에서 추출한 제출 문서 구성을 따랐습니다."
    else:
        sections = [
            BlueprintSection(id=f"bs-{index}", title=title)
            for index, title in enumerate(_DEFAULT_SECTIONS, start=1)
        ]
        rationale = "공고에서 문서 구성을 찾지 못해 기본 사업계획서 골격을 사용했습니다."

    assets = _collect_assets(workspace.files)
    fallback_section = next(
        (section for section in sections if "내용" in section.title), sections[min(1, len(sections) - 1)]
    )
    for asset in assets:
        section = _match_section(asset, sections) or fallback_section
        section.planned_visuals.append(VisualPlan(kind="table", title=asset.title, source_ref=asset.ref))
        if asset.has_numeric_column:
            section.planned_visuals.append(
                VisualPlan(kind="chart", title=f"{asset.title} 그래프", source_ref=asset.ref)
            )
        if asset.file_id not in section.source_file_ids:
            section.source_file_ids.append(asset.file_id)

    confirmation_required = [
        f"'{section.title}' 섹션은 업로드 자료에 근거가 없어 직접 입력이 필요합니다."
        for section in sections
        if not section.planned_visuals and not _section_text_available(section, workspace)
    ]

    blueprint = DocumentBlueprint(
        id=f"bp-{uuid4()}",
        sections=sections,
        rationale=rationale,
        confirmation_required=confirmation_required,
    )
    workspace.blueprint = blueprint
    workspace.status = "blueprint_ready"
    workspace_service.save_workspace(workspace)
    return blueprint


def _section_text_available(section: BlueprintSection, workspace: DocumentWorkspace) -> bool:
    return bool(_section_paragraph(section, workspace))


def _section_paragraph(section: BlueprintSection, workspace: DocumentWorkspace) -> str:
    """Grounded paragraph content for a section — only extracted analysis text."""
    analysis = workspace.analysis
    if analysis is None:
        return ""
    title = section.title.lower()
    if "개요" in title and analysis.summary:
        return analysis.summary
    if any(keyword in title for keyword in ("대상", "자격")) and analysis.eligibility:
        return "\n".join(f"- {item}" for item in analysis.eligibility)
    if any(keyword in title for keyword in ("제출", "서류")) and analysis.checklist:
        return "\n".join(f"- {item.label}" for item in analysis.checklist)
    if any(keyword in title for keyword in ("평가", "심사")) and analysis.evaluation_criteria:
        return "\n".join(f"- {item}" for item in analysis.evaluation_criteria)
    if "일정" in title and analysis.timeline:
        return "\n".join(f"- {item.label}: {item.date}" for item in analysis.timeline)
    return ""


def generate_document(workspace: DocumentWorkspace) -> GeneratedDocument:
    if workspace.blueprint is None:
        raise AnalysisError("문서 구조 설계를 먼저 실행해 주세요.")

    assets = {asset.ref: asset for asset in _collect_assets(workspace.files)}
    title = (
        f"{workspace.analysis.title} 사업계획서"
        if workspace.analysis and workspace.analysis.title
        else workspace.title or "새 문서"
    )
    blocks: list[VisualBlock] = []
    warnings: list[str] = []
    block_index = 0

    def _next_id() -> str:
        nonlocal block_index
        block_index += 1
        return f"blk-{block_index}"

    for section in workspace.blueprint.sections:
        blocks.append(
            VisualBlock(id=_next_id(), section_id=section.id, kind="heading", markdown=section.title)
        )

        paragraph = _section_paragraph(section, workspace)
        if paragraph:
            blocks.append(
                VisualBlock(
                    id=_next_id(),
                    section_id=section.id,
                    kind="paragraph",
                    markdown=paragraph,
                    source_refs=[workspace.analysis.id] if workspace.analysis else [],
                )
            )
        elif not section.planned_visuals:
            blocks.append(
                VisualBlock(
                    id=_next_id(),
                    section_id=section.id,
                    kind="paragraph",
                    markdown="이 섹션의 내용을 입력해 주세요. (업로드 자료에 관련 근거 없음)",
                    status="needs_input",
                )
            )

        for plan in section.planned_visuals:
            asset = assets.get(plan.source_ref)
            if asset is None:
                warnings.append(f"'{plan.title}' 자료를 찾지 못해 건너뛰었습니다.")
                continue
            if plan.kind == "table":
                blocks.append(
                    VisualBlock(
                        id=_next_id(),
                        section_id=section.id,
                        kind="table",
                        rows=asset.rows,
                        source_refs=[plan.source_ref],
                    )
                )
            elif plan.kind == "chart":
                try:
                    chart = table_to_chart(asset.rows, title=plan.title)
                except AnalysisError as e:
                    warnings.append(f"'{plan.title}' 그래프 생성 건너뜀: {e}")
                    continue
                chart.source_table_id = plan.source_ref
                blocks.append(
                    VisualBlock(
                        id=_next_id(),
                        section_id=section.id,
                        kind="chart",
                        rows=asset.rows,
                        chart=chart,
                        source_refs=[plan.source_ref],
                    )
                )

    document = GeneratedDocument(id=f"doc-{uuid4()}", title=title, blocks=blocks, warnings=warnings)

    from services.workspace_drafting import synthesize_paragraphs

    document = synthesize_paragraphs(workspace, document)
    workspace.document = document
    workspace.status = "generated"
    workspace_service.save_workspace(workspace)
    return document
