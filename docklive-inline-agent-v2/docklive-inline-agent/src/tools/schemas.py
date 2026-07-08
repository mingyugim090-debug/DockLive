"""런타임 에이전트 tool schema.

docs/TOOL_SCHEMA.md 와 1:1 동기화 유지. (Stop hook이 dispatcher 등록 여부를 검사함)
"""

TOOLS: list[dict] = [
    {
        "name": "open_workbook",
        "description": (
            "Excel 창을 띄우고 워크북을 연다. 열기 전에 자동으로 백업본이 생성된다. "
            "모든 작업의 첫 단계. 이미 열려 있으면 그 사실을 알려준다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "열 파일의 절대 경로 (.xlsx/.xlsm)"},
                "visible": {"type": "boolean", "description": "Excel 창 표시 여부", "default": True},
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_sheets",
        "description": "현재 열린 워크북의 시트 이름 목록을 반환한다. 쓰기 전에 구조 파악용으로 사용.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "read_range",
        "description": (
            "지정 범위의 셀 값을 2차원 배열로 읽는다. 양식의 기존 구조(헤더, 라벨 위치)를 "
            "파악할 때 반드시 write 전에 먼저 사용한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string", "description": "시트 이름"},
                "range": {"type": "string", "description": "A1 표기 범위. 예: 'A1:F20'"},
            },
            "required": ["sheet", "range"],
        },
    },
    {
        "name": "write_range",
        "description": (
            "지정 범위에 값을 쓴다. values는 반드시 2차원 배열이며 range 크기와 정확히 일치해야 한다. "
            "예: range='B5:C6' 이면 values=[[1,2],[3,4]]. 한 셀이면 range='B5', values=[[값]]."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "range": {"type": "string"},
                "values": {
                    "type": "array",
                    "items": {"type": "array"},
                    "description": "2차원 배열 (행 x 열)",
                },
            },
            "required": ["sheet", "range", "values"],
        },
    },
    {
        "name": "apply_formula",
        "description": "범위에 Excel 수식을 입력한다. formula는 '='로 시작. 예: '=SUM(C5:C10)'",
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "range": {"type": "string"},
                "formula": {"type": "string"},
            },
            "required": ["sheet", "range", "formula"],
        },
    },
    {
        "name": "insert_rows",
        "description": "지정 위치에 빈 행을 삽입한다. 양식 표에 품목 수가 부족할 때 사용.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "at_row": {"type": "integer", "description": "이 행 번호 위치에 삽입 (1부터)"},
                "count": {"type": "integer", "default": 1},
            },
            "required": ["sheet", "at_row"],
        },
    },
    {
        "name": "format_range",
        "description": "최소한의 서식(굵게, 표시형식, 배경색)을 적용한다. 과한 서식 변경은 지양.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "range": {"type": "string"},
                "bold": {"type": "boolean"},
                "number_format": {"type": "string", "description": "예: '#,##0' 또는 'yyyy-mm-dd'"},
                "bg_color": {"type": "string", "description": "hex. 예: '#FFF2CC'"},
            },
            "required": ["sheet", "range"],
        },
    },
    {
        "name": "save_workbook",
        "description": (
            "워크북을 저장한다. path를 주면 SaveAs, 생략하면 원본 폴더에 "
            "'{원본이름}_완성본.xlsx'로 저장한다. 작업 마지막에 반드시 호출."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "저장 경로 (선택)"},
            },
        },
    },
    {
        "name": "close_workbook",
        "description": "워크북과 Excel 앱을 정리한다. save=false면 저장하지 않고 닫는다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "save": {"type": "boolean", "default": False},
            },
        },
    },
    {
        "name": "read_document",
        "description": (
            "소스 문서(HWPX/DOCX/PDF)의 텍스트와 표를 추출한다. "
            "사용자가 첨부한 참고자료의 내용을 파악할 때 사용."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_files",
        "description": "폴더의 파일 목록을 반환한다. 사용자가 파일명을 정확히 모를 때 탐색용.",
        "input_schema": {
            "type": "object",
            "properties": {
                "dir_path": {"type": "string"},
            },
            "required": ["dir_path"],
        },
    },
]


# ─── v2 확장: 시각화 (Excel) ───────────────────────────────────────────────
TOOLS += [
    {
        "name": "create_chart",
        "description": (
            "열린 Excel 워크북에 네이티브 차트를 생성한다. data_range의 데이터를 사용하며 "
            "차트는 시트 위에 실시간으로 나타난다. 데이터를 먼저 write_range로 채운 뒤 호출."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "data_range": {"type": "string", "description": "차트 원본 데이터 범위. 헤더 포함. 예: 'A1:C10'"},
                "chart_type": {
                    "type": "string",
                    "enum": ["line", "column_clustered", "bar_clustered", "pie", "xy_scatter", "area"],
                },
                "title": {"type": "string", "description": "차트 제목"},
                "anchor_cell": {"type": "string", "description": "차트 좌상단 위치 셀. 예: 'E2'", "default": "E2"},
            },
            "required": ["sheet", "data_range", "chart_type", "title"],
        },
    },
    {
        "name": "create_table",
        "description": (
            "지정 범위를 Excel 표(ListObject)로 변환한다. 자동 필터·줄무늬 서식이 적용된다. "
            "범위에는 헤더 행이 포함되어야 한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "range": {"type": "string", "description": "헤더 포함 범위. 예: 'A1:D15'"},
                "table_name": {"type": "string", "description": "표 이름 (영문, 공백 없이)"},
            },
            "required": ["sheet", "range", "table_name"],
        },
    },
    # ─── v2 확장: 차트 이미지 렌더 (한글 삽입용) ─────────────────────────
    {
        "name": "render_chart_image",
        "description": (
            "matplotlib으로 차트를 PNG 이미지로 렌더링한다. 한글(HWP) 문서에 차트를 넣을 때 "
            "이 도구로 먼저 렌더한 뒤 hwp_insert_image로 삽입한다. Excel에는 create_chart를 쓸 것."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "chart_type": {"type": "string", "enum": ["line", "bar", "pie", "scatter"]},
                "title": {"type": "string"},
                "labels": {"type": "array", "items": {"type": "string"}, "description": "x축 라벨 또는 파이 조각 이름"},
                "series": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "values": {"type": "array", "items": {"type": "number"}},
                        },
                        "required": ["name", "values"],
                    },
                    "description": "데이터 시리즈 목록. pie는 첫 시리즈만 사용.",
                },
            },
            "required": ["chart_type", "title", "labels", "series"],
        },
    },
    # ─── v2 확장: 한글(HWP) 실시간 제어 ──────────────────────────────────
    {
        "name": "hwp_open",
        "description": (
            "한글 창을 띄우고 HWP/HWPX 파일을 연다 (자동 백업 후). 모든 한글 작업의 첫 단계. "
            "결과에 문서의 누름틀(필드) 목록이 포함되므로 이것으로 양식 구조를 파악한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": ".hwp 또는 .hwpx 절대 경로"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "hwp_list_fields",
        "description": "열린 한글 문서의 누름틀(필드) 이름 목록을 반환한다. 쓰기 전 구조 파악용.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "hwp_fill_field",
        "description": "누름틀(필드)에 텍스트를 채운다. 양식 채우기의 1순위 방법.",
        "input_schema": {
            "type": "object",
            "properties": {
                "field_name": {"type": "string"},
                "text": {"type": "string"},
            },
            "required": ["field_name", "text"],
        },
    },
    {
        "name": "hwp_replace_text",
        "description": (
            "문서 전체에서 찾아바꾸기를 수행한다. 누름틀이 없는 양식에서 '{{회사명}}' 같은 "
            "플레이스홀더를 치환할 때 사용 (2순위 방법)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "find": {"type": "string"},
                "replace": {"type": "string"},
            },
            "required": ["find", "replace"],
        },
    },
    {
        "name": "hwp_insert_text",
        "description": "현재 커서 위치에 텍스트를 삽입한다. 문서 끝에 새 내용을 작성할 때 사용.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "삽입할 텍스트. 줄바꿈은 \\n"},
            },
            "required": ["text"],
        },
    },
    {
        "name": "hwp_insert_table",
        "description": (
            "현재 커서 위치에 표를 생성하고 데이터를 채운다. data는 헤더 행 포함 2차원 배열이며 "
            "rows x cols 크기와 정확히 일치해야 한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "rows": {"type": "integer"},
                "cols": {"type": "integer"},
                "data": {"type": "array", "items": {"type": "array"}, "description": "2차원 배열 (행 x 열)"},
            },
            "required": ["rows", "cols", "data"],
        },
    },
    {
        "name": "hwp_insert_image",
        "description": (
            "현재 커서 위치에 이미지를 삽입한다. render_chart_image로 만든 차트 PNG를 "
            "한글 문서에 넣는 용도가 대표적."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "image_path": {"type": "string"},
                "width_mm": {"type": "integer", "description": "가로 크기(mm). 기본 120", "default": 120},
            },
            "required": ["image_path"],
        },
    },
    {
        "name": "hwp_save",
        "description": "한글 문서를 저장한다. path 생략 시 원본 폴더에 '{원본이름}_완성본.hwpx'로 저장.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "저장 경로 (선택, .hwpx 권장)"},
            },
        },
    },
    {
        "name": "hwp_close",
        "description": "한글 문서와 앱을 정리한다. save=false면 저장 없이 닫는다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "save": {"type": "boolean", "default": False},
            },
        },
    },
]
