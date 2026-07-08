# DockLive Inline Agent — Claude Code 하네스

Inline AI 벤치마킹: 파일 업로드 → 자연어 요청 → 실제 Excel 실시간 편집 → 폴더 저장.

## 최종 사용자 (개발 불필요)
Windows: InsForge Storage의 `DockLiveAgent-windows.zip` 다운로드 → 압축 해제 → `Start-DockLiveAgent.cmd` 실행 → 트레이 아이콘 확인.
macOS: InsForge Storage의 `DockLiveAgent-mac.zip` 다운로드 → 압축 해제 → `DockLiveAgent.app` 열기 → 메뉴 막대 아이콘 확인.

브라우저는 보안상 다운로드한 파일을 자동 실행할 수 없다. 사용자는 내려받은 Agent를 한 번 직접 열어야 하며, 이후 DockLive 웹 화면에서 연결 상태와 저장 폴더 선택을 바로 사용할 수 있다.

OpenAI 키 설정 불필요 — 에이전트는 DockLive 백엔드(`/api/agent/chat`)를 통해서만 AI를 호출한다.

## 개발하기
1. 이 폴더를 열고 `claude` 실행 (Claude Code가 CLAUDE.md, hooks, skills를 자동 로드)
2. 첫 프롬프트 예시: "TASKS.md Phase 1부터 시작해줘. excel-com-automation 스킬 규약을 따라서."
3. `pip install -r requirements.txt`
4. `.env`에 `AGENT_PROXY_TOKEN`을 채운다 (backend/.env와 같은 값 — 없으면 백엔드가 401 반환).
5. E2E: `python src/cli.py --file 양식.xlsx --request "..."`
6. 트레이 상주: `python src/tray.py` — 로컬 서버(127.0.0.1:8765)를 백그라운드로 켠 채 트레이에 상주
7. Windows 정식 배포판 빌드: `powershell -File scripts/build_agent_exe.ps1` → `dist/DockLiveAgent.exe`
8. macOS 배포판 빌드: `bash scripts/build_agent_app_macos.sh` → `dist/DockLiveAgent-mac.zip`
   (`.env`가 함께 번들되어 다운로드한 사용자가 키 설정 없이 바로 실행 가능)
9. 프론트/Storage 다운로드 패키지 생성: `powershell -ExecutionPolicy Bypass -File scripts/package_agent_downloads.ps1`

긴급 Windows 배포 패키지는 직접 `.exe`를 내려받지 않도록 작은 Python bootstrap ZIP으로 만든다.
정식 배포에서는 Authenticode 서명된 `DockLiveAgent.exe`를 ZIP 또는 설치 파일로 교체한다.

브라우저/OS 보안 경고를 완전히 없애려면 Windows Authenticode 서명과 macOS Developer ID notarization이 필요하다.
서명 절차는 `docs/RELEASE_SIGNING.md`를 따른다.

## 구조
- `CLAUDE.md` — 프로젝트 헌법 (아키텍처, 불변 규칙)
- `TASKS.md` — Phase 1~5 로드맵
- `.claude/hooks/` — 개발 타임 가드레일 (위험명령 차단, 원본 보호, 종료 시 검증)
- `.claude/skills/` — COM 자동화 / tool_use 루프 / HWPX 규약
- `src/` — 런타임 에이전트 (schemas → dispatcher → excel_tools)
- `docs/TOOL_SCHEMA.md` — 런타임 도구 명세 (스키마와 1:1 동기화)
