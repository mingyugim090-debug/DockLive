# TASKS

## Phase 1 — 런타임 도구 레이어 (Excel COM)
- [x] `src/tools/excel_tools.py`: ExcelSession 싱글턴 (open/close/quit 수명주기)
- [x] open_workbook / list_sheets / read_range 구현 + 수동 검증 (scripts/com_smoke.py, 실제 Excel 통과)
- [x] write_range / apply_formula / insert_rows / format_range 구현
- [x] save_workbook (SaveAs 경로 처리, 확장자 검증)
- [x] `src/executor/backup.py`: 열기 전 자동 백업 + restore_backup
- [x] 각 도구가 {"ok", "data"|"error"} 계약을 지키는지 단위 테스트 (COM mock) — tests/test_excel_tools.py, test_backup.py

## Phase 2 — 에이전트 코어
- [x] `src/tools/schemas.py`: TOOL_SCHEMA.md와 1:1 일치하는 tool 정의 (OpenAI 형식은 OPENAI_TOOLS로 자동 변환)
- [x] `src/executor/dispatcher.py`: name→함수 라우팅, 예외 → 에러 문자열 변환
- [x] `src/agent/loop.py`: stop_reason=="tool_use" while 루프, max_iterations 가드 (+on_event 콜백)
- [x] `src/agent/prompts.py`: 시스템 프롬프트 (안전 규칙 + 작업 순서 강제)
- [x] tool_result에 is_error 플래그 전달, 모델의 자가 복구 확인 — tests/test_agent_loop.py

## Phase 3 — CLI 데모 (인라인 AI 데모 재현)
- [x] `src/cli.py`: --file --request --source 인자, 대화형 모드
- [x] 실행 로그: 어떤 도구를 어떤 인자로 호출했는지 실시간 출력 (loop 이벤트 → CLI)
- [x] 데모 시나리오: 견적서 양식 + "A사 3개 품목 채워줘" → Excel 창에서 실시간 입력 확인
      (도구 계층은 scripts/com_smoke.py 로 실제 Excel COM 검증 완료.
       LLM 구동 E2E는 DockLive 백엔드 프록시 경유(`AGENT_PROXY_TOKEN` 설정) 후:
       `python src/cli.py --file samples/견적서양식.xlsx --request "A사 데이터 3개 품목 채워줘"`)
- [x] 실패 시나리오: 없는 시트 → 에러 dict 피드백 확인(com_smoke), 백업/원복은 test_backup.py
      (잠긴 파일은 Excel이 파일을 연 상태에서 CLI 실행으로 수동 확인 가능)

## Phase 4 — 소스 문서 파싱 (RAG-lite)
- [x] read_document 도구: HWPX(zip+xml) / DOCX(python-docx, 표 포함) / PDF(pypdf) 텍스트 추출
- [x] 기존 DockLive HWPX 파이프라인 이식 (.claude/skills/hwpx-pipeline 참조) — 읽기 경로
- [x] 긴 문서 → 요청 관련 섹션만 컨텍스트에 주입 (file_tools.relevant_excerpt, CLI --source / 서버 source)

## Phase 5 — DockLive 통합 (로컬 에이전트 방식)
- [x] FastAPI 로컬 서버 + WebSocket: 웹(Next.js) ↔ 로컬 실행기 페어링 — src/server.py (127.0.0.1:8765)
- [x] 트레이 상주 프로그램 패키징 — src/tray.py (pystray, 서버 데몬 스레드 + 종료 메뉴)
- [x] 진행 상태 스트리밍: 도구 호출 이벤트를 웹 UI에 실시간 표시
      — frontend/components/projects/LocalAgentPanel.tsx (health 감지 + WS 이벤트 로그,
       ProjectWorkspace 우측 패널에 통합)
- [x] 한글(HWP) 제어 검토: HWPX 직접 조작 확정, HwpCtrl COM 보류 — docs/HWP_CONTROL.md
- [x] OpenAI 키 배포 문제 해결: 에이전트가 OpenAI를 직접 호출하지 않고 DockLive 백엔드
      `/api/agent/chat`을 프록시로 호출 (공유 토큰 + 분당 레이트리밋). 사용자 PC에는
      어떤 AI 키도 두지 않는다 — backend/routers/agent.py, src/agent/loop.py
- [x] 터미널 없는 배포: PyInstaller로 `DockLiveAgent.exe` 단일 실행파일 패키징
      (scripts/build_agent_exe.ps1, AGENT_PROXY_TOKEN 번들), 백엔드 `/downloads/`에서 서빙,
      `/app/new` 우측 패널에 다운로드 가이드(AgentSetupGuide) 연결

## Backlog
- [ ] 편집 diff 미리보기 (쓰기 전 사용자 승인 모드)
- [ ] 사업계획서 8단계 워크플로우와 연결 (DockLive 본체)
