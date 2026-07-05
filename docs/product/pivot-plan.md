# DockLive Pivot Plan — 공고문 대응 문서 자동화 Agent 완성 계획

> 목적: 기존 LiveDock Agent MVP를 "사업계획서·정부공고문 작성 자동화 AI Agent"로 완성한다.
> 원칙: 기존 harness / skills / 6단계 워크플로우를 버리지 않고, 그 위에 부족한 조각을 얹는다.

---

## 1. 포지셔닝 (경쟁 서비스 대비)

| 항목 | GovPlan AI | 독스헌트 | **DockLive (목표)** |
|---|---|---|---|
| 입력 | 아이디어 텍스트 | 아이디어 + 양식 | **공고 원문(PDF/URL/텍스트) + HWP/HWPX 양식** |
| 작성 구조 | PSST 고정 | 양식 매핑 | **공고에서 추출한 작성 항목 + PSST 하이브리드** |
| 근거성 | 낮음 (생성 위주) | 중간 | **높음 — uncertain_fields / confirmation gate** |
| 평가 반영 | 평가지표 반영 주장 | - | **평가기준 역산 채점 루프 (rubric scoring)** |
| HWP 대응 | 다운로드 편집 | 한글 양식 대응 | **HWPX clone/replace로 표·스타일 원본 보존** |
| Export | DOCX 중심 | HWP | **HWPX + PDF + HTML, validate 게이트** |

**차별화 한 줄:** "AI가 그럴듯한 글을 쓰는 서비스"가 아니라, **공고 원문을 근거로 쓰고, 평가기준으로 스스로 채점하고, 원본 양식 그대로 내보내는 Agent.**

---

## 2. 완성 목표 워크플로우 (기존 6단계 → 8단계)

```
1. Input      PDF / URL / 텍스트 / HWP·HWPX 양식
2. Analysis   공고 핵심 정보 + [NEW] 평가기준(배점표) 추출
3. Questions  부족 정보만 질문 (기존 유지)
4. Draft      섹션별 초안 — [NEW] PSST 프레임워크 + 개조식 스타일 적용
5. Score      [NEW] 평가기준 역산 채점 → 항목별 점수/약점/개선 제안
6. Revise     [NEW] 약점 섹션만 targeted 재작성 (Score→Revise 루프, 최대 2회)
7. Review     사용자 확인 게이트 (기존 유지)
8. Export     HWPX / PDF / HTML + validate (기존 유지)
```

- Score/Revise는 **선택 단계**로 시작 (skip 가능) → MVP 흐름을 깨지 않음.
- 백엔드: `POST /api/workflow/{id}/score`, `POST /api/workflow/{id}/draft/{sid}/revise` (revise는 이미 존재 — score 결과를 revise의 feedback으로 주입하면 됨).

## 3. 아키텍처 변경 (최소 침습)

```
frontend (Next.js 14)
  app/app/page.tsx        6→8단계 스텝퍼로 확장 (Score 카드 UI 추가)
  components/score/       [NEW] RubricScoreCard, WeaknessList

backend (FastAPI)
  routers/score.py        [NEW] 채점 라우터
  services/
    scoring_service.py    [NEW] AnalysisResult.rubric + draft_sections → RubricScore
    drafting_service.py   PSST 프롬프트 + 개조식 스타일 규칙 주입 (수정)
  models/schemas.py       EvaluationRubric, RubricScore 타입 추가

.claude/skills/           [NEW] 3개 스킬 추가 (아래 4장)
```

**타입 추가 (schemas.py ↔ types.ts 동기화 필수):**

```typescript
EvaluationRubric  // criteria[]: { name, weight, description, source_ref }
RubricScore       // per_criterion[]: { name, score, max, weakness, suggestion },
                  // total, grounded_only: boolean
```

- 평가기준이 공고에 없으면 `rubric = null` → Score 단계 자동 skip. **절대 임의 배점표를 만들지 않는다** (AGENTS.md 근거성 원칙 유지).

---

## 4. 신규 Skills (이 패키지에 포함)

| Skill | 역할 | 워크플로우 위치 |
|---|---|---|
| `livedock-psst-draft` | PSST(Problem–Solution–Scale-up–Team) 프레임워크로 사업계획서형 섹션 작성 | Draft 단계에서 section-draft 보조 |
| `livedock-eval-rubric` | 공고의 평가기준 추출 + 초안 역산 채점 + 개선 제안 | Analysis(추출) / Score(채점) |
| `livedock-official-style` | 개조식·행정문체 스타일 가드 (장문 금지, 수치 강조, 출처 표기) | Draft/Revise 전체에 적용 |

기존 skill chain 라우팅 수정 (livedock-workflow-router):

```text
livedock-announce-analyze (+eval-rubric 추출)
  -> livedock-input-collect
    -> livedock-section-draft (+psst-draft, +official-style)
      -> livedock-eval-rubric (채점, optional)
        -> [기존 HWPX chain 그대로]
```

---

## 5. 디자인 방향

기존 그린 팔레트(#245D50 계열)는 유지하되:

1. **스텝퍼 확장**: 6칸 → 8칸이 아니라, Score/Revise를 Draft 하위의 "품질 루프" 배지로 표현 (스텝 수를 늘리면 심리적 부담 증가).
2. **Score 카드**: 평가항목별 가로 바 + 점수, 약점은 amber(#B45309) 계열 경고 톤, "공고에 배점표 없음 → 채점 생략" 상태 명시.
3. **근거 표시 강화**: 초안의 각 주장 옆에 `source_ref` 칩 (공고 p.X / 사용자 입력 / 확인 필요) — 이게 경쟁사가 못 하는 신뢰 UX.
4. 랜딩 카피: "2~3주 걸리던 서류를 몇 분에" 류의 경쟁사 카피 대신 **"공고가 근거, 평가기준이 기준"** 컨셉.

---

## 6. 실행 로드맵 (Codex + Claude Code)

### Phase 1 — 스킬/문서 반영 (0.5일)
- 이 패키지의 `docs/`, `.claude/skills/` 3개를 레포에 커밋
- `livedock-workflow-router/SKILL.md` 라우팅 표 업데이트
- `harness/memory/PROJECT_MEMORY.md`에 피벗 결정 기록

### Phase 2 — Rubric 추출 (1일, Codex 주도)
- `schemas.py` + `types.ts`에 EvaluationRubric 추가
- analyze 프롬프트에 배점표 추출 지시 추가 (없으면 null)
- fixture 기반 contract test 추가 → `harness quick` 통과

### Phase 3 — Scoring 서비스 (1~2일, Claude Code에 handoff)
- `scoring_service.py` + `routers/score.py`
- 채점 프롬프트: rubric + draft_sections만 입력, 근거 없는 감점/가점 금지
- eval fixture: 동일 초안 채점 시 ±5점 이내 재현성 테스트

### Phase 4 — PSST + 스타일 주입 (1일)
- drafting_service 프롬프트에 psst-draft / official-style 규칙 반영
- 기존 초안 스냅샷과 비교하는 golden test

### Phase 5 — 프론트 Score UI + 루프 (1~2일, Claude Code)
- Score 카드, "약점만 재작성" 버튼 → 기존 revise API 재사용
- Playwright/vitest로 skip 경로(rubric null) 테스트

### Phase 6 — 폴리시 & 배포 (0.5일)
- 랜딩 카피/스텝퍼 반영, Vercel/Render 배포, demo fixture에 배점표 포함 공고 추가

**총 5~7일 분량. HWPX 파이프라인은 건드리지 않으므로 리스크 낮음.**

---

## 7. 하지 말 것 (기존 AGENTS.md 원칙 재확인)

- 공고에 없는 배점표·마감일·금액을 생성하지 않는다.
- 커뮤니티/피드/팀 모집 기능은 이번 피벗 범위 밖.
- `backend/hwpx_toolchain/scripts/`는 수정 금지 대상 유지.
- Score 기능 때문에 기본 6단계 happy path가 느려지거나 깨지면 안 됨 (Score는 항상 optional).
