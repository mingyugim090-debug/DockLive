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
