# DockLive Inline Agent — Claude Code 하네스

Inline AI 벤치마킹: 파일 업로드 → 자연어 요청 → 실제 Excel 실시간 편집 → 폴더 저장.

## 시작하기 (Windows)
1. 이 폴더를 열고 `claude` 실행 (Claude Code가 CLAUDE.md, hooks, skills를 자동 로드)
2. 첫 프롬프트 예시: "TASKS.md Phase 1부터 시작해줘. excel-com-automation 스킬 규약을 따라서."
3. `pip install -r requirements.txt`
4. E2E: `set ANTHROPIC_API_KEY=...` 후 `python src/cli.py --file 양식.xlsx --request "..."`

## 구조
- `CLAUDE.md` — 프로젝트 헌법 (아키텍처, 불변 규칙)
- `TASKS.md` — Phase 1~5 로드맵
- `.claude/hooks/` — 개발 타임 가드레일 (위험명령 차단, 원본 보호, 종료 시 검증)
- `.claude/skills/` — COM 자동화 / tool_use 루프 / HWPX 규약
- `src/` — 런타임 에이전트 (schemas → dispatcher → excel_tools)
- `docs/TOOL_SCHEMA.md` — 런타임 도구 명세 (스키마와 1:1 동기화)
