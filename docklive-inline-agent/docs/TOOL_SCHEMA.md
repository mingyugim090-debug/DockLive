# TOOL_SCHEMA — 런타임 에이전트 도구 명세

> `src/tools/schemas.py`(정의), `src/tools/excel_tools.py`(구현)와 항상 1:1 동기화할 것.

## 설계 원칙

1. **작고 조합 가능하게**: "견적서를 만들어라" 같은 거대 도구 금지. 모델이 read→write→save를
   조합하도록 원자적 도구만 제공한다.
2. **읽기 먼저**: 시스템 프롬프트가 write 전 read_range/list_sheets로 구조 파악을 강제한다.
3. **모든 응답은 동일 계약**: `{"ok": true, "data": ...}` 또는 `{"ok": false, "error": "..."}`
4. range는 항상 A1 표기 (`"B5"`, `"B5:D7"`). values는 항상 2차원 배열.

## 도구 목록

| # | name | 설명 | 입력 | 비고 |
|---|------|------|------|------|
| 1 | `open_workbook` | Excel 창을 띄우고 파일 열기 | path, visible(bool, 기본 true) | **자동 백업 후** 열림. 같은 파일이 이미 열려 있으면 재사용, 저장된 다른 파일이면 자동으로 닫고 전환 |
| 2 | `create_workbook` | 빈 워크북 새로 열기 | path(선택), visible | 새 완성본 작성용 |
| 3 | `list_sheets` | 시트 이름 목록 | (없음) | 열린 워크북 대상 |
| 4 | `add_sheet` | 시트 추가 | name | 요약/차트 시트용 |
| 5 | `read_range` | 셀 범위 값 읽기 | sheet, range | 병합셀은 좌상단 값. **1200셀 초과 범위는 에러** — sheet_overview/aggregate_column 사용 |
| 6 | `sheet_overview` | 시트 크기·상단 샘플 | sheet, sample_rows? | 대용량 시트 구조 파악 전용 |
| 7 | `aggregate_column` | 열 값별 count/sum 집계 | sheet, key_range, value_range?, agg, top? | 차트 데이터 산출용. 값은 원본 셀에서만 |
| 8 | `write_range` | 셀 범위에 값 쓰기 | sheet, range, values(2D) | range 크기와 values 크기 일치 필수 |
| 9 | `apply_formula` | 수식 입력 | sheet, range, formula | `=SUM(...)` 형태, range 전체에 채움 |
| 10 | `insert_rows` | 행 삽입 | sheet, at_row, count | 양식 표 확장용 |
| 11 | `format_range` | 서식 적용 | sheet, range, bold?, number_format?, bg_color?(hex) | 최소 서식만 |
| 12 | `create_chart` | 차트 생성 | sheet, source_range, position?, chart_type(bar/column/line/pie), title? | 집계표 범위를 원본으로 |
| 13 | `save_workbook` | 저장 | path? / output_dir?+filename? | path 없으면 원본폴더 또는 output_dir에 `_완성본.xlsx` |
| 14 | `close_workbook` | 닫기 | save(bool) | App quit 포함, 좀비 프로세스 방지 |
| 15 | `read_document` | 소스 문서 텍스트 추출 | path | HWPX/DOCX/PDF (Phase 4) |
| 16 | `list_files` | 폴더 파일 목록 | dir_path | 업로드 폴더 탐색용 |
| 17 | `compose_hwpx_form` | HWPX 양식 자동작성 (백엔드 위임) | path, request, … | hwpx_tools.py |
| 18 | `create_hwpx_session` / `draft_hwpx_session` / `export_hwpx_session` | HWPX 세션 흐름 | … | hwpx_tools.py |

## 에러 시맨틱

- 도구는 예외를 던지지 않는다. 에러 문자열은 **모델이 읽고 판단할 수 있게** 구체적으로:
  - 나쁨: `"error"` / 좋음: `"시트 '견적서2'가 없음. 존재하는 시트: ['견적서', 'Sheet1']"`
- dispatcher는 에러 시 tool_result에 `is_error: true`를 설정한다.

## 확장 규칙

새 도구 추가 시: ① 이 문서에 행 추가 → ② schemas.py에 스키마 → ③ excel_tools.py에 구현
→ ④ dispatcher TOOL_REGISTRY 등록 → ⑤ tests에 계약 테스트. 순서 고정.
