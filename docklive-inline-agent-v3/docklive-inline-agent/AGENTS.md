# DockLive Inline Agent — v2 (Codex 작업 지침)

로컬 데스크톱 문서 자동화 에이전트. 사용자가 파일을 올리고 자연어로 요청하면
**실제 Excel과 한글(HWP) 창을 실시간으로 열어** 문서·표·차트를 작성하고 로컬 폴더에 저장한다.

이 저장소는 Claude Code로 Phase 1~5 골격이 구축되었고, Codex인 당신의 임무는
**v2 확장: ① HWP/HWPX 실시간 편집 ② 차트·표·그래프 실시간 생성**이다.

## 반드시 먼저 읽을 파일 (순서대로)

1. `ARCHITECTURE.md` — 4레이어 구조와 컴포넌트 계약
2. `docs/TOOL_SCHEMA.md` — 런타임 도구 명세 (v2 도구 포함)
3. `docs/HWP_COM_GUIDE.md` — 한글 COM 제어의 함정과 규약 (이걸 안 읽고 HWP 코드를 만지면 반드시 실패한다)
4. `TASKS.md` — Phase 6~8이 당신의 작업 범위
5. `src/tools/AGENTS.md` — 도구 레이어 상세 규약 (COM 수명주기, 값 계약)

## 아키텍처 요약

```
[파일 파싱] [사용자 요청] → [에이전트 코어: Claude API tool_use 루프]
                                  ↕ (도구 명령 / 실행 결과)
                            [로컬 실행기: dispatcher]
                             ↙                    ↘
                  [Excel: xlwings COM]      [한글: HwpCtrl COM]
                   표·차트 실시간 생성        누름틀 채움·표·차트이미지 삽입
                             ↘                    ↙
                              [로컬 폴더 저장]
```

## 두 층위의 "도구"를 혼동하지 말 것

- **개발 타임**: 당신(Codex)이 이 저장소를 수정하는 작업
- **런타임**: 완성된 에이전트가 Excel/한글을 조작하는 tool schema (`src/tools/schemas.py`)

런타임 도구 수정 시 4곳 동기화 필수:
`docs/TOOL_SCHEMA.md` ↔ `src/tools/schemas.py` ↔ 구현 파일 ↔ `src/executor/dispatcher.py`

## 불변 규칙 (위반 시 작업 반려)

1. 사용자 파일을 여는 모든 경로는 `executor/backup.ensure_backup()`을 **먼저** 거친다.
2. 도구 함수는 예외를 던지지 않는다. 항상 `{"ok": bool, "data"|"error": ...}` 반환.
   에러 문자열은 모델이 읽고 자가 복구할 수 있게 구체적으로 (대안 목록 포함).
3. COM 핸들은 세션 싱글턴(`ExcelSession`, `HwpSession`)만 소유한다.
4. `samples/originals/` 수정 금지, 시크릿 커밋 금지, API 키는 환경변수만.
5. HWP 저장은 HWPX 포맷 우선. `docs/HWP_COM_GUIDE.md`의 보안 모듈 규약 준수.
6. 차트 한글 텍스트는 폰트 미지정 시 깨진다 — `chart_tools.py`의 폰트 설정 경유 필수.

## 작업 완료 조건 (매 태스크 공통)

- 코드 수정 후 **반드시** `python scripts/verify.py` 를 실행하고 전부 통과해야 완료로 간주한다.
  (문법 검사 + 스키마↔디스패처 동기화 + 계약 테스트. 이 저장소의 CI 대용이다.)
- COM 실동작(Excel/한글 창)은 이 환경에서 검증 불가할 수 있다. 그 경우 코드에
  `# WINDOWS-VERIFY:` 주석으로 검증 포인트를 남기고 TASKS.md 체크박스에 `(코드완료/실검증대기)`로 표기.
- TASKS.md 체크박스를 갱신한다. Phase를 건너뛰지 않는다.

## 환경

- Python 3.11+, 대상 환경은 Windows (Excel + 한컴오피스 설치 가정)
- 의존성: `pip install -r requirements.txt`
- 기본 모델(런타임): `claude-sonnet-4-6`, env `AGENT_MODEL`로 교체 가능
- 코드 컨벤션: 함수/변수 영어, 주석 한국어 허용, 타입 힌트 필수, 파일당 300줄 이하

## Phase 9 동기화 노트

양식 무결성 채점기(src/integrity/, scripts/grade.py)가 verify.py에 게이트로 통합됨.
채움 관련 수정 시 통과율 100% 유지 필수. 규약: .claude/skills/integrity-grading/SKILL.md
(Codex도 이 문서를 읽을 것 — 경로만 .claude일 뿐 도구 중립 규약이다.)
