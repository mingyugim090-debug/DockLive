# TASKS

## Phase 1 — 런타임 도구 레이어 (Excel COM)
- [ ] `src/tools/excel_tools.py`: ExcelSession 싱글턴 (open/close/quit 수명주기)
- [ ] open_workbook / list_sheets / read_range 구현 + 수동 검증
- [ ] write_range / apply_formula / insert_rows / format_range 구현
- [ ] save_workbook (SaveAs 경로 처리, 확장자 검증)
- [ ] `src/executor/backup.py`: 열기 전 자동 백업 + restore_backup
- [ ] 각 도구가 {"ok", "data"|"error"} 계약을 지키는지 단위 테스트 (COM mock)

## Phase 2 — 에이전트 코어
- [ ] `src/tools/schemas.py`: TOOL_SCHEMA.md와 1:1 일치하는 Anthropic tool 정의
- [ ] `src/executor/dispatcher.py`: name→함수 라우팅, 예외 → 에러 문자열 변환
- [ ] `src/agent/loop.py`: stop_reason=="tool_use" while 루프, max_iterations 가드
- [ ] `src/agent/prompts.py`: 시스템 프롬프트 (안전 규칙 + 작업 순서 강제)
- [ ] tool_result에 is_error 플래그 전달, 모델의 자가 복구 확인

## Phase 3 — CLI 데모 (인라인 AI 데모 재현)
- [ ] `src/cli.py`: --file --request 인자, 대화형 모드
- [ ] 실행 로그: 어떤 도구를 어떤 인자로 호출했는지 실시간 출력
- [ ] 데모 시나리오: 견적서 양식 + "A사 3개 품목 채워줘" → Excel 창에서 실시간 입력 확인
- [ ] 실패 시나리오: 잠긴 파일 / 없는 시트 → 롤백 동작 확인

## Phase 4 — 소스 문서 파싱 (RAG-lite)
- [ ] read_document 도구: HWPX(zip+xml) / DOCX / PDF 텍스트 추출
- [ ] 기존 DockLive HWPX 파이프라인 이식 (.claude/skills/hwpx-pipeline 참조)
- [ ] 긴 문서 → 요청 관련 섹션만 컨텍스트에 주입 (토큰 절약)

## Phase 5 — DockLive 통합 (로컬 에이전트 방식)
- [ ] FastAPI 로컬 서버 + WebSocket: 웹(Next.js) ↔ 로컬 실행기 페어링
- [ ] 트레이 상주 프로그램 패키징 (pystray 또는 Tauri sidecar)
- [ ] 진행 상태 스트리밍: 도구 호출 이벤트를 웹 UI에 실시간 표시
- [ ] 한글(HWP) 제어 검토: HWPX 직접 조작 우선, HwpCtrl COM은 후순위

## Backlog
- [ ] 편집 diff 미리보기 (쓰기 전 사용자 승인 모드)
- [ ] 사업계획서 8단계 워크플로우와 연결 (DockLive 본체)

---
# v2 (Codex 작업 범위) — 시작 전 AGENTS.md와 docs/HWP_COM_GUIDE.md 정독

## Phase 6 — Excel 시각화 (차트·표)
- [x] create_chart / create_table 스키마 + 구현 (코드완료/실검증대기)
- [ ] WINDOWS-VERIFY: chart.api[1] 제목 설정, tables.add 동작 실검증
- [ ] 데모: 매출 데이터 write_range → create_table → create_chart 한 번에
- [ ] 차트 위치/크기 겹침 처리 (기존 차트 존재 시 anchor 자동 이동)

## Phase 7 — 한글(HWP) 실시간 제어
- [x] HwpSession + 9종 도구 스키마/구현 (코드완료/실검증대기)
- [ ] scripts/register_hwp_module.py 실행 및 보안 팝업 억제 확인
- [ ] WINDOWS-VERIFY: GetFieldList 구분자, AllReplace/TableCreate 파라미터셋,
      InsertPicture 크기 단위 — hwp_tools.py의 주석 지점 전부
- [ ] 데모: 정부 서식 hwpx의 누름틀 채우기 (hwp_open → fields → fill_field → save)
- [ ] 누름틀 없는 양식 폴백: {{플레이스홀더}} replace_text 데모

## Phase 8 — 차트→한글 파이프라인 + 통합 데모
- [x] render_chart_image (matplotlib, 한글 폰트 폴백) (코드완료)
- [ ] 통합 데모: "사업계획서에 분기 매출 표와 막대그래프 넣어줘"
      → hwp_insert_table + render_chart_image + hwp_insert_image 연쇄
- [ ] Excel 데이터 → 한글 차트 크로스 시나리오 (read_range → render → insert)
- [ ] HWPX 헤드리스 모드: 한컴 미설치 시 BinData 직접 삽입 폴백 (hwpx-pipeline 규약)
