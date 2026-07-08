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
| 1 | `open_workbook` | Excel 창을 띄우고 파일 열기 | path, visible(bool, 기본 true) | **자동 백업 후** 열림 |
| 2 | `list_sheets` | 시트 이름 목록 | (없음) | 열린 워크북 대상 |
| 3 | `read_range` | 셀 범위 값 읽기 | sheet, range | 병합셀은 좌상단 값 |
| 4 | `write_range` | 셀 범위에 값 쓰기 | sheet, range, values(2D) | range 크기와 values 크기 일치 필수 |
| 5 | `apply_formula` | 수식 입력 | sheet, range, formula | `=SUM(...)` 형태, range 전체에 채움 |
| 6 | `insert_rows` | 행 삽입 | sheet, at_row, count | 양식 표 확장용 |
| 7 | `format_range` | 서식 적용 | sheet, range, bold?, number_format?, bg_color?(hex) | 최소 서식만 |
| 8 | `save_workbook` | 저장 | path(선택) | path 없으면 원본폴더에 `_완성본.xlsx` |
| 9 | `close_workbook` | 닫기 | save(bool) | App quit 포함, 좀비 프로세스 방지 |
| 10 | `read_document` | 소스 문서 텍스트 추출 | path | HWPX/DOCX/PDF (Phase 4) |
| 11 | `list_files` | 폴더 파일 목록 | dir_path | 업로드 폴더 탐색용 |

## 에러 시맨틱

- 도구는 예외를 던지지 않는다. 에러 문자열은 **모델이 읽고 판단할 수 있게** 구체적으로:
  - 나쁨: `"error"` / 좋음: `"시트 '견적서2'가 없음. 존재하는 시트: ['견적서', 'Sheet1']"`
- dispatcher는 에러 시 tool_result에 `is_error: true`를 설정한다.

## 확장 규칙

새 도구 추가 시: ① 이 문서에 행 추가 → ② schemas.py에 스키마 → ③ excel_tools.py에 구현
→ ④ dispatcher TOOL_REGISTRY 등록 → ⑤ tests에 계약 테스트. 순서 고정.

---
# v2 도구 (12종 추가, 총 23종)

## Excel 시각화
| # | name | 설명 | 입력 | 비고 |
|---|------|------|------|------|
| 12 | `create_chart` | 네이티브 차트 생성 | sheet, data_range, chart_type, title, anchor_cell? | 데이터 입력 후 호출 |
| 13 | `create_table` | Excel 표(ListObject) 변환 | sheet, range, table_name | 헤더 행 포함 필수 |

## 차트 렌더 (한글 삽입용)
| 14 | `render_chart_image` | matplotlib PNG 렌더 | chart_type, title, labels, series | 한글 폰트 자동 처리, workspace/charts/ 저장 |

## 한글(HWP) 실시간 제어
| # | name | 설명 | 입력 | 비고 |
|---|------|------|------|------|
| 15 | `hwp_open` | 한글 창 띄우고 열기 | path | **자동 백업**, 필드 목록 반환 |
| 16 | `hwp_list_fields` | 누름틀 목록 | — | 쓰기 전 구조 파악 |
| 17 | `hwp_fill_field` | 누름틀 채우기 | field_name, text | 양식 채움 1순위 |
| 18 | `hwp_replace_text` | 전체 찾아바꾸기 | find, replace | 플레이스홀더 치환 2순위 |
| 19 | `hwp_insert_text` | 커서 위치 텍스트 삽입 | text | 새 내용 작성 |
| 20 | `hwp_insert_table` | 표 생성+채움 | rows, cols, data(2D) | 크기 일치 필수 |
| 21 | `hwp_insert_image` | 이미지 삽입 | image_path, width_mm? | 차트 PNG 삽입용 |
| 22 | `hwp_save` | 저장 | path? | 기본 `_완성본.hwpx` |
| 23 | `hwp_close` | 닫기 | save? | 좀비 프로세스 방지 |
