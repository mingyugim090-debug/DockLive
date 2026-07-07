# ARCHITECTURE

## 컴포넌트 계약

### 1. 파일 업로드·파싱 (`src/tools/file_tools.py` — Phase 4)
- 입력: 로컬 파일 경로 (HWPX/DOCX/XLSX/PDF)
- 출력: 구조화 텍스트 (섹션/표 단위)
- 역할: 파일 바이너리를 API로 보내지 않는다. **의미만** 프롬프트에 싣는다.
- HWPX는 zip 해제 → Contents/section*.xml 파싱 (기존 DockLive 파이프라인)

### 2. 에이전트 코어 (`src/agent/loop.py`)
- 입력: 사용자 요청 + 파싱된 문서 컨텍스트 + tool schema
- 처리: Claude API messages 루프
  - `stop_reason == "tool_use"` → 각 tool_use 블록을 dispatcher에 전달
  - 결과를 `tool_result` 블록(user 롤)으로 append 후 재호출
  - `stop_reason == "end_turn"` → 최종 텍스트 반환
- 가드: `MAX_ITERATIONS = 25`. 초과 시 중단하고 사용자에게 상황 보고.
- 상태: 대화 히스토리는 이 프로세스의 메모리에만 존재 (매 호출 전체 전송)

### 3. 로컬 실행기 (`src/executor/dispatcher.py`)
- 입력: (tool_name, tool_input dict)
- 처리: TOOL_REGISTRY에서 함수 조회 → 실행
- 출력: 항상 문자열화된 JSON. 예외는 절대 전파하지 않고
  `{"ok": false, "error": "..."}` 로 변환 → 모델이 읽고 재시도 판단
- 쓰기 계열 도구는 실행 전 backup.ensure_backup() 통과 여부를 검사

### 4. Excel 프로세스 (`src/tools/excel_tools.py`)
- xlwings `App(visible=True)` — 사용자 눈앞에서 실시간 편집이 보이는 것이 제품 핵심
- ExcelSession 싱글턴이 App/Book 핸들 보유. 도구 함수는 세션을 통해서만 접근
- SaveAs는 사용자 지정 폴더 (기본: 원본과 같은 폴더에 `_완성본` 접미사)

## 메시지 흐름 (한 턴)

```
user request ─→ loop.py ─→ Claude API
                              │ tool_use: write_range(sheet="견적", range="B5:D7", values=[...])
                              ▼
                        dispatcher.execute()
                              │ backup 확인 → excel_tools.write_range()
                              ▼
                        Excel 창에 즉시 반영 (사용자가 봄)
                              │ {"ok": true, "data": "3x3 written"}
                              ▼
                        tool_result ─→ Claude API ─→ (반복 또는 end_turn)
```

## 실패 처리 원칙

| 상황 | 처리 |
|---|---|
| COM 에러 (파일 잠김, 시트 없음) | error dict → 모델이 대안 시도 (최대 2회), 안되면 사용자 보고 |
| 루프 폭주 | MAX_ITERATIONS에서 강제 종료 + 지금까지의 작업 요약 |
| 쓰기 중 크래시 | 백업본에서 restore_backup() 안내 |
| Excel 미설치/비Windows | open_workbook이 즉시 감지하고 명확한 에러 반환 |

## Phase 5 통합 형태 (예정)

웹(DockLive Next.js) ↔ WebSocket ↔ 로컬 트레이 에이전트(이 저장소).
클라우드가 계정/결제/프롬프트를, 로컬이 실행 권한(Excel·폴더)을 담당하는 하이브리드.
