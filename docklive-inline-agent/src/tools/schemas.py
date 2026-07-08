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
        "name": "create_workbook",
        "description": "빈 Excel 워크북을 새로 열어 실시간 작성 표면을 만든다. 원본 파일이 없거나 새 완성본을 만들 때 사용한다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "선택 저장 경로. 비우면 열기만 한다."},
                "visible": {"type": "boolean", "description": "Excel 창 표시 여부", "default": True},
            },
        },
    },
    {
        "name": "list_sheets",
        "description": "현재 열린 워크북의 시트 이름 목록을 반환한다. 쓰기 전에 구조 파악용으로 사용.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_sheet",
        "description": "현재 열린 워크북에 새 시트를 추가한다. 요약, 차트, 원문근거 등 구조가 필요할 때 사용한다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "추가할 시트 이름"},
            },
            "required": ["name"],
        },
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
        "name": "sheet_overview",
        "description": (
            "시트의 크기(행·열)와 상단 샘플 행을 반환한다. 데이터가 많은 시트는 read_range로 "
            "통째로 읽지 말고 반드시 이 도구로 먼저 구조를 파악한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "sample_rows": {"type": "integer", "description": "미리 볼 상단 행 수 (기본 5, 최대 10)"},
            },
            "required": ["sheet"],
        },
    },
    {
        "name": "aggregate_column",
        "description": (
            "key_range의 값별 개수(count) 또는 value_range 합계(sum)를 집계해 [라벨, 값] 목록을 반환한다. "
            "지역별/유형별 현황처럼 큰 표를 요약해 차트 데이터를 만들 때 사용한다. "
            "값은 전부 원본 셀에서만 계산된다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "key_range": {"type": "string", "description": "그룹 기준 열 범위. 예: 'C9:C500' (헤더 제외)"},
                "value_range": {"type": "string", "description": "agg=sum일 때 합할 숫자 열 범위. 예: 'L9:L500'"},
                "agg": {"type": "string", "enum": ["count", "sum"], "default": "count"},
                "top": {"type": "integer", "description": "상위 몇 개 그룹까지 반환 (기본 30)"},
            },
            "required": ["sheet", "key_range"],
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
        "name": "create_chart",
        "description": (
            "Excel 시트에 차트를 생성한다. 표나 숫자 범위를 먼저 read_range로 확인하고, "
            "필요한 데이터가 있을 때만 사용한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sheet": {"type": "string"},
                "source_range": {"type": "string", "description": "차트 원본 범위. 예: 'A3:B10'"},
                "position": {"type": "string", "description": "차트 좌상단 위치. 예: 'H2'", "default": "H2"},
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "column", "line", "pie"],
                    "description": "차트 유형",
                    "default": "bar",
                },
                "title": {"type": "string", "description": "차트 제목"},
            },
            "required": ["sheet", "source_range"],
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
                "output_dir": {"type": "string", "description": "완성본 저장 폴더. path가 없을 때 사용"},
                "filename": {"type": "string", "description": "완성본 파일명. output_dir와 함께 사용"},
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
        "name": "compose_hwpx_form",
        "description": (
            "HWP/HWPX 양식을 DockLive 백엔드 HWPX 자동작성 파이프라인으로 채우고, "
            "검증된 완성본 HWPX를 로컬 PC에 저장한다. Excel 도구가 아니라 HWPX/HWP 대상 파일에 사용한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "작성할 HWP 또는 HWPX 원본 절대 경로"},
                "request": {"type": "string", "description": "양식 작성 요청"},
                "applicant_context": {"type": "string", "description": "회사/기관/사업 정보 등 추가 입력"},
                "output_path": {"type": "string", "description": "완성본 저장 경로. 비우면 원본 폴더에 자동 저장"},
                "output_dir": {"type": "string", "description": "완성본 저장 폴더. output_path가 없을 때 사용"},
                "filename": {"type": "string", "description": "완성본 파일명. output_dir와 함께 사용"},
                "api_url": {"type": "string", "description": "DockLive API URL. 기본은 LIVEDOCK_API_URL"},
                "title": {"type": "string", "description": "문서 제목 힌트"},
                "open_result": {"type": "boolean", "description": "저장 후 결과 파일 열기", "default": False},
            },
            "required": ["path", "request"],
        },
    },
    {
        "name": "create_hwpx_session",
        "description": "HWP/HWPX 원본을 DockLive 백엔드 HWPX 세션으로 열어 실시간 작성 표면을 만든다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "HWP 또는 HWPX 원본 절대 경로"},
                "api_url": {"type": "string", "description": "DockLive API URL. 기본은 LIVEDOCK_API_URL"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "draft_hwpx_session",
        "description": "열린 HWPX 세션의 입력 영역을 사용자 요청과 근거 자료로 자동 작성한다. 없는 값은 confirmation_required로 남긴다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "create_hwpx_session이 반환한 세션 ID"},
                "base_input": {"type": "string", "description": "사용자 제공 원문/근거 요약"},
                "global_prompt": {"type": "string", "description": "전체 작성 지시"},
                "overwrite_existing": {"type": "boolean", "default": False},
                "api_url": {"type": "string", "description": "DockLive API URL. 기본은 LIVEDOCK_API_URL"},
            },
            "required": ["session_id"],
        },
    },
    {
        "name": "export_hwpx_session",
        "description": "작성된 HWPX 세션을 검증된 HWPX 파일로 내보내고 로컬 PC의 지정 폴더에 저장한다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "내보낼 HWPX 세션 ID"},
                "output_path": {"type": "string", "description": "완성본 저장 경로"},
                "output_dir": {"type": "string", "description": "완성본 저장 폴더"},
                "filename": {"type": "string", "description": "완성본 파일명"},
                "api_url": {"type": "string", "description": "DockLive API URL. 기본은 LIVEDOCK_API_URL"},
                "open_result": {"type": "boolean", "description": "저장 후 결과 파일 열기", "default": False},
            },
            "required": ["session_id"],
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

# OpenAI Chat Completions tool 형식 (loop.py에서 사용). TOOLS가 원본 — 여기서 자동 변환만.
OPENAI_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["input_schema"],
        },
    }
    for tool in TOOLS
]
