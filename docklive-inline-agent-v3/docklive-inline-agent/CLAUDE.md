# DockLive Inline Agent

Inline AI를 벤치마킹한 **로컬 데스크톱 문서 자동화 에이전트**.
사용자가 파일을 업로드하고 자연어로 요청하면, 실제 Excel/한글 프로세스를
실시간으로 열어 문서를 작성·편집하고 로컬 폴더에 저장한다.

## 아키텍처 (구조도 기준)

```
[파일 업로드·파싱]   [사용자 요청]
        \              /
         v            v
      [에이전트 코어]  ← Claude API tool_use 루프 (src/agent/loop.py)
         |  ↑
   도구 명령 | 실행 결과
         v  |
      [로컬 실행기]    ← COM 자동화 · xlwings (src/executor/, src/tools/)
         |
         v
   [Excel·한글 프로세스] → 실시간 편집 → 폴더 저장
```

상세 계약은 `ARCHITECTURE.md`, 런타임 도구 정의는 `docs/TOOL_SCHEMA.md` 참조.

## ⚠️ 두 층위의 "도구"를 절대 혼동하지 말 것

| 층위 | 무엇 | 어디 |
|---|---|---|
| 개발 타임 | Claude Code가 이 저장소를 개발할 때 쓰는 hooks/skills | `.claude/` |
| 런타임 | 완성된 에이전트가 Excel을 조작하는 tool schema | `src/tools/schemas.py` |

런타임 도구를 수정할 때는 반드시 3곳을 동기화한다:
`src/tools/schemas.py`(스키마) ↔ `src/tools/excel_tools.py`(구현) ↔ `docs/TOOL_SCHEMA.md`(문서).

## 기술 스택 / 환경

- Python 3.11+, Windows 전용 (COM 자동화 의존)
- xlwings + pywin32 : Excel 실시간 제어
- anthropic SDK : 에이전트 루프 (기본 모델 `claude-sonnet-4-6`, 필요 시 env `AGENT_MODEL`로 상향)
- HWPX : Zip+XML 직접 조작 (기존 DockLive 파이프라인 이식, `.claude/skills/hwpx-pipeline` 참조)
- 이 저장소는 macOS/Linux에서는 **문법 검사·단위 테스트까지만** 가능. COM 통합 테스트는 Windows에서만.

## 불변 규칙 (Guardrails)

1. **사용자 파일 무결성**: 사용자 원본 파일을 여는 모든 경로는 반드시
   `src/executor/backup.py`의 백업을 먼저 거친다. 백업 없는 쓰기 코드는 리뷰 반려 대상.
2. `samples/originals/` 아래 파일은 테스트 원본이다. 절대 수정하지 않는다 (hook이 차단함).
3. 도구 구현은 예외를 밖으로 던지지 않는다. 항상 `{"ok": bool, "data"|"error": ...}` dict를
   반환하고, 에러는 문자열로 에이전트 루프에 피드백되어 모델이 스스로 복구를 시도하게 한다.
4. COM 객체는 반드시 세션 매니저(`excel_tools.ExcelSession`)를 통해서만 접근한다.
   좀비 EXCEL.EXE 프로세스 방지를 위해 close/quit 경로를 명시적으로 관리.
5. API 키는 환경변수 `ANTHROPIC_API_KEY`만 사용. 코드/설정 파일에 하드코딩 금지.
6. 시크릿, `.env`는 커밋 금지.

## 자주 쓰는 명령

```bash
pip install -r requirements.txt
python -m compileall src                 # 문법 검사 (Stop hook이 자동 실행)
pytest -q tests/                         # 단위 테스트 (COM 없는 것만)
python src/cli.py --file 견적서.xlsx --request "A사 데이터로 채워줘"   # Windows에서 E2E
```

## 현재 단계

`TASKS.md`의 Phase 순서를 따른다. Phase를 건너뛰지 말 것.
작업 완료 시 TASKS.md 체크박스를 갱신한다.

## 코드 컨벤션

- 함수/변수 영어, 주석·docstring 한국어 허용
- 도구 함수 이름은 스키마의 `name`과 1:1 일치
- 타입 힌트 필수, 파일당 300줄 이하 유지

## v2 (Codex 병행 작업)

Phase 6~8(HWP 실시간 제어, 차트/표)은 Codex 하네스(AGENTS.md)로도 작업 가능하다.
Claude Code로 이 영역을 작업할 때도 동일 규약 적용: docs/HWP_COM_GUIDE.md 정독,
scripts/verify.py 통과, WINDOWS-VERIFY 주석 규약. 규칙 변경 시 CLAUDE.md와
AGENTS.md를 함께 갱신한다.

## Phase 9: 양식 무결성 (핵심 지표)

- 무결성 통과율(scripts/grade.py)이 이 제품의 존재 이유다. 채움 관련 코드를 수정하면
  반드시 `python scripts/grade.py --min-rate 100` 통과 후 완료 처리한다 (verify.py에 통합됨).
- 새 파손 유형 발견 시: 음성 테스트 먼저(tests/test_integrity.py) → 검사 구현. 순서 고정.
- corpus/forms/ 는 채점의 기준점 — hook이 수정을 차단한다. 상세 규약은
  .claude/skills/integrity-grading/SKILL.md 참조.
