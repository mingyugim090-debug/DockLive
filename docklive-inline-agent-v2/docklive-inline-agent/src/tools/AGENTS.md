# src/tools 규약 (Codex: 이 폴더 작업 시 이 규칙이 루트 규칙에 우선 적용됨)

## 공통 계약
- 모든 도구 함수: `{"ok": True, "data": ...}` 또는 `{"ok": False, "error": "구체적 원인 + 대안"}`
- 함수명 = schemas.py의 "name" 과 1:1. 시그니처 파라미터명 = input_schema 프로퍼티명.
- 예외 전파 금지. COM 에러는 잡아서 한국어로 번역 (파일 잠김/시트·필드 없음/범위 오류).
- 반환 데이터는 JSON 직렬화 가능해야 함 (datetime → isoformat).

## excel_tools.py
- ExcelSession 싱글턴 경유. `_require_book()` / `_get_sheet()` 헬퍼 재사용.
- 차트: `sheet.charts.add()` 사용, chart_type은 xlwings 명칭
  ('line', 'column_clustered', 'pie', 'bar_clustered', 'xy_scatter').
- 표: `sheet.tables.add()` (Excel ListObject). 이미 표가 있는 범위면 에러 반환.

## hwp_tools.py
- HwpSession 싱글턴. 작성 전 docs/HWP_COM_GUIDE.md 정독 필수.
- 우선순위: PutFieldText > 찾아바꾸기 > 커서 이동. 누름틀 목록(hwp_list_fields)이
  Excel의 read_range 상당 — 시스템 프롬프트가 "쓰기 전 읽기"를 강제한다.
- 비Windows에서 import 에러로 죽지 않게 try/except (excel_tools의 xw 패턴 동일).

## chart_tools.py
- matplotlib Agg 백엔드 (창 없음 — 창은 Excel/한글이 담당).
- 한글 폰트: Malgun Gothic → 없으면 NanumGothic 폴백. `plt.rcParams` 전역 오염 금지
  (font_manager로 개별 지정 또는 context 사용).
- 출력: workspace/charts/{이름}_{타임스탬프}.png 경로 반환.
