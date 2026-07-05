# Codex × Claude Code 개발 진행 가이드 (피벗 실행용)

레포에 이미 있는 harness 규칙(AGENTS.md, harness/roles, handoffs)을 그대로 사용한다.
새로운 프로세스를 만들지 말고, 아래처럼 **역할과 순서만 고정**해서 돌린다.

## 역할 분담 (기존 AGENTS.md 준수)

| | Codex | Claude Code |
|---|---|---|
| 주 임무 | 스코프 작은 변경, 검증, 에러 레지스트리 관리 | 넓은 구현 (새 서비스/컴포넌트/프롬프트) |
| 이번 피벗에서 | Phase 2 (스키마+추출), 모든 Phase의 게이트 검증 | Phase 3 (scoring_service), Phase 5 (Score UI) |
| 산출 | 테스트 + fixture | 구현 + 동작 요약 |

## 표준 루프 (모든 Phase 공통)

```
1. Codex 세션 시작
   → AGENTS.md, harness/state-spec.yaml, PROJECT_MEMORY.md, errors/registry.json 읽기
   → docs/PIVOT-PLAN.md의 해당 Phase 스코프 확인

2. Codex가 계약(contract) 먼저 작성
   → schemas.py / types.ts 타입 추가
   → backend/tests/contracts에 실패하는 테스트 추가
   → python scripts로 harness quick 실행 (실패 확인)

3. Handoff 생성 (구현이 큰 경우만)
   → python tools/harness/create_handoff.py 사용
   → harness/handoffs/claude-template.md 형식으로:
     - Objective: "scoring_service.py 구현, contract test 통과"
     - Boundaries: hwpx_toolchain 수정 금지, 기존 6단계 happy path 불변
     - Expected Return: 변경 파일 / 실행한 커맨드 / 실패 목록

4. Claude Code 세션
   → handoff 파일 + 이 문서 + 관련 SKILL.md를 컨텍스트로 열기
   → 구현 → 로컬에서 quick 프로파일 실행 → 결과를 handoff에 기록

5. Codex 검증
   → harness quick + backend + agent 프로파일 실행
   → 통과: PROJECT_MEMORY.md에 결정사항 기록 후 커밋
   → 실패: errors/registry.json에 등록, 수정 지시를 새 handoff로
```

## Phase별 시작 프롬프트 (복붙용)

### Phase 2 — Codex
```
docs/PIVOT-PLAN.md Phase 2를 진행한다.
EvaluationRubric 타입을 backend/models/schemas.py와 frontend/lib/types.ts에 추가하고,
analyze 프롬프트에 배점표 추출 지시를 추가하라. 공고에 배점표가 없으면 rubric은 null이어야 한다.
배점표가 포함된 공고 fixture 1개와 없는 공고 fixture 1개로 contract test를 작성하고,
harness quick 프로파일을 통과시켜라. .claude/skills/livedock-eval-rubric/SKILL.md의 Phase 1 규칙을 따른다.
```

### Phase 3 — Claude Code (handoff 후)
```
handoff 문서를 읽고 backend/services/scoring_service.py와 routers/score.py를 구현하라.
입력은 EvaluationRubric + draft_sections뿐이며, 외부 지식 기반 채점은 금지다.
.claude/skills/livedock-eval-rubric/SKILL.md Phase 2 규칙을 따른다.
완료 후 harness quick과 backend 프로파일을 실행하고 결과를 handoff에 기록하라.
기존 6단계 API의 응답 스키마는 절대 변경하지 마라.
```

### Phase 4 — Codex
```
drafting_service.py의 섹션 초안 프롬프트에
.claude/skills/livedock-psst-draft와 livedock-official-style 규칙을 주입하라.
사업계획서형 문서일 때만 PSST 매핑을 활성화하고 psst_axis를 metadata로 남겨라.
기존 demo fixture로 생성한 초안을 golden snapshot으로 저장하고 회귀 테스트를 추가하라.
```

### Phase 5 — Claude Code
```
frontend에 Score 단계 UI를 추가하라.
components/score/RubricScoreCard.tsx (항목별 바 + 점수 + 약점 + 개선 제안),
"약점만 재작성" 버튼은 기존 revise API에 suggestion을 feedback으로 전달한다.
rubric이 null이면 Score UI 전체가 skip되고 "평가기준 미명시" 안내만 표시한다.
컬러는 CLAUDE.md의 팔레트를 사용하고 임의 색상을 추가하지 마라.
vitest로 skip 경로 테스트를 추가하라.
```

## 충돌 방지 규칙

- 같은 파일을 두 에이전트가 동시에 만지지 않는다 — Phase 단위로 직렬 진행.
- Claude Code가 만든 코드는 Codex 게이트 통과 전까지 미검증 상태로 취급 (AGENTS.md 원칙).
- 프롬프트(AI 지시문) 변경은 반드시 fixture eval(`agent` 프로파일, min-score 80)과 함께.
- 커밋 메시지에 Phase 번호 포함: `feat(score): Phase 3 scoring service`
