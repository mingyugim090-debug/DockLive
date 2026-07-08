# Codex 킥오프 가이드

## 실행
```bash
cd docklive-inline-agent
codex          # 대화형. 프로젝트를 trusted로 승인하면 .codex/config.toml 로드됨
```

## 첫 프롬프트 (그대로 붙여넣기)

> AGENTS.md를 읽고 이 저장소의 구조를 파악해줘. 그다음 docs/HWP_COM_GUIDE.md와
> src/tools/AGENTS.md를 읽고, TASKS.md의 Phase 6부터 순서대로 진행해.
> 각 태스크 완료 전에 반드시 `python scripts/verify.py`를 실행해서 전부 통과시키고,
> COM 실동작 검증이 필요한 지점은 `# WINDOWS-VERIFY:` 주석 규약을 따라줘.

## 태스크별 프롬프트 예시

- Phase 6 데모: "매출 샘플 데이터를 새 워크북에 넣고 create_table과 create_chart를
  연쇄 호출하는 데모 스크립트를 examples/에 만들어. verify.py 통과 필수."
- Phase 7 실검증(Windows에서): "samples/originals의 서식 사본으로 hwp_open →
  hwp_list_fields → hwp_fill_field → hwp_save 흐름을 실행하고, WINDOWS-VERIFY
  주석 지점을 하나씩 확인해서 파라미터가 다르면 코드와 HWP_COM_GUIDE.md를 같이 고쳐."
- Phase 8 통합: "'분기 매출 표와 막대그래프를 사업계획서에 넣어줘' 시나리오의
  E2E 데모를 만들어. render_chart_image → hwp_insert_image 연쇄가 핵심."

## 하네스 요소 매핑 (Claude Code ↔ Codex)

| 역할 | Claude Code (v1) | Codex (v2) |
|---|---|---|
| 프로젝트 헌법 | CLAUDE.md | AGENTS.md (루트) |
| 폴더별 규약 | .claude/skills/*/SKILL.md | src/tools/AGENTS.md (nested) + docs/ 가이드 |
| 종료 전 검증 강제 | Stop hook | scripts/verify.py + AGENTS.md 완료 조건 |
| 위험 행동 차단 | PreToolUse hooks | .codex/config.toml (sandbox_mode=workspace-write, approval on-request) + developer_instructions |
| 세션 컨텍스트 주입 | SessionStart hook | AGENTS.md "먼저 읽을 파일" 목록 |

두 하네스는 공존한다 — Claude Code로 열면 CLAUDE.md+hooks가, Codex로 열면
AGENTS.md+.codex가 작동한다. 규칙 변경 시 양쪽 문서를 함께 갱신할 것.
